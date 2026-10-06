import { getSelectedWindowIds } from "./selection";
import { expect, test } from "vite-plus/test";

import { getInfiniteCanvasContextualCommands } from "./operations";
import { DEFAULT_INFINITE_CANVAS_SNAP_POLICY } from "./constants";
import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import {
  DEFAULT_INFINITE_CANVAS_GROUP_METRICS,
  getInfiniteCanvasGroupMinimumSize,
  MINIMUM_GROUP_PANE_EXTENT,
} from "./layout";
import { getCanvasLayout } from "./layout";
import { createInfiniteCanvasGroupWindowNode, getInfiniteCanvasGroupWindowIds } from "./group-tree";
import type { InfiniteCanvasGroupContainerNode } from "./group-tree";
import { beginInfiniteCanvasGroupResize, beginMove, stepCanvasInteraction } from "./interaction";
import { createInfiniteCanvasStore } from "./store";
import { isInfiniteCanvasCommandEnabled } from "./operations";
import { reduceInfiniteCanvasState } from "./operations";
import {
  getInfiniteCanvasContextualGroup,
  getInfiniteCanvasDirectionalFocusTarget,
} from "./window-focus";
import { screenPointToWorldPoint } from "./geometry";
import { getInfiniteCanvasWindowPlacementRect } from "./window-placement";
import type { InfiniteCanvasGroup, InfiniteCanvasState } from "./types";

type Kind = "pane";

const POINTER = 1;

const windowAt = (id: string, x: number, y: number) =>
  createInfiniteCanvasWindow<Kind>({
    id,
    kind: "pane",
    rect: { height: 200, width: 300, x, y },
    title: id,
  });

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
  const state = groupedState();
  const before = getCanvasLayout(state).windowRects;
  const moving = beginMove({
    currentState: state,
    pointerId: POINTER,
    target: { type: "group", id: state.groups[0]!.id },
    point: { x: 100, y: 100 },
  });
  const moved = stepCanvasInteraction(moving, POINTER, { x: 340, y: 190 });

  const shellDelta = {
    x: moved.groups[0]!.rect.x - state.groups[0]!.rect.x,
    y: moved.groups[0]!.rect.y - state.groups[0]!.rect.y,
  };

  expect(shellDelta).toEqual({ x: 240, y: 90 });

  const after = getCanvasLayout(moved).windowRects;

  for (const [windowId, rect] of after) {
    const original = before.get(windowId);

    expect(original).toBeDefined();
    expect(rect.x - original!.x).toBe(shellDelta.x);
    expect(rect.y - original!.y).toBe(shellDelta.y);
  }
});

test("DOCK-003 — moving a shell never touches its tree", () => {
  const state = groupedState();
  const moving = beginMove({
    currentState: state,
    pointerId: POINTER,
    target: { type: "group", id: state.groups[0]!.id },
    point: { x: 0, y: 0 },
  });
  const moved = stepCanvasInteraction(moving, POINTER, { x: 500, y: 0 });

  expect(moved.groups[0]!.tree).toBe(state.groups[0]!.tree);
});

test("SPLIT-001 — reweighting a seam changes the solved rects, with no DOM anywhere", () => {
  const state = groupedState();
  const even = getCanvasLayout(state).windowRects;

  expect(even.get("left")!.width).toBe(even.get("right")!.width);

  const reweighted = reduceInfiniteCanvasState(state, {
    containerId: "shell::root",
    groupId: "shell",
    type: "group.setChildWeights",
    weights: { left: 3, right: 1 },
  });
  const skewed = getCanvasLayout(reweighted).windowRects;

  expect(skewed.get("left")!.width / skewed.get("right")!.width).toBeCloseTo(3, 5);
  expect(reweighted.groups[0]!.rect).toEqual(state.groups[0]!.rect);
});

test("FAIL-001 — a zoom mid-drag does not slide the window out from under the cursor", () => {
  const state: InfiniteCanvasState<Kind> = {
    ...createInfiniteCanvasState<Kind>({ windows: [windowAt("solo", 0, 0)] }),
    viewport: { height: 800, width: 1200 },
  };

  const grabbed = beginMove({
    currentState: state,
    pointerId: POINTER,
    target: { type: "window", id: "solo" },
    point: { x: 600, y: 400 },
  });
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
  const state: InfiniteCanvasState<Kind> = {
    ...createInfiniteCanvasState<Kind>({ windows: [windowAt("solo", 0, 0)] }),
    viewport: { height: 800, width: 1200 },
  };
  const grabPoint = { x: 600, y: 400 };
  const grabbed = beginMove({
    currentState: state,
    pointerId: POINTER,
    target: { type: "window", id: "solo" },
    point: grabPoint,
  });
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

function screenToWorldX(state: InfiniteCanvasState<Kind>, screenX: number): number {
  return state.camera.center.x + (screenX - state.viewport.width / 2) / state.camera.zoom;
}

test("PERSIST-001 — a cluster of floating windows and a tab group survives a round trip", () => {
  const base = createInfiniteCanvasState<Kind>({
    windows: [windowAt("left", 0, 0), windowAt("right", 400, 0), windowAt("floater", 900, 500)],
  });
  const state: InfiniteCanvasState<Kind> = {
    ...base,
    groups: [splitGroup({ ...splitTree(), activeChildId: "right", layout: "tabs" })],
  };

  const restored = createInfiniteCanvasStore({
    document: JSON.parse(
      JSON.stringify(createInfiniteCanvasStore({ initialState: state }).snapshot()),
    ),
  }).getState();

  expect(restored).not.toBeNull();
  expect(restored!.groups).toHaveLength(1);

  const tree = restored!.groups[0]!.tree;

  expect(tree.kind).toBe("container");
  expect(tree.kind === "container" && tree.layout).toBe("tabs");
  expect(tree.kind === "container" && tree.activeChildId).toBe("right");
  expect(tree.kind === "container" && tree.children.map((child) => child.id)).toEqual([
    "left",
    "right",
  ]);
  expect(restored!.groups[0]!.rect).toEqual(state.groups[0]!.rect);

  expect(restored!.windows.find((window) => window.id === "floater")?.rect).toEqual({
    height: 200,
    width: 300,
    x: 900,
    y: 500,
  });
});

test("FOCUS-001 — directional focus prefers a group-local neighbour over a nearer floater", () => {
  const base = createInfiniteCanvasState<Kind>({
    windows: [windowAt("left", 0, 0), windowAt("right", 400, 0), windowAt("floater", 320, 0)],
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

  expect(clamped.width).toBe(900);
  expect(clamped.x + clamped.width).toBe(bounds.x + bounds.width);
});

test("arrange verbs report themselves enabled when the selection actually supports them", () => {
  const state: InfiniteCanvasState<Kind> = {
    ...createInfiniteCanvasState<Kind>({
      windows: [windowAt("left", 0, 0), windowAt("right", 400, 0)],
    }),
    selection: {
      anchorTarget: { type: "window" as const, id: "right" },
      targets: [
        { type: "window" as const, id: "left" },
        { type: "window" as const, id: "right" },
      ],
    },
    viewport: { height: 800, width: 1200 },
  };

  const byId = new Map(
    getInfiniteCanvasContextualCommands(state).map((command) => [command.id, command]),
  );

  expect(byId.get("window.align.left")?.enabled).toBe(true);
  expect(byId.get("window.distribute.horizontal")?.enabled).toBe(false);
});

test("SPLIT-005 — equalize returns skewed panes to equal widths, and is offered only when it would", () => {
  const state = { ...groupedState(), activeWindowId: "left" };
  const even = getCanvasLayout(state).windowRects;

  expect(even.get("left")!.width).toBe(even.get("right")!.width);
  expect(isInfiniteCanvasCommandEnabled(state, { type: "group.equalizeChildren" })).toBe(false);

  const skewed = reduceInfiniteCanvasState(state, {
    containerId: "shell::root",
    groupId: "shell",
    type: "group.setChildWeights",
    weights: { left: 3, right: 1 },
  });

  expect(isInfiniteCanvasCommandEnabled(skewed, { type: "group.equalizeChildren" })).toBe(true);

  const equalized = reduceInfiniteCanvasState(skewed, { type: "group.equalizeChildren" });
  const restored = getCanvasLayout(equalized).windowRects;

  expect(restored.get("left")!.width).toBe(restored.get("right")!.width);
  expect(equalized.groups[0]!.rect).toEqual(state.groups[0]!.rect);
});

test("SPLIT-005 — equalize is unavailable to a window that is not docked", () => {
  const floating = createInfiniteCanvasState<Kind>({ windows: [windowAt("solo", 0, 0)] });

  expect(
    isInfiniteCanvasCommandEnabled(
      { ...floating, activeWindowId: "solo" },
      { type: "group.equalizeChildren" },
    ),
  ).toBe(false);
});

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

  const docked = reduceInfiniteCanvasState(state, {
    direction: "right",
    type: "window.dockDirection",
  });

  expect(docked.groups).toHaveLength(1);

  const rects = getCanvasLayout(docked).windowRects;

  expect(rects.get("west")!.x).toBeLessThan(rects.get("east")!.x);
});

test("DOCK-006 — a keyboard dock lands where the drag would, and the pair occupies the target's place", () => {
  const state = twoFloating();
  const targetRect = state.windows.find((window) => window.id === "east")!.rect;
  const docked = reduceInfiniteCanvasState(state, {
    direction: "right",
    type: "window.dockDirection",
  });

  expect(docked.groups[0]!.rect).toEqual(targetRect);
});

test("DOCK-006 — undocking frees the active window and leaves the shell holding its last member", () => {
  const docked = reduceInfiniteCanvasState(twoFloating(), {
    direction: "right",
    type: "window.dockDirection",
  });

  expect(isInfiniteCanvasCommandEnabled(docked, { type: "window.undock" })).toBe(true);

  const undocked = reduceInfiniteCanvasState(docked, { type: "window.undock" });

  expect(undocked.groups).toHaveLength(1);
  expect(getInfiniteCanvasGroupWindowIds(undocked.groups[0]!.tree)).toEqual(["east"]);
  expect(isInfiniteCanvasCommandEnabled(undocked, { type: "window.undock" })).toBe(false);
  expect(
    isInfiniteCanvasCommandEnabled(undocked, { direction: "right", type: "window.dockDirection" }),
  ).toBe(true);
});

test("DOCK-006 — a docked window cannot dock again, and a lone window has nowhere to dock", () => {
  const docked = reduceInfiniteCanvasState(twoFloating(), {
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

const dockedPair = () =>
  reduceInfiniteCanvasState(
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
  const row = getCanvasLayout(state).windowRects;

  expect(row.get("west")!.x).not.toBe(row.get("east")!.x);
  expect(row.get("west")!.y).toBe(row.get("east")!.y);
  expect(isInfiniteCanvasCommandEnabled(state, { type: "group.flipAxis" })).toBe(true);

  const flipped = reduceInfiniteCanvasState(state, { type: "group.flipAxis" });
  const column = getCanvasLayout(flipped).windowRects;

  expect(column.get("west")!.x).toBe(column.get("east")!.x);
  expect(column.get("west")!.y).not.toBe(column.get("east")!.y);
  expect(flipped.groups[0]!.rect).toEqual(state.groups[0]!.rect);
});

test("SPLIT-006 — flipping twice returns the original layout", () => {
  const state = dockedPair();
  const once = reduceInfiniteCanvasState(state, { type: "group.flipAxis" });
  const twice = reduceInfiniteCanvasState(once, { type: "group.flipAxis" });

  expect(getCanvasLayout(twice).windowRects).toEqual(getCanvasLayout(state).windowRects);
});

test("TAB-003 — converting a split to tabs hides all but one pane, keeping every member", () => {
  const state = dockedPair();

  expect(isInfiniteCanvasCommandEnabled(state, { layout: "tabs", type: "group.setLayout" })).toBe(
    true,
  );

  const tabbed = reduceInfiniteCanvasState(state, { layout: "tabs", type: "group.setLayout" });
  const canvasLayout = getCanvasLayout(tabbed);

  expect(getInfiniteCanvasGroupWindowIds(tabbed.groups[0]!.tree).toSorted()).toEqual([
    "east",
    "west",
  ]);
  expect(canvasLayout.hiddenWindowIds.size).toBe(1);
});

test("TAB-003 — a split converted to tabs gets a live active child rather than an empty strip", () => {
  const tabbed = reduceInfiniteCanvasState(dockedPair(), {
    layout: "tabs",
    type: "group.setLayout",
  });
  const container = tabbed.groups[0]!.tree as InfiniteCanvasGroupContainerNode;

  expect(container.activeChildId).not.toBeNull();
  expect(getCanvasLayout(tabbed).windowRects.size).toBe(2);
});

test("TAB-003 — the layout a container already has is not offered, and tabs cannot be flipped", () => {
  const state = dockedPair();

  expect(isInfiniteCanvasCommandEnabled(state, { layout: "split", type: "group.setLayout" })).toBe(
    false,
  );

  const tabbed = reduceInfiniteCanvasState(state, { layout: "tabs", type: "group.setLayout" });

  expect(isInfiniteCanvasCommandEnabled(tabbed, { type: "group.flipAxis" })).toBe(false);
  expect(isInfiniteCanvasCommandEnabled(tabbed, { layout: "tabs", type: "group.setLayout" })).toBe(
    false,
  );
});

test("DOCK-007 — dissolving a split leaves every member floating exactly where it was drawn", () => {
  const state = dockedPair();
  const drawn = getCanvasLayout(state).windowRects;

  expect(isInfiniteCanvasCommandEnabled(state, { type: "group.dissolve" })).toBe(true);

  const dissolved = reduceInfiniteCanvasState(state, { type: "group.dissolve" });

  expect(dissolved.groups).toEqual([]);

  for (const window of dissolved.windows) {
    expect(window.rect).toEqual(drawn.get(window.id));
  }

  expect(isInfiniteCanvasCommandEnabled(dissolved, { type: "group.dissolve" })).toBe(false);
});

test("DOCK-007 — dissolving a tab group fans its members out rather than piling them", () => {
  const tabbed = reduceInfiniteCanvasState(dockedPair(), {
    layout: "tabs",
    type: "group.setLayout",
  });
  const dissolved = reduceInfiniteCanvasState(tabbed, { type: "group.dissolve" });
  const [first, second] = dissolved.windows;
  const overlap =
    first !== undefined &&
    second !== undefined &&
    first.rect.x < second.rect.x + second.rect.width &&
    second.rect.x < first.rect.x + first.rect.width &&
    first.rect.y < second.rect.y + second.rect.height &&
    second.rect.y < first.rect.y + first.rect.height;

  expect(dissolved.groups).toEqual([]);
  expect(overlap).toBe(false);
  expect(first?.rect.width).toBe(second?.rect.width);
  expect(first?.rect.height).toBe(second?.rect.height);
});

test("TAB-004 — a pane can be moved through its container's order by keyboard", () => {
  const state = { ...groupedState(), activeWindowId: "left" };
  const order = (candidate: InfiniteCanvasState<Kind>) =>
    getInfiniteCanvasGroupWindowIds(candidate.groups[0]!.tree);

  expect(order(state)).toEqual(["left", "right"]);

  const moved = reduceInfiniteCanvasState(state, { toward: "end", type: "group.moveChild" });

  expect(order(moved)).toEqual(["right", "left"]);
  expect(
    order(reduceInfiniteCanvasState(moved, { toward: "start", type: "group.moveChild" })),
  ).toEqual(["left", "right"]);
});

test("TAB-004 — the ends of the order are not offered, because the move would clamp", () => {
  const atStart = dockedPair();

  expect(
    isInfiniteCanvasCommandEnabled(atStart, { toward: "start", type: "group.moveChild" }),
  ).toBe(false);
  expect(isInfiniteCanvasCommandEnabled(atStart, { toward: "end", type: "group.moveChild" })).toBe(
    true,
  );

  const atEnd = reduceInfiniteCanvasState(dockedPair(), {
    type: "selection.replace",
    targets: [{ type: "window" as const, id: "east" }],
  });

  expect(isInfiniteCanvasCommandEnabled(atEnd, { toward: "end", type: "group.moveChild" })).toBe(
    false,
  );
});

const threeInARow = (): InfiniteCanvasState<Kind> => ({
  ...createInfiniteCanvasState<Kind>({
    windows: [windowAt("a", 0, 0), windowAt("b", 400, 0), windowAt("c", 800, 0)],
  }),
  activeWindowId: "a",
  viewport: { height: 800, width: 1600 },
});

test("FOCUS-004 — ordinary directional focus replaces the selection, as a click does", () => {
  const moved = reduceInfiniteCanvasState(threeInARow(), {
    direction: "right",
    type: "window.focusDirection",
  });

  expect(getSelectedWindowIds(moved.selection)).toEqual(["b"]);
});

test("FOCUS-004 — extending keeps what was selected and adds the neighbour", () => {
  const state = threeInARow();

  expect(
    isInfiniteCanvasCommandEnabled(state, {
      direction: "right",
      type: "selection.extendDirection",
    }),
  ).toBe(true);

  const extended = reduceInfiniteCanvasState(state, {
    direction: "right",
    type: "selection.extendDirection",
  });

  expect([...getSelectedWindowIds(extended.selection)].toSorted()).toEqual(["a", "b"]);
  expect(extended.activeWindowId).toBe("b");

  const twice = reduceInfiniteCanvasState(extended, {
    direction: "right",
    type: "selection.extendDirection",
  });

  expect([...getSelectedWindowIds(twice.selection)].toSorted()).toEqual(["a", "b", "c"]);
  expect(twice.activeWindowId).toBe("c");
});

test("FOCUS-004 — a keyboard-built selection makes the arrange verbs usable", () => {
  const selected = reduceInfiniteCanvasState(threeInARow(), {
    direction: "right",
    type: "selection.extendDirection",
  });

  expect(isInfiniteCanvasCommandEnabled(selected, { alignment: "top", type: "window.align" })).toBe(
    true,
  );

  const aligned = reduceInfiniteCanvasState(selected, {
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

const groupMinimum = () =>
  getInfiniteCanvasGroupMinimumSize(splitTree(), DEFAULT_INFINITE_CANVAS_GROUP_METRICS);

test("SPLIT-004 — resizing the shell preserves member geometry", () => {
  const state = groupedState();
  const resizing = beginInfiniteCanvasGroupResize({
    currentState: state,
    groupId: state.groups[0]!.id,
    handle: "south-east",
    minSize: groupMinimum(),
    point: { x: 800, y: 400 },
    pointerId: POINTER,
  });
  const resized = stepCanvasInteraction(resizing, POINTER, { x: 1000, y: 500 });

  expect(getCanvasLayout(resized).groupRects.get(state.groups[0]!.id)!.width).toBeGreaterThan(
    state.groups[0]!.rect.width,
  );

  const solved = getCanvasLayout(resized).windowRects;
  const before = getCanvasLayout(state).windowRects;
  for (const id of getInfiniteCanvasGroupWindowIds(state.groups[0]!.tree)) {
    expect(solved.get(id)).toEqual(before.get(id));
  }
  expect(resized.windows.map(({ id, rect }) => ({ id, rect }))).toEqual(
    state.windows.map(({ id, rect }) => ({ id, rect })),
  );
});

test("SPLIT-004 — the shell uses the supplied minimum size", () => {
  const state = groupedState();
  const minimum = groupMinimum();

  expect(minimum.width).toBeGreaterThan(MINIMUM_GROUP_PANE_EXTENT);

  const resizing = beginInfiniteCanvasGroupResize({
    currentState: state,
    groupId: state.groups[0]!.id,
    handle: "south-east",
    minSize: minimum,
    point: { x: 800, y: 400 },
    pointerId: POINTER,
  });
  const crushed = stepCanvasInteraction(resizing, POINTER, { x: -5000, y: -5000 });

  expect(getCanvasLayout(crushed).groupRects.get(state.groups[0]!.id)!.width).toBe(minimum.width);
  expect(getCanvasLayout(crushed).groupRects.get(state.groups[0]!.id)!.height).toBe(minimum.height);

  for (const rect of getCanvasLayout(crushed).windowRects.values()) {
    expect(rect.width).toBeGreaterThanOrEqual(MINIMUM_GROUP_PANE_EXTENT);
    expect(rect.height).toBeGreaterThanOrEqual(MINIMUM_GROUP_PANE_EXTENT);
  }
});

test("SPLIT-004 — a whole shell resize is one undo entry, however many steps it takes", () => {
  const store = createInfiniteCanvasStore({ initialState: groupedState() });
  const before = getCanvasLayout(store.getState());
  store.dispatch({
    groupId: "shell",
    handle: "south-east",
    minSize: groupMinimum(),
    point: { x: 800, y: 400 },
    pointerId: POINTER,
    type: "interaction.startGroupResize",
  });
  for (const x of [900, 950, 1000, 1050]) {
    store.dispatch({
      point: { x, y: 450 },
      pointerId: POINTER,
      type: "interaction.step",
    });
  }
  store.dispatch({
    pointerId: POINTER,
    type: "interaction.finish",
  });

  expect(store.history.undos$.peek()).toBe(1);
  const after = getCanvasLayout(store.getState());
  expect(after.windowRects).toEqual(before.windowRects);
  expect(after.groupRects.get("shell")).not.toEqual(before.groupRects.get("shell"));
  store.dispatch({ type: "group.fitContents", groupId: "shell" });
  expect(getCanvasLayout(store.getState()).windowRects).toEqual(before.windowRects);
  expect(store.getState().groups[0]!.bounds).toBe("content");
});

const UNSNAPPED = { ...DEFAULT_INFINITE_CANVAS_SNAP_POLICY, enabled: false };

const soloAtZoom = (zoom: number): InfiniteCanvasState<Kind> => ({
  ...createInfiniteCanvasState<Kind>({ windows: [windowAt("solo", 0, 0)] }),
  camera: { center: { x: 0, y: 0 }, zoom },
  viewport: { height: 800, width: 1200 },
});

test("FLOAT-001 — a drag covers the world distance the camera says it should, at every zoom", () => {
  for (const zoom of [0.12, 0.25, 0.5, 1, 2, 4, 8]) {
    const state = soloAtZoom(zoom);
    const grabbed = beginMove({
      currentState: state,
      pointerId: POINTER,
      target: { type: "window", id: "solo" },
      point: { x: 600, y: 400 },
    });
    const moved = stepCanvasInteraction(grabbed, POINTER, { x: 840, y: 520 }, UNSNAPPED);

    expect(moved.windows[0]!.rect.x).toBeCloseTo(240 / zoom, 5);
    expect(moved.windows[0]!.rect.y).toBeCloseTo(120 / zoom, 5);
  }
});

test("FLOAT-001 — the same pointer travel moves a window the same distance on screen", () => {
  for (const zoom of [0.25, 1, 4]) {
    const state = soloAtZoom(zoom);
    const grabbed = beginMove({
      currentState: state,
      pointerId: POINTER,
      target: { type: "window", id: "solo" },
      point: { x: 600, y: 400 },
    });
    const moved = stepCanvasInteraction(grabbed, POINTER, { x: 700, y: 400 }, UNSNAPPED);

    expect(moved.windows[0]!.rect.x * zoom).toBeCloseTo(100, 5);
  }
});

test("FLOAT-001 — a drag is continuous: many small steps land where one large step does", () => {
  for (const zoom of [0.25, 1, 4]) {
    const grabbed = beginMove({
      currentState: soloAtZoom(zoom),
      pointerId: POINTER,
      target: { type: "window", id: "solo" },
      point: { x: 600, y: 400 },
    });
    const oneStep = stepCanvasInteraction(grabbed, POINTER, { x: 700, y: 400 }, UNSNAPPED);
    const manySteps = Array.from({ length: 20 }, (_, index) => 605 + index * 5).reduce(
      (current, x) => stepCanvasInteraction(current, POINTER, { x, y: 400 }, UNSNAPPED),
      grabbed,
    );

    expect(manySteps.windows[0]!.rect.x).toBeCloseTo(oneStep.windows[0]!.rect.x, 5);
  }
});

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

  expect(stepped.camera.zoom).toBe(2);
});

test("FAIL-001 sibling — the world point grabbed at pan-start stays under the cursor", () => {
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

test("SPLIT-007 — growing a pane takes share from the sibling beside it", () => {
  const state = dockedPair();
  const before = getCanvasLayout(state).windowRects;

  expect(before.get("west")!.width).toBe(before.get("east")!.width);
  expect(isInfiniteCanvasCommandEnabled(state, { amountPx: 24, type: "group.resizePane" })).toBe(
    true,
  );

  const grown = reduceInfiniteCanvasState(state, { amountPx: 24, type: "group.resizePane" });
  const after = getCanvasLayout(grown).windowRects;

  expect(after.get("west")!.width).toBeGreaterThan(before.get("west")!.width);
  expect(after.get("east")!.width).toBeLessThan(before.get("east")!.width);
  expect(grown.groups[0]!.rect).toEqual(state.groups[0]!.rect);
});

test("SPLIT-007 — shrinking is the inverse, and the two round-trip", () => {
  const state = dockedPair();
  const roundTripped = reduceInfiniteCanvasState(
    reduceInfiniteCanvasState(state, { amountPx: 24, type: "group.resizePane" }),
    { amountPx: -24, type: "group.resizePane" },
  );
  const widths = getCanvasLayout(roundTripped).windowRects;

  expect(widths.get("west")!.width).toBeCloseTo(
    getCanvasLayout(state).windowRects.get("west")!.width,
    5,
  );
});

test("SPLIT-007 — the last pane grows by taking from the one before it", () => {
  const state = reduceInfiniteCanvasState(dockedPair(), {
    type: "selection.replace",
    targets: [{ type: "window" as const, id: "east" }],
  });
  const before = getCanvasLayout(state).windowRects;
  const grown = reduceInfiniteCanvasState(state, { amountPx: 24, type: "group.resizePane" });
  const after = getCanvasLayout(grown).windowRects;

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
  const screenGrowth = [0.25, 1, 4].map((zoom) => {
    const state = { ...dockedPair(), camera: { center: { x: 0, y: 0 }, zoom } };
    const before = getCanvasLayout(state).windowRects.get("west")!.width;
    const grown = reduceInfiniteCanvasState(state, { amountPx: 24, type: "group.resizePane" });
    const after = getCanvasLayout(grown).windowRects.get("west")!.width;

    return (after - before) * zoom;
  });

  for (const growth of screenGrowth) {
    expect(growth).toBeCloseTo(24, 5);
  }
});

test("FOCUS-004 — extending one window too far is walked back, not started over", () => {
  const three = reduceInfiniteCanvasState(
    reduceInfiniteCanvasState(threeInARow(), {
      direction: "right",
      type: "selection.extendDirection",
    }),
    { direction: "right", type: "selection.extendDirection" },
  );

  expect([...getSelectedWindowIds(three.selection)].toSorted()).toEqual(["a", "b", "c"]);
  expect(three.activeWindowId).toBe("c");

  const walkedBack = reduceInfiniteCanvasState(three, { type: "selection.removeActive" });

  expect([...getSelectedWindowIds(walkedBack.selection)].toSorted()).toEqual(["a", "b"]);
  expect(walkedBack.activeWindowId).toBe("b");

  const further = reduceInfiniteCanvasState(walkedBack, { type: "selection.removeActive" });

  expect(getSelectedWindowIds(further.selection)).toEqual(["a"]);
  expect(further.activeWindowId).toBe("a");
});

test("FOCUS-004 — a window that is not selected has nothing to remove", () => {
  const cleared = reduceInfiniteCanvasState(threeInARow(), { type: "selection.clear" });

  expect(isInfiniteCanvasCommandEnabled(cleared, { type: "selection.removeActive" })).toBe(false);
});
