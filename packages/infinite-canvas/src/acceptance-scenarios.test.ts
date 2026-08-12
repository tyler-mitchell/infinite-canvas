import { expect, test } from "vite-plus/test";

import { getInfiniteCanvasContextualCommands } from "./commands";
import { DEFAULT_INFINITE_CANVAS_SNAP_POLICY } from "./constants";
import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import {
  DEFAULT_INFINITE_CANVAS_GROUP_METRICS,
  getInfiniteCanvasGroupMinimumSize,
  MINIMUM_GROUP_PANE_EXTENT,
} from "./group-layout";
import { getInfiniteCanvasGroupProjection } from "./group-state";
import { createInfiniteCanvasGroupWindowNode, getInfiniteCanvasGroupWindowIds } from "./group-tree";
import type { InfiniteCanvasGroupContainerNode } from "./group-tree";
import {
  beginInfiniteCanvasGroupMove,
  beginInfiniteCanvasGroupResize,
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
import { screenPointToWorldPoint } from "./geometry";
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

// ── FOCUS-004 — building a selection without a pointer ───────────────────────────────────

/**
 * The arrange family needs two or more selected windows: six aligns, two distributes, and
 * swap. Until 2026-08-12 a keyboard user could not produce one — `window.focusDirection`
 * calls `focusWindow`, which *replaces* the selection with the window it focuses, and the
 * only other selection commands were "clear" and "select all visible". Every arrange verb
 * was listed in the palette and unusable in practice.
 */

const threeInARow = (): InfiniteCanvasState<Kind> => ({
  ...createInfiniteCanvasState<Kind>({
    windows: [windowAt("a", 0, 0), windowAt("b", 400, 0), windowAt("c", 800, 0)],
  }),
  activeWindowId: "a",
  viewport: { height: 800, width: 1600 },
});

test("FOCUS-004 — ordinary directional focus replaces the selection, as a click does", () => {
  // Not a defect, and worth pinning: this is what a pointer click does too, and it is why a
  // second verb was needed rather than a change to this one.
  const moved = executeInfiniteCanvasCommand(threeInARow(), {
    direction: "right",
    type: "window.focusDirection",
  });

  expect(moved.selection.windowIds).toEqual(["b"]);
});

test("FOCUS-004 — extending keeps what was selected and adds the neighbour", () => {
  const state = threeInARow();

  expect(
    isInfiniteCanvasCommandEnabled(state, {
      direction: "right",
      type: "selection.extendDirection",
    }),
  ).toBe(true);

  const extended = executeInfiniteCanvasCommand(state, {
    direction: "right",
    type: "selection.extendDirection",
  });

  expect([...extended.selection.windowIds].toSorted()).toEqual(["a", "b"]);
  // Focus must actually move, or a second extend would re-target the same neighbour. The
  // active window comes from the selection anchor, which is why the target is added before
  // it is focused rather than after.
  expect(extended.activeWindowId).toBe("b");

  const twice = executeInfiniteCanvasCommand(extended, {
    direction: "right",
    type: "selection.extendDirection",
  });

  expect([...twice.selection.windowIds].toSorted()).toEqual(["a", "b", "c"]);
  expect(twice.activeWindowId).toBe("c");
});

test("FOCUS-004 — a keyboard-built selection makes the arrange verbs usable", () => {
  // The point of the whole thing. Two extends, then an align — the sequence that was
  // impossible without a pointer.
  const selected = executeInfiniteCanvasCommand(threeInARow(), {
    direction: "right",
    type: "selection.extendDirection",
  });

  expect(isInfiniteCanvasCommandEnabled(selected, { alignment: "top", type: "window.align" })).toBe(
    true,
  );

  const aligned = executeInfiniteCanvasCommand(selected, {
    alignment: "top",
    type: "window.align",
  });
  const tops = aligned.windows
    .filter((window) => ["a", "b"].includes(window.id))
    .map((window) => window.rect.y);

  expect(new Set(tops).size).toBe(1);
});

test("FOCUS-004 — extending is not offered where there is no neighbour", () => {
  const atEdge = { ...threeInARow(), activeWindowId: "c" };

  expect(
    isInfiniteCanvasCommandEnabled(atEdge, {
      direction: "right",
      type: "selection.extendDirection",
    }),
  ).toBe(false);
});

// ── SPLIT-004 — resizing the shell by its outer edge ─────────────────────────────────────

/**
 * The last `built` entry in the split family: "works when tried; nothing guards it". Its
 * three claims are asserted here for the first time — members re-project, no pane falls
 * below the structural floor, and the drag is one undo entry.
 *
 * The floor is the interesting one. It is captured at drag start and comes from the *tree*,
 * not from any member's `minSize`: a shell holding three panes and two gutters cannot be
 * dragged down to one pane's minimum, because the gutters and the panes beside it still
 * need their extent.
 */

const groupMinimum = () =>
  getInfiniteCanvasGroupMinimumSize(splitTree(), DEFAULT_INFINITE_CANVAS_GROUP_METRICS);

test("SPLIT-004 — resizing the shell re-projects every member onto the new rect", () => {
  const state = groupedState();
  const resizing = beginInfiniteCanvasGroupResize(
    state,
    POINTER,
    state.groups[0]!,
    "south-east",
    groupMinimum(),
    { x: 800, y: 400 },
  );
  const resized = stepCanvasInteraction(resizing, POINTER, { x: 1000, y: 500 });

  expect(resized.groups[0]!.rect.width).toBeGreaterThan(state.groups[0]!.rect.width);

  // The claim is not that the shell grew. It is that a member's rect is never anything but
  // the solver's answer for the shell it is in — the invariant the whole projection exists
  // to hold, checked here against a rect that just changed underneath it.
  const solved = getInfiniteCanvasGroupProjection(resized.groups).windowRects;

  for (const window of resized.windows) {
    expect(window.rect).toEqual(solved.get(window.id));
  }
});

test("SPLIT-004 — the shell cannot be dragged below the floor its tree needs", () => {
  const state = groupedState();
  const minimum = groupMinimum();

  // The floor must exceed a single pane's extent, or the assertions below would hold for a
  // floor that had forgotten the second pane and the gutter between them. Two panes at 48
  // plus a 6px gutter is 102.
  expect(minimum.width).toBeGreaterThan(MINIMUM_GROUP_PANE_EXTENT);

  const resizing = beginInfiniteCanvasGroupResize(
    state,
    POINTER,
    state.groups[0]!,
    "south-east",
    minimum,
    { x: 800, y: 400 },
  );
  // Far past the floor, and from the south-east handle so both axes clamp at once.
  const crushed = stepCanvasInteraction(resizing, POINTER, { x: -5000, y: -5000 });

  expect(crushed.groups[0]!.rect.width).toBe(minimum.width);
  expect(crushed.groups[0]!.rect.height).toBe(minimum.height);

  // The floor is structural, so it must leave room for every pane rather than merely for one.
  for (const rect of getInfiniteCanvasGroupProjection(crushed.groups).windowRects.values()) {
    expect(rect.width).toBeGreaterThanOrEqual(MINIMUM_GROUP_PANE_EXTENT);
    expect(rect.height).toBeGreaterThanOrEqual(MINIMUM_GROUP_PANE_EXTENT);
  }
});

test("SPLIT-004 — a whole shell resize is one undo entry, however many steps it takes", () => {
  // Through the reducer, because history lives there: `interaction.step` never records, and
  // the checkpoint is taken when the drag begins. A drag that recorded per step would bury
  // every earlier action under a hundred entries.
  const started = reduceInfiniteCanvasState(groupedState(), {
    groupId: "shell",
    handle: "south-east",
    minSize: groupMinimum(),
    point: { x: 800, y: 400 },
    pointerId: POINTER,
    type: "interaction.startGroupResize",
  });
  const dragged = [900, 950, 1000, 1050].reduce(
    (current, x) =>
      reduceInfiniteCanvasState(current, {
        point: { x, y: 450 },
        pointerId: POINTER,
        type: "interaction.step",
      }),
    started,
  );
  const finished = reduceInfiniteCanvasState(dragged, {
    pointerId: POINTER,
    type: "interaction.finish",
  });

  expect(finished.history.past).toHaveLength(1);
});

// ── FLOAT-001 — movement across the zoom range ───────────────────────────────────────────

/**
 * The scenario asks for a move at 0.25x, 1x and 4x with "no hidden zoom-coupled thresholds".
 * It stood at `partial` because reducer tests moved a window at *a* non-default zoom and
 * never swept the range — and a threshold that misbehaves at one end is invisible to a test
 * that only samples the middle.
 *
 * That failure mode is not hypothetical here. Two zoom-coupled defects surfaced on
 * 2026-08-12 alone: `hitRadius` was measured in world units, so edges became unclickable as
 * you zoomed out, and the semantic-LOD band stranded every stock window at 100%. Both were
 * arithmetic that looked right at one zoom.
 *
 * Snapping is disabled throughout. It is a real zoom-coupled threshold, deliberately so, and
 * SNAP-001 already asserts it engages at a fixed *screen* distance; leaving it on here would
 * test that instead of movement.
 */

const UNSNAPPED = { ...DEFAULT_INFINITE_CANVAS_SNAP_POLICY, enabled: false };

const soloAtZoom = (zoom: number): InfiniteCanvasState<Kind> => ({
  ...createInfiniteCanvasState<Kind>({ windows: [windowAt("solo", 0, 0)] }),
  camera: { center: { x: 0, y: 0 }, zoom },
  viewport: { height: 800, width: 1200 },
});

test("FLOAT-001 — a drag covers the world distance the camera says it should, at every zoom", () => {
  // 240 screen pixels is 960 world units at 0.25x and 60 at 4x. The relationship is the
  // camera's definition, and a move that quietly clamped, rounded, or bailed at one end of
  // the range would break it there and nowhere else.
  for (const zoom of [0.12, 0.25, 0.5, 1, 2, 4, 8]) {
    const state = soloAtZoom(zoom);
    const grabbed = beginWindowMove(state, POINTER, "solo", { x: 600, y: 400 });
    const moved = stepCanvasInteraction(grabbed, POINTER, { x: 840, y: 520 }, UNSNAPPED);

    expect(moved.windows[0]!.rect.x).toBeCloseTo(240 / zoom, 5);
    expect(moved.windows[0]!.rect.y).toBeCloseTo(120 / zoom, 5);
  }
});

test("FLOAT-001 — the same pointer travel moves a window the same distance on screen", () => {
  // The user-facing form of the claim: a drag feels identical zoomed in and out. World
  // distance times zoom is screen distance, so this is the previous assertion read from the
  // other side — and it is the side a person would notice.
  for (const zoom of [0.25, 1, 4]) {
    const state = soloAtZoom(zoom);
    const grabbed = beginWindowMove(state, POINTER, "solo", { x: 600, y: 400 });
    const moved = stepCanvasInteraction(grabbed, POINTER, { x: 700, y: 400 }, UNSNAPPED);

    expect(moved.windows[0]!.rect.x * zoom).toBeCloseTo(100, 5);
  }
});

test("FLOAT-001 — a drag is continuous: many small steps land where one large step does", () => {
  // A per-step threshold — a minimum travel to register, a rounding to whole world units —
  // would show up as drift between these two, and would be worst at high zoom where each
  // step is a fraction of a world unit.
  for (const zoom of [0.25, 1, 4]) {
    const grabbed = beginWindowMove(soloAtZoom(zoom), POINTER, "solo", { x: 600, y: 400 });
    const oneStep = stepCanvasInteraction(grabbed, POINTER, { x: 700, y: 400 }, UNSNAPPED);
    const manySteps = Array.from({ length: 20 }, (_, index) => 605 + index * 5).reduce(
      (current, x) => stepCanvasInteraction(current, POINTER, { x, y: 400 }, UNSNAPPED),
      grabbed,
    );

    expect(manySteps.windows[0]!.rect.x).toBeCloseTo(oneStep.windows[0]!.rect.x, 5);
  }
});

// ── FAIL-001's sibling — a zoom during a pan ─────────────────────────────────────────────

/**
 * The friction backlog records this fix and says of it: "Unobserved in a browser, like its
 * sibling." Its sibling has been asserted since C2; this one never was.
 *
 * The bug: the pan step wrote `camera: { ...interaction.originCamera, center }`, spreading
 * the pan-start **zoom** into every frame. The wheel handler is not gated on an active
 * interaction, so a zoom fired mid-pan was overwritten on the very next pointermove —
 * snapping back and discarding it. Narrow, since it needs a held pan plus a pinch or
 * Ctrl+wheel, and entirely real.
 */

test("FAIL-001 sibling — a zoom fired mid-pan survives the next pan step", () => {
  const state: InfiniteCanvasState<Kind> = {
    ...createInfiniteCanvasState<Kind>({ windows: [windowAt("solo", 0, 0)] }),
    viewport: { height: 800, width: 1200 },
  };
  const panning = reduceInfiniteCanvasState(state, {
    clearSelection: false,
    point: { x: 600, y: 400 },
    pointerId: POINTER,
    type: "interaction.startPan",
  });
  const zoomed = reduceInfiniteCanvasState(panning, {
    anchor: { x: 600, y: 400 },
    type: "camera.zoomAt",
    zoom: 2,
  });

  expect(zoomed.camera.zoom).toBe(2);

  const stepped = stepCanvasInteraction(zoomed, POINTER, { x: 700, y: 400 });

  // The whole bug in one assertion: the old step spread the pan-start camera and this came
  // back 1.
  expect(stepped.camera.zoom).toBe(2);
});

test("FAIL-001 sibling — the world point grabbed at pan-start stays under the cursor", () => {
  // Stronger than "the zoom survived": panning's own invariant is that the world does not
  // slide under your finger. A step that kept the new zoom but re-projected against the old
  // one would pass the test above and still tear the canvas away.
  const state: InfiniteCanvasState<Kind> = {
    ...createInfiniteCanvasState<Kind>({ windows: [windowAt("solo", 0, 0)] }),
    viewport: { height: 800, width: 1200 },
  };
  const grabPoint = { x: 500, y: 300 };
  const panning = reduceInfiniteCanvasState(state, {
    clearSelection: false,
    point: grabPoint,
    pointerId: POINTER,
    type: "interaction.startPan",
  });
  const grabbedWorldPoint = screenPointToWorldPoint(state.camera, state.viewport, grabPoint);
  const zoomed = reduceInfiniteCanvasState(panning, {
    anchor: { x: 900, y: 600 },
    type: "camera.zoomAt",
    zoom: 3,
  });
  const releasePoint = { x: 640, y: 380 };
  const stepped = stepCanvasInteraction(zoomed, POINTER, releasePoint);
  const underCursor = screenPointToWorldPoint(stepped.camera, stepped.viewport, releasePoint);

  expect(underCursor.x).toBeCloseTo(grabbedWorldPoint.x, 5);
  expect(underCursor.y).toBeCloseTo(grabbedWorldPoint.y, 5);
});

test("FAIL-001 sibling — a pan with no zoom change is unaffected by the generalization", () => {
  // The backlog calls the fix "a strict generalization, not a rewrite": with the zoom
  // unchanged it must reduce to `originCamera.center - screenDelta / zoom` exactly. A pan of
  // 240 screen pixels at zoom 1 moves the camera 240 world units against the drag.
  const state: InfiniteCanvasState<Kind> = {
    ...createInfiniteCanvasState<Kind>({ windows: [windowAt("solo", 0, 0)] }),
    viewport: { height: 800, width: 1200 },
  };
  const panning = reduceInfiniteCanvasState(state, {
    clearSelection: false,
    point: { x: 600, y: 400 },
    pointerId: POINTER,
    type: "interaction.startPan",
  });
  const stepped = stepCanvasInteraction(panning, POINTER, { x: 840, y: 400 });

  expect(stepped.camera.zoom).toBe(1);
  expect(stepped.camera.center.x).toBeCloseTo(-240, 5);
});

// ── SPLIT-007 — adjusting a seam without a pointer ───────────────────────────────────────

/**
 * `groupGutter` was the last pointer-only interaction kind with no keyboard form. A keyboard
 * user could equalize a container — reset every pane to the same share — but could not make
 * one pane bigger than another, which is the thing you most often want from a docked layout.
 *
 * The command drives the *same* `getInfiniteCanvasGroupGutterWeights` the drag drives, with
 * the same `availableExtent` taken from the solved layout rather than re-derived. The layout
 * module says why in its own words: "re-deriving it at the call site is how the seam drifts
 * away from the cursor". A keyboard step has no cursor to drift from, but it has to land on
 * the weights the drag would, or the two gestures disagree about what a seam is.
 */

test("SPLIT-007 — growing a pane takes share from the sibling beside it", () => {
  const state = dockedPair();
  const before = getInfiniteCanvasGroupProjection(state.groups).windowRects;

  expect(before.get("west")!.width).toBe(before.get("east")!.width);
  expect(isInfiniteCanvasCommandEnabled(state, { amountPx: 24, type: "group.resizePane" })).toBe(
    true,
  );

  const grown = executeInfiniteCanvasCommand(state, { amountPx: 24, type: "group.resizePane" });
  const after = getInfiniteCanvasGroupProjection(grown.groups).windowRects;

  expect(after.get("west")!.width).toBeGreaterThan(before.get("west")!.width);
  expect(after.get("east")!.width).toBeLessThan(before.get("east")!.width);
  // A seam redistributes inside the shell; the shell itself must not move or resize.
  expect(grown.groups[0]!.rect).toEqual(state.groups[0]!.rect);
});

test("SPLIT-007 — shrinking is the inverse, and the two round-trip", () => {
  const state = dockedPair();
  const roundTripped = executeInfiniteCanvasCommand(
    executeInfiniteCanvasCommand(state, { amountPx: 24, type: "group.resizePane" }),
    { amountPx: -24, type: "group.resizePane" },
  );
  const widths = getInfiniteCanvasGroupProjection(roundTripped.groups).windowRects;

  expect(widths.get("west")!.width).toBeCloseTo(
    getInfiniteCanvasGroupProjection(state.groups).windowRects.get("west")!.width,
    5,
  );
});

test("SPLIT-007 — the last pane grows by taking from the one before it", () => {
  // There is no seam after the last child, so growing it means pushing the seam that sits
  // before it *backwards*. Getting that sign wrong would shrink the pane the user asked to
  // grow — the failure would look like the command working in reverse.
  const state = { ...dockedPair(), activeWindowId: "east" };
  const before = getInfiniteCanvasGroupProjection(state.groups).windowRects;
  const grown = executeInfiniteCanvasCommand(state, { amountPx: 24, type: "group.resizePane" });
  const after = getInfiniteCanvasGroupProjection(grown.groups).windowRects;

  expect(after.get("east")!.width).toBeGreaterThan(before.get("east")!.width);
});

test("SPLIT-007 — a floating window has no seam to push", () => {
  const floating: InfiniteCanvasState<Kind> = {
    ...createInfiniteCanvasState<Kind>({ windows: [windowAt("solo", 0, 0)] }),
    activeWindowId: "solo",
    viewport: { height: 800, width: 1200 },
  };

  expect(isInfiniteCanvasCommandEnabled(floating, { amountPx: 24, type: "group.resizePane" })).toBe(
    false,
  );
});

test("SPLIT-007 — the seam travels the same distance on screen at any zoom", () => {
  // The invariant is the *screen* distance, not the resulting share, and the first draft of
  // this test asserted the share. It cannot be zoom-invariant: `availableExtent` is world
  // units and the shell does not shrink when you zoom out, so at 0.25 the container occupies
  // a quarter of the screen it did and 24 screen pixels is four times the fraction of it.
  //
  // That is exactly what dragging the seam does — it follows the cursor, so 24 pixels of
  // travel is 24 pixels of seam movement whatever the zoom, and the share moves by however
  // much that turns out to be. Matching the drag is the whole point.
  const screenGrowth = [0.25, 1, 4].map((zoom) => {
    const state = { ...dockedPair(), camera: { center: { x: 0, y: 0 }, zoom } };
    const before = getInfiniteCanvasGroupProjection(state.groups).windowRects.get("west")!.width;
    const grown = executeInfiniteCanvasCommand(state, { amountPx: 24, type: "group.resizePane" });
    const after = getInfiniteCanvasGroupProjection(grown.groups).windowRects.get("west")!.width;

    return (after - before) * zoom;
  });

  for (const growth of screenGrowth) {
    expect(growth).toBeCloseTo(24, 5);
  }
});
