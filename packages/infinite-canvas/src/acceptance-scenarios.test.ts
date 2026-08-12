import { expect, test } from "vite-plus/test";

import { getInfiniteCanvasContextualCommands } from "./commands";
import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import { getInfiniteCanvasGroupProjection } from "./group-state";
import { createInfiniteCanvasGroupWindowNode } from "./group-tree";
import type { InfiniteCanvasGroupContainerNode } from "./group-tree";
import {
  beginInfiniteCanvasGroupMove,
  beginWindowMove,
  stepCanvasInteraction,
} from "./interaction";
import { parseInfiniteCanvasState, serializeInfiniteCanvasState } from "./persistence";
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
