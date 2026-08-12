import { expect, test } from "vite-plus/test";

import { getInfiniteCanvasContextualCommands } from "./commands";
import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import { getInfiniteCanvasGroupProjection } from "./group-state";
import { createInfiniteCanvasGroupWindowNode, getInfiniteCanvasGroupWindowIds } from "./group-tree";
import type { InfiniteCanvasGroupContainerNode } from "./group-tree";
import {
  beginInfiniteCanvasGroupMove,
  beginWindowMove,
  stepCanvasInteraction,
} from "./interaction";
import { parseInfiniteCanvasState, serializeInfiniteCanvasState } from "./persistence";
import { executeInfiniteCanvasCommand, isInfiniteCanvasCommandEnabled } from "./commands";
import { reduceInfiniteCanvasState } from "./reducer";
import {
  getInfiniteCanvasContextualGroup,
  getInfiniteCanvasDirectionalFocusTarget,
  getNextInfiniteCanvasRovingIndex,
} from "./window-focus";
import { getInfiniteCanvasWindowPlacementRect } from "./window-placement";
import type { InfiniteCanvasGroup, InfiniteCanvasState } from "./types";

/**
 * C2, second half — the scenarios `group-tree.test.ts` and `history.test.ts` could not reach.
 *
 * Those two cover the tree primitives and the history stack. What was left unasserted is
 * everything that only exists once a *state* exists: a shell that moves as one object, a seam
 * that reweights, a mid-drag zoom, a cluster that survives storage, and the keyboard geometry
 * that lived in a `.tsx` until it was extracted for this file.
 *
 * Each test names its scenario id from `research/acceptance-scenarios.md` and asserts the
 * invariant that scenario turns on, not the incidental numbers around it.
 */

type Kind = "pane";

const POINTER = 1;

const windowAt = (id: string, x: number, y: number) =>
  createInfiniteCanvasWindow<Kind>({
    id,
    kind: "pane",
    rect: { height: 200, width: 300, x, y },
    title: id,
  });

/** A two-pane split shell, shaped the way `group.create` builds one. */
const splitTree = (): InfiniteCanvasGroupContainerNode => ({
  activeChildId: null,
  axis: "horizontal",
  children: [
    createInfiniteCanvasGroupWindowNode("left", 1),
    createInfiniteCanvasGroupWindowNode("right", 1),
  ],
  id: "shell::root",
  kind: "container",
  layout: "split",
  weight: 1,
});

const splitGroup = (tree: InfiniteCanvasGroupContainerNode = splitTree()): InfiniteCanvasGroup => ({
  id: "shell",
  rect: { height: 400, width: 800, x: 0, y: 0 },
  title: "Shell",
  tree,
  zIndex: 1,
});

const groupedState = (): InfiniteCanvasState<Kind> => ({
  ...createInfiniteCanvasState<Kind>({
    windows: [windowAt("left", 0, 0), windowAt("right", 400, 0)],
  }),
  groups: [splitGroup()],
  viewport: { height: 800, width: 1200 },
});

test("DOCK-003 — moving a shell moves every member by the same delta", () => {
  // The scenario's claim is not "the shell moved". It is that a group is ONE world object: every
  // member rect is re-derived from the shell, so members cannot drift relative to it or to each
  // other however far the drag runs.
  const state = groupedState();
  const before = getInfiniteCanvasGroupProjection(state.groups).windowRects;
  const moving = beginInfiniteCanvasGroupMove(state, POINTER, state.groups[0]!, { x: 100, y: 100 });
  const moved = stepCanvasInteraction(moving, POINTER, { x: 340, y: 190 });

  const shellDelta = {
    x: moved.groups[0]!.rect.x - state.groups[0]!.rect.x,
    y: moved.groups[0]!.rect.y - state.groups[0]!.rect.y,
  };

  expect(shellDelta).toEqual({ x: 240, y: 90 });

  const after = getInfiniteCanvasGroupProjection(moved.groups).windowRects;

  for (const [windowId, rect] of after) {
    const original = before.get(windowId);

    expect(original).toBeDefined();
    expect(rect.x - original!.x).toBe(shellDelta.x);
    expect(rect.y - original!.y).toBe(shellDelta.y);
  }
});

test("DOCK-003 — moving a shell never touches its tree", () => {
  // Placement lives in the tree, position lives in the rect. A move that rewrote the tree would
  // mean two things owned where a member sits, which is the drift the projection exists to stop.
  const state = groupedState();
  const moving = beginInfiniteCanvasGroupMove(state, POINTER, state.groups[0]!, { x: 0, y: 0 });
  const moved = stepCanvasInteraction(moving, POINTER, { x: 500, y: 0 });

  expect(moved.groups[0]!.tree).toBe(state.groups[0]!.tree);
});

test("SPLIT-001 — reweighting a seam changes the solved rects, with no DOM anywhere", () => {
  // "DOM widths are never the source of truth." This whole file runs without a document, which
  // is the strongest available form of that claim: the rects below could not have come from a
  // measured element, because there is none.
  const state = groupedState();
  const even = getInfiniteCanvasGroupProjection(state.groups).windowRects;

  expect(even.get("left")!.width).toBe(even.get("right")!.width);

  const reweighted = reduceInfiniteCanvasState(state, {
    containerId: "shell::root",
    groupId: "shell",
    type: "group.setChildWeights",
    weights: { left: 3, right: 1 },
  });
  const skewed = getInfiniteCanvasGroupProjection(reweighted.groups).windowRects;

  expect(skewed.get("left")!.width / skewed.get("right")!.width).toBeCloseTo(3, 5);
  // A seam redistributes *inside* the shell. The shell itself must not move.
  expect(reweighted.groups[0]!.rect).toEqual(state.groups[0]!.rect);
});

test("ACC-001 — roving arrows follow the container's axis, not the screen's", () => {
  // Hard-coding Left/Right, as a tablist may, would make Down walk a row of side-by-side headers
  // — the diagonal drift `window-focus.ts` refuses everywhere else.
  expect(getNextInfiniteCanvasRovingIndex("ArrowRight", 0, 3, "horizontal")).toBe(1);
  expect(getNextInfiniteCanvasRovingIndex("ArrowDown", 0, 3, "horizontal")).toBeNull();

  expect(getNextInfiniteCanvasRovingIndex("ArrowDown", 0, 3, "vertical")).toBe(1);
  expect(getNextInfiniteCanvasRovingIndex("ArrowRight", 0, 3, "vertical")).toBeNull();
});

test("ACC-001 — roving wraps at both ends; Home and End are axis-independent", () => {
  expect(getNextInfiniteCanvasRovingIndex("ArrowLeft", 0, 3, "horizontal")).toBe(2);
  expect(getNextInfiniteCanvasRovingIndex("ArrowRight", 2, 3, "horizontal")).toBe(0);
  expect(getNextInfiniteCanvasRovingIndex("ArrowUp", 0, 3, "vertical")).toBe(2);

  for (const axis of ["horizontal", "vertical"] as const) {
    expect(getNextInfiniteCanvasRovingIndex("Home", 2, 3, axis)).toBe(0);
    expect(getNextInfiniteCanvasRovingIndex("End", 0, 3, axis)).toBe(2);
  }

  // Activation is Enter/Space through the existing click path, so the roving rule ignores them.
  expect(getNextInfiniteCanvasRovingIndex("Enter", 1, 3, "horizontal")).toBeNull();
});

test("FAIL-001 — a zoom mid-drag does not slide the window out from under the cursor", () => {
  // The scenario verbatim: grab at zoom 1 and drag 100px right (world +100), zoom to 2, drag
  // another 100px. Converting the accumulated 200px screen delta at the captured zoom of 1 gives
  // world +200, where the true displacement is 100 + 50 = 150.
  //
  // The zoom must be **pointer-anchored** for that to be the right answer — `camera.zoomAt` keeps
  // the world point under the cursor fixed, which is what makes the two legs additive. Setting
  // `zoom` directly and leaving `center` alone teleports the world under the cursor instead, and
  // the expected total is then a different number for an uninteresting reason. Getting that wrong
  // is what made the first draft of this test assert 150 against a correct 100.
  const state: InfiniteCanvasState<Kind> = {
    ...createInfiniteCanvasState<Kind>({ windows: [windowAt("solo", 0, 0)] }),
    viewport: { height: 800, width: 1200 },
  };

  const grabbed = beginWindowMove(state, POINTER, "solo", { x: 600, y: 400 });
  const firstLeg = stepCanvasInteraction(grabbed, POINTER, { x: 700, y: 400 });

  expect(firstLeg.windows[0]!.rect.x).toBeCloseTo(100, 5);

  const zoomed = reduceInfiniteCanvasState(firstLeg, {
    anchor: { x: 700, y: 400 },
    type: "camera.zoomAt",
    zoom: 2,
  });
  const secondLeg = stepCanvasInteraction(zoomed, POINTER, { x: 800, y: 400 });

  expect(secondLeg.windows[0]!.rect.x).toBeCloseTo(150, 5);
});

test("FAIL-001 — the grabbed world point stays pinned to the cursor across a zoom", () => {
  // The invariant behind the arithmetic above, asserted directly so it survives any future change
  // to the numbers: whatever world point sat under the cursor when the drag began must still sit
  // at the same offset within the window after the camera has changed underneath it.
  const state: InfiniteCanvasState<Kind> = {
    ...createInfiniteCanvasState<Kind>({ windows: [windowAt("solo", 0, 0)] }),
    viewport: { height: 800, width: 1200 },
  };
  const grabPoint = { x: 600, y: 400 };
  const grabbed = beginWindowMove(state, POINTER, "solo", grabPoint);
  const grabOffset =
    screenToWorldX(grabbed, grabPoint.x) - (grabbed.windows[0]?.rect.x ?? Number.NaN);

  const zoomed = reduceInfiniteCanvasState(grabbed, {
    anchor: grabPoint,
    type: "camera.zoomAt",
    zoom: 3.5,
  });
  const dragged = stepCanvasInteraction(zoomed, POINTER, { x: 940, y: 400 });
  const heldOffset = screenToWorldX(dragged, 940) - (dragged.windows[0]?.rect.x ?? Number.NaN);

  expect(heldOffset).toBeCloseTo(grabOffset, 5);
});

/** The x half of `screenPointToWorldPoint`, which is all these scenarios move along. */
function screenToWorldX(state: InfiniteCanvasState<Kind>, screenX: number): number {
  return state.camera.center.x + (screenX - state.viewport.width / 2) / state.camera.zoom;
}

test("PERSIST-001 — a cluster of floating windows and a tab group survives a round trip", () => {
  // The envelope is at version 2 and serializes `groups`; nothing round-tripped one until now.
  // Membership is the part worth guarding — a tree that loses a child restores a shell laying
  // out a window that is no longer in it.
  const base = createInfiniteCanvasState<Kind>({
    windows: [windowAt("left", 0, 0), windowAt("right", 400, 0), windowAt("floater", 900, 500)],
  });
  const state: InfiniteCanvasState<Kind> = {
    ...base,
    groups: [splitGroup({ ...splitTree(), activeChildId: "right", layout: "tabs" })],
  };

  const restored = parseInfiniteCanvasState(
    JSON.parse(JSON.stringify(serializeInfiniteCanvasState(state))),
    base,
  );

  expect(restored).not.toBeNull();
  expect(restored!.groups).toHaveLength(1);

  const tree = restored!.groups[0]!.tree;

  expect(tree.kind).toBe("container");
  expect(tree.kind === "container" && tree.layout).toBe("tabs");
  // The active tab is part of the arrangement: restoring a tab group showing a different tab
  // than the one saved is a different layout, not the same one.
  expect(tree.kind === "container" && tree.activeChildId).toBe("right");
  expect(tree.kind === "container" && tree.children.map((child) => child.id)).toEqual([
    "left",
    "right",
  ]);
  expect(restored!.groups[0]!.rect).toEqual(state.groups[0]!.rect);

  // And the floating window is still floating, still where it was.
  expect(restored!.windows.find((window) => window.id === "floater")?.rect).toEqual({
    height: 200,
    width: 300,
    x: 900,
    y: 500,
  });
});

test("FOCUS-001 — directional focus prefers a group-local neighbour over a nearer floater", () => {
  // The rule this scenario exists for: a pane docked beside you is the neighbour the user means,
  // even when a floating window sits geometrically closer. Without it, arrowing inside a group
  // walks out of the group at the first opportunity.
  const base = createInfiniteCanvasState<Kind>({
    windows: [
      windowAt("left", 0, 0),
      windowAt("right", 400, 0),
      // Deliberately closer to `left` than `right` is, and deliberately not a member.
      windowAt("floater", 320, 0),
    ],
  });
  const state: InfiniteCanvasState<Kind> = {
    ...base,
    activeWindowId: "left",
    groups: [splitGroup()],
    viewport: { height: 800, width: 1200 },
  };

  expect(getInfiniteCanvasDirectionalFocusTarget(state, "right")).toBe("right");
});

test("FOCUS-002 — a floating window over a shell takes that group as its contextual parent", () => {
  // The mitigation for risk R9: a floating window whose centre lies inside a group's rect gets
  // that group as context, so it needs no keyboard model of its own. Smallest containing group
  // wins; a point outside every shell has no context at all.
  const state = groupedState();
  const shellRect = state.groups[0]!.rect;

  const inside = getInfiniteCanvasContextualGroup(state, {
    x: shellRect.x + shellRect.width / 2,
    y: shellRect.y + shellRect.height / 2,
  });

  expect(inside?.id).toBe("shell");
  expect(getInfiniteCanvasContextualGroup(state, { x: 5000, y: 5000 })).toBeNull();
});

test("FOCUS-003 — placement resolves through one engine, and never below minSize", () => {
  // `window-placement.ts` is the only thing that knows what "left half" means, so pointer and
  // keyboard cannot disagree. The clamp matters more than the halving: a tile narrower than the
  // window's own minimum grows away from the edge it is anchored to rather than sliding off it.
  const bounds = { height: 800, width: 1200, x: 0, y: 0 };
  const size = { height: 200, width: 300 };

  expect(getInfiniteCanvasWindowPlacementRect(bounds, "left", size)).toEqual({
    height: 800,
    width: 600,
    x: 0,
    y: 0,
  });
  expect(getInfiniteCanvasWindowPlacementRect(bounds, "fill", size)).toEqual(bounds);

  const clamped = getInfiniteCanvasWindowPlacementRect(bounds, "right", size, {
    height: 0,
    width: 900,
  });

  // Anchored right, too narrow to fit: it keeps its right edge rather than sliding off screen.
  expect(clamped.width).toBe(900);
  expect(clamped.x + clamped.width).toBe(bounds.x + bounds.width);
});

test("arrange verbs report themselves enabled when the selection actually supports them", () => {
  // Found by driving the product: `window.__canvas.contextualCommands()` reported
  // `enabled: false` for every align command while two floating windows were selected and
  // executing the command demonstrably moved them. The palette showed them enabled at the same
  // moment, so the two disagreed about the same state.
  //
  // This pins the predicate itself. If it passes, the descriptor logic is sound and the
  // disagreement was staleness in the handle; if it fails, the enablement rule is the bug.
  const state: InfiniteCanvasState<Kind> = {
    ...createInfiniteCanvasState<Kind>({
      windows: [windowAt("left", 0, 0), windowAt("right", 400, 0)],
    }),
    selection: { anchorWindowId: "right", targets: [], windowIds: ["left", "right"] },
    viewport: { height: 800, width: 1200 },
  };

  const byId = new Map(
    getInfiniteCanvasContextualCommands(state).map((command) => [command.id, command]),
  );

  expect(byId.get("window.align.left")?.enabled).toBe(true);
  // Distribute needs three, so it stays unavailable on a pair — the floor differs per verb and
  // the pure module is the one that knows which.
  expect(byId.get("window.distribute.horizontal")?.enabled).toBe(false);
});

test("SPLIT-005 — equalize returns skewed panes to equal widths, and is offered only when it would", () => {
  // The end-to-end claim, which the tree tests cannot make: equalizing changes what is on
  // screen. `group.setChildWeights` is the only way panes go uneven and it records no history
  // of what they were, so without this verb an even split is unrecoverable except by dragging
  // each seam back by eye.
  const state = { ...groupedState(), activeWindowId: "left" };
  const even = getInfiniteCanvasGroupProjection(state.groups).windowRects;

  expect(even.get("left")!.width).toBe(even.get("right")!.width);
  // Already even: offering the verb here would present a command that appears to do nothing.
  expect(isInfiniteCanvasCommandEnabled(state, { type: "group.equalizeChildren" })).toBe(false);

  const skewed = reduceInfiniteCanvasState(state, {
    containerId: "shell::root",
    groupId: "shell",
    type: "group.setChildWeights",
    weights: { left: 3, right: 1 },
  });

  expect(isInfiniteCanvasCommandEnabled(skewed, { type: "group.equalizeChildren" })).toBe(true);

  const equalized = executeInfiniteCanvasCommand(skewed, { type: "group.equalizeChildren" });
  const restored = getInfiniteCanvasGroupProjection(equalized.groups).windowRects;

  expect(restored.get("left")!.width).toBe(restored.get("right")!.width);
  // A pane arrangement redistributes *inside* the shell, exactly as a seam drag does.
  expect(equalized.groups[0]!.rect).toEqual(state.groups[0]!.rect);
});

test("SPLIT-005 — equalize is unavailable to a window that is not docked", () => {
  // The verb names a container. A floating window has no siblings to share with, and the
  // palette must not offer a pane command to someone who is not looking at panes.
  const floating = createInfiniteCanvasState<Kind>({ windows: [windowAt("solo", 0, 0)] });

  expect(
    isInfiniteCanvasCommandEnabled(
      { ...floating, activeWindowId: "solo" },
      { type: "group.equalizeChildren" },
    ),
  ).toBe(false);
});

// ── DOCK-006 — docking without a pointer ─────────────────────────────────────────────────

/**
 * Every group gesture was drag-only until 2026-08-12. `resolveInfiniteCanvasDockPreview`
 * reads a world point, so the library's largest feature was unreachable by keyboard — an
 * accessibility failure rather than a missing convenience, and one nothing in this file
 * could have caught, because every DOCK scenario above drives a pointer.
 *
 * The design that makes it safe: keyboard targeting produces the *same*
 * `InfiniteCanvasDockPreview` a drop produces, and both commit through
 * `applyInfiniteCanvasDockPreview`. The two gestures are one operation with two ways in.
 */

const twoFloating = (): InfiniteCanvasState<Kind> => ({
  ...createInfiniteCanvasState<Kind>({
    windows: [windowAt("west", 0, 0), windowAt("east", 400, 0)],
  }),
  activeWindowId: "west",
  viewport: { height: 800, width: 1200 },
});

test("DOCK-006 — docking right wraps both windows in a group, active window on the west", () => {
  const state = twoFloating();

  expect(state.groups).toEqual([]);
  expect(
    isInfiniteCanvasCommandEnabled(state, { direction: "right", type: "window.dockDirection" }),
  ).toBe(true);

  const docked = executeInfiniteCanvasCommand(state, {
    direction: "right",
    type: "window.dockDirection",
  });

  expect(docked.groups).toHaveLength(1);

  const rects = getInfiniteCanvasGroupProjection(docked.groups).windowRects;

  // The direction names where the window travels; it arrives on the far side's near edge.
  // Sending `west` rightward into `east` must leave it on the left, exactly as dragging it
  // onto `east`'s left half would.
  expect(rects.get("west")!.x).toBeLessThan(rects.get("east")!.x);
});

test("DOCK-006 — a keyboard dock lands where the drag would, and the pair occupies the target's place", () => {
  // DOCK-001's promise, reached by keyboard: the group takes the rect the target already
  // had, so nothing else on the canvas shifts.
  const state = twoFloating();
  const targetRect = state.windows.find((window) => window.id === "east")!.rect;
  const docked = executeInfiniteCanvasCommand(state, {
    direction: "right",
    type: "window.dockDirection",
  });

  expect(docked.groups[0]!.rect).toEqual(targetRect);
});

test("DOCK-006 — undocking frees the active window and leaves the shell holding its last member", () => {
  const docked = executeInfiniteCanvasCommand(twoFloating(), {
    direction: "right",
    type: "window.dockDirection",
  });

  expect(isInfiniteCanvasCommandEnabled(docked, { type: "window.undock" })).toBe(true);

  const undocked = executeInfiniteCanvasCommand(docked, { type: "window.undock" });

  // Not `groups: []`. DOCK-005 drops a shell whose *last* child leaves, and a one-member
  // group is a deliberate state here — `createInfiniteCanvasGroup` has an explicit branch
  // building one, and normalization keeps a one-tab group because it is still a tab group.
  // So dock-then-undock does not round-trip to bare floating windows, and that asymmetry is
  // the model's, not an accident of this command.
  expect(undocked.groups).toHaveLength(1);
  expect(getInfiniteCanvasGroupWindowIds(undocked.groups[0]!.tree)).toEqual(["east"]);
  // What the verb actually promises: the window is out, and free to dock again.
  expect(isInfiniteCanvasCommandEnabled(undocked, { type: "window.undock" })).toBe(false);
  expect(
    isInfiniteCanvasCommandEnabled(undocked, { direction: "right", type: "window.dockDirection" }),
  ).toBe(true);
});

test("DOCK-006 — a docked window cannot dock again, and a lone window has nowhere to dock", () => {
  // A window lives in at most one tree. The pointer path refuses a grouped source outright;
  // the keyboard path must refuse it too, or the two gestures disagree about what is legal.
  const docked = executeInfiniteCanvasCommand(twoFloating(), {
    direction: "right",
    type: "window.dockDirection",
  });

  expect(
    isInfiniteCanvasCommandEnabled(docked, { direction: "left", type: "window.dockDirection" }),
  ).toBe(false);

  const alone: InfiniteCanvasState<Kind> = {
    ...createInfiniteCanvasState<Kind>({ windows: [windowAt("solo", 0, 0)] }),
    activeWindowId: "solo",
    viewport: { height: 800, width: 1200 },
  };

  expect(
    isInfiniteCanvasCommandEnabled(alone, { direction: "right", type: "window.dockDirection" }),
  ).toBe(false);
});

// ── TAB-003 / SPLIT-006 — the group's shape is editable ──────────────────────────────────

/**
 * `setInfiniteCanvasGroupLayoutMode` was reachable only through the actions facade, and
 * `setInfiniteCanvasGroupAxis` was reachable by nothing at all — dead since it was written:
 * no action variant, no store method, no command. So a user could dock windows into a split
 * and then never change what that split was, which is half of what a tiling layout is for.
 *
 * These assert the *solved* layout rather than the tree field, because setting `layout` on a
 * node is not the claim — what reaches the screen is.
 */

const dockedPair = () =>
  executeInfiniteCanvasCommand(
    {
      ...createInfiniteCanvasState<Kind>({
        windows: [windowAt("west", 0, 0), windowAt("east", 400, 0)],
      }),
      activeWindowId: "west",
      viewport: { height: 800, width: 1200 },
    },
    { direction: "right", type: "window.dockDirection" },
  );

test("SPLIT-006 — flipping the axis turns a row of panes into a column", () => {
  const state = dockedPair();
  const row = getInfiniteCanvasGroupProjection(state.groups).windowRects;

  // A horizontal split: panes differ in x, share y.
  expect(row.get("west")!.x).not.toBe(row.get("east")!.x);
  expect(row.get("west")!.y).toBe(row.get("east")!.y);
  expect(isInfiniteCanvasCommandEnabled(state, { type: "group.flipAxis" })).toBe(true);

  const flipped = executeInfiniteCanvasCommand(state, { type: "group.flipAxis" });
  const column = getInfiniteCanvasGroupProjection(flipped.groups).windowRects;

  expect(column.get("west")!.x).toBe(column.get("east")!.x);
  expect(column.get("west")!.y).not.toBe(column.get("east")!.y);
  // Turning the panes must not move or resize the shell they live in.
  expect(flipped.groups[0]!.rect).toEqual(state.groups[0]!.rect);
});

test("SPLIT-006 — flipping twice returns the original layout", () => {
  const state = dockedPair();
  const once = executeInfiniteCanvasCommand(state, { type: "group.flipAxis" });
  const twice = executeInfiniteCanvasCommand(once, { type: "group.flipAxis" });

  expect(getInfiniteCanvasGroupProjection(twice.groups).windowRects).toEqual(
    getInfiniteCanvasGroupProjection(state.groups).windowRects,
  );
});

test("TAB-003 — converting a split to tabs hides all but one pane, keeping every member", () => {
  const state = dockedPair();

  expect(isInfiniteCanvasCommandEnabled(state, { layout: "tabs", type: "group.setLayout" })).toBe(
    true,
  );

  const tabbed = executeInfiniteCanvasCommand(state, { layout: "tabs", type: "group.setLayout" });
  const projection = getInfiniteCanvasGroupProjection(tabbed.groups);

  // TAB-002's claim — membership survives — now reachable by a user rather than only by a
  // consumer calling the action directly.
  expect(getInfiniteCanvasGroupWindowIds(tabbed.groups[0]!.tree).toSorted()).toEqual([
    "east",
    "west",
  ]);
  expect(projection.hiddenWindowIds.size).toBe(1);
});

test("TAB-003 — a split converted to tabs gets a live active child rather than an empty strip", () => {
  // `setInfiniteCanvasGroupLayoutMode` writes `layout` and nothing else, so a split — whose
  // `activeChildId` is always null — would convert into a tab group with no visible pane if
  // normalization did not fill one in. This is the reason that guarantee exists.
  const tabbed = executeInfiniteCanvasCommand(dockedPair(), {
    layout: "tabs",
    type: "group.setLayout",
  });
  const container = tabbed.groups[0]!.tree as InfiniteCanvasGroupContainerNode;

  expect(container.activeChildId).not.toBeNull();
  expect(getInfiniteCanvasGroupProjection(tabbed.groups).windowRects.size).toBe(2);
});

test("TAB-003 — the layout a container already has is not offered, and tabs cannot be flipped", () => {
  const state = dockedPair();

  expect(isInfiniteCanvasCommandEnabled(state, { layout: "split", type: "group.setLayout" })).toBe(
    false,
  );

  const tabbed = executeInfiniteCanvasCommand(state, { layout: "tabs", type: "group.setLayout" });

  // A tab strip lays out horizontally whatever its container's axis says, so offering a flip
  // there would present a verb whose effect is invisible until you convert back.
  expect(isInfiniteCanvasCommandEnabled(tabbed, { type: "group.flipAxis" })).toBe(false);
  expect(isInfiniteCanvasCommandEnabled(tabbed, { layout: "tabs", type: "group.setLayout" })).toBe(
    false,
  );
});

// ── DOCK-007 / TAB-004 — membership is editable without a pointer ────────────────────────

test("DOCK-007 — dissolving a split leaves every member floating exactly where it was drawn", () => {
  // `group.close` existed in the reducer and was dispatched from nowhere but the actions
  // facade, so a user could build a group and never take it apart except by undocking one
  // member at a time.
  // Built through the real docking path rather than from `groupedState()`, which hand-builds
  // `groups` without running `syncInfiniteCanvasGroupWindowRects` — so its windows still carry
  // their seed rects and could not show this invariant at all.
  const state = dockedPair();
  const drawn = getInfiniteCanvasGroupProjection(state.groups).windowRects;

  expect(isInfiniteCanvasCommandEnabled(state, { type: "group.dissolve" })).toBe(true);

  const dissolved = executeInfiniteCanvasCommand(state, { type: "group.dissolve" });

  expect(dissolved.groups).toEqual([]);

  // Nothing jumps: each member keeps the rect the solver last gave it.
  for (const window of dissolved.windows) {
    expect(window.rect).toEqual(drawn.get(window.id));
  }

  expect(isInfiniteCanvasCommandEnabled(dissolved, { type: "group.dissolve" })).toBe(false);
});

test("DOCK-007 — dissolving a tab group stacks its members, which is faithful rather than tidy", () => {
  // Recorded because it is a real product consequence, not because it is desirable. Tab and
  // accordion members all carry the shell's content rect — the rect they would occupy if
  // revealed — so ungrouping five tabs yields five windows in an exact pile. That is
  // `closeInfiniteCanvasGroup` behaving as it always has; this command exposes it rather
  // than changing it, and giving dissolve a fan-out is a separate decision about shared
  // semantics that should not be smuggled in here.
  const tabbed = executeInfiniteCanvasCommand(dockedPair(), {
    layout: "tabs",
    type: "group.setLayout",
  });
  const dissolved = executeInfiniteCanvasCommand(tabbed, { type: "group.dissolve" });
  const [first, second] = dissolved.windows;

  expect(dissolved.groups).toEqual([]);
  expect(first?.rect).toEqual(second?.rect);
});

test("TAB-004 — a pane can be moved through its container's order by keyboard", () => {
  // Reordering existed only as a tab drag (TAB-001), so the order of a group's members was
  // pointer-only in exactly the way docking was.
  const state = { ...groupedState(), activeWindowId: "left" };
  const order = (candidate: InfiniteCanvasState<Kind>) =>
    getInfiniteCanvasGroupWindowIds(candidate.groups[0]!.tree);

  expect(order(state)).toEqual(["left", "right"]);

  const moved = executeInfiniteCanvasCommand(state, { toward: "end", type: "group.moveChild" });

  expect(order(moved)).toEqual(["right", "left"]);
  expect(
    order(executeInfiniteCanvasCommand(moved, { toward: "start", type: "group.moveChild" })),
  ).toEqual(["left", "right"]);
});

test("TAB-004 — the ends of the order are not offered, because the move would clamp", () => {
  // Clamped rather than wrapping: a pane at the end that jumped to the front would read as a
  // bug, and the drag this mirrors cannot wrap either.
  const atStart = dockedPair();

  expect(
    isInfiniteCanvasCommandEnabled(atStart, { toward: "start", type: "group.moveChild" }),
  ).toBe(false);
  expect(isInfiniteCanvasCommandEnabled(atStart, { toward: "end", type: "group.moveChild" })).toBe(
    true,
  );

  const atEnd = { ...dockedPair(), activeWindowId: "east" };

  expect(isInfiniteCanvasCommandEnabled(atEnd, { toward: "end", type: "group.moveChild" })).toBe(
    false,
  );
});
