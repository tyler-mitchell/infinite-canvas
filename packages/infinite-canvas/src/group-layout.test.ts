import { expect, test } from "vite-plus/test";

import {
  DEFAULT_INFINITE_CANVAS_GROUP_METRICS,
  MINIMUM_GROUP_PANE_EXTENT,
  getCanvasLayout,
  getInfiniteCanvasGroupDockEdgeAtPoint,
  getInfiniteCanvasGroupGutterWeights,
  getInfiniteCanvasGroupLayout,
  getInfiniteCanvasGroupMinimumSize,
} from "./layout";
import { createInfiniteCanvasGroupWindowNode } from "./group-tree";
import type { InfiniteCanvasGroupContainerNode, InfiniteCanvasGroupLayoutMode } from "./group-tree";
import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import {
  applyInfiniteCanvasDockPreview,
  resolveInfiniteCanvasLatticeDropPreview,
} from "./group-state";

const { gutterSize, tabStripSize, accordionHeaderSize } = DEFAULT_INFINITE_CANVAS_GROUP_METRICS;

const container = (
  layout: InfiniteCanvasGroupLayoutMode,
  weights: readonly number[],
  activeChildId: string | null = null,
): InfiniteCanvasGroupContainerNode => ({
  activeChildId,
  axis: "horizontal",
  children: weights.map((weight, index) =>
    createInfiniteCanvasGroupWindowNode(`w${index}`, weight),
  ),
  id: "root",
  kind: "container",
  layout,
  weight: 1,
});

const RECT = { height: 400, width: 800, x: 0, y: 0 };

test("wrap masonry uses the native row-wrapping compactor", () => {
  const tree: InfiniteCanvasGroupContainerNode = {
    ...container("masonry", [1, 1, 1]),
    masonry: { cols: 2, compactType: "wrap", rowHeight: 40 },
  };
  const { windows } = getInfiniteCanvasGroupLayout(tree, RECT);

  expect(windows[0]!.rect.y).toBe(windows[1]!.rect.y);
  expect(windows[1]!.rect.x).toBeGreaterThan(windows[0]!.rect.x);
  expect(windows[2]!.rect.y).toBeGreaterThan(windows[0]!.rect.y);
  expect(windows[2]!.rect.x).toBe(windows[0]!.rect.x);
});

test.each([undefined, 1, 2])(
  "an oversized drop preview matches committed geometry with aspect %s",
  (aspectRatio) => {
    const tree: InfiniteCanvasGroupContainerNode = {
      ...container("masonry", [1, 1]),
      masonry: { cols: 2, rowHeight: 40 },
    };
    const state = createInfiniteCanvasState({
      groups: [{ id: "root", title: null, rect: RECT, zIndex: 0, tree }],
      windows: ["w0", "w1", "incoming"].map((id) =>
        createInfiniteCanvasWindow({
          id,
          kind: "test",
          title: id,
          rect: { ...RECT, width: 2000 },
          ...(aspectRatio === undefined ? {} : { aspectRatio }),
        }),
      ),
    });
    const preview = resolveInfiniteCanvasLatticeDropPreview(state, { x: 20, y: 20 }, "incoming");

    expect(preview).not.toBeNull();
    expect(preview!.layout?.span).toBe(2);
    expect(preview!.rect.x).toBeGreaterThanOrEqual(RECT.x);
    expect(preview!.rect.x + preview!.rect.width).toBeLessThanOrEqual(RECT.x + RECT.width);
    const committed = applyInfiniteCanvasDockPreview(state, preview!);
    expect(getCanvasLayout(committed).windowRects.get("incoming")).toEqual(preview!.rect);
    if (aspectRatio !== undefined)
      expect(preview!.rect.width / preview!.rect.height).toBe(aspectRatio);
  },
);

test("a split partitions by weight, after the gutters take their share", () => {
  const layout = getInfiniteCanvasGroupLayout(container("split", [1, 1]), RECT);
  const available = RECT.width - gutterSize;

  expect(layout.windows).toHaveLength(2);
  expect(layout.windows[0]!.rect.width).toBeCloseTo(available / 2, 6);
  expect(layout.windows[1]!.rect.width).toBeCloseTo(available / 2, 6);
  expect(
    layout.windows[1]!.rect.x - (layout.windows[0]!.rect.x + layout.windows[0]!.rect.width),
  ).toBeCloseTo(gutterSize, 6);
  expect(layout.windows[1]!.rect.x + layout.windows[1]!.rect.width).toBeCloseTo(RECT.width, 6);
});

test("uneven weights divide the remainder in proportion", () => {
  const layout = getInfiniteCanvasGroupLayout(container("split", [3, 1]), RECT);

  expect(layout.windows[0]!.rect.width / layout.windows[1]!.rect.width).toBeCloseTo(3, 6);
});

test("a split emits one gutter fewer than it has panes", () => {
  const layout = getInfiniteCanvasGroupLayout(container("split", [1, 1, 1]), RECT);

  expect(layout.gutters).toHaveLength(2);
  expect(layout.gutters.map((gutter) => gutter.rect.width)).toEqual([gutterSize, gutterSize]);
});

test("tabs give every child the same content rect, and hide the inactive ones", () => {
  const layout = getInfiniteCanvasGroupLayout(container("tabs", [1, 1], "w1"), RECT);

  expect(layout.tabStrips).toHaveLength(1);
  expect(layout.tabStrips[0]!.rect.height).toBe(tabStripSize);
  expect(layout.windows).toHaveLength(1);
  expect(layout.windows[0]!.windowId).toBe("w1");
  expect(layout.hiddenWindows.map((placement) => placement.windowId)).toEqual(["w0"]);
  expect(layout.hiddenWindows[0]!.rect).toEqual(layout.windows[0]!.rect);
  expect(layout.windows[0]!.rect.height).toBeCloseTo(RECT.height - tabStripSize, 6);
});

test("an accordion gives every child a header and the active one the remainder", () => {
  const layout = getInfiniteCanvasGroupLayout(container("accordion", [1, 1], "w0"), RECT);

  expect(layout.accordionHeaders).toHaveLength(2);
  expect(layout.windows).toHaveLength(1);
  expect(layout.windows[0]!.windowId).toBe("w0");
  expect(layout.windows[0]!.rect.width).toBeCloseTo(RECT.width - accordionHeaderSize * 2, 6);
});

test("the minimum size is structural, never a member's own minSize", () => {
  const split = getInfiniteCanvasGroupMinimumSize(container("split", [1, 1]));

  expect(split.width).toBeCloseTo(MINIMUM_GROUP_PANE_EXTENT * 2 + gutterSize, 6);
  expect(split.height).toBeCloseTo(MINIMUM_GROUP_PANE_EXTENT, 6);

  expect(getInfiniteCanvasGroupMinimumSize(createInfiniteCanvasGroupWindowNode("solo"))).toEqual({
    height: MINIMUM_GROUP_PANE_EXTENT,
    width: MINIMUM_GROUP_PANE_EXTENT,
  });
});

test("a tab group's minimum makes room for its strip", () => {
  const tabs = getInfiniteCanvasGroupMinimumSize(container("tabs", [1, 1], "w0"));

  expect(tabs.height).toBeCloseTo(MINIMUM_GROUP_PANE_EXTENT + tabStripSize, 6);
});

test("the dock edge is the nearest one outside the centre zone", () => {
  const rect = { height: 100, width: 100, x: 0, y: 0 };

  expect(getInfiniteCanvasGroupDockEdgeAtPoint(rect, { x: 50, y: 50 })).toBe("center");
  expect(getInfiniteCanvasGroupDockEdgeAtPoint(rect, { x: 2, y: 50 })).toBe("west");
  expect(getInfiniteCanvasGroupDockEdgeAtPoint(rect, { x: 98, y: 50 })).toBe("east");
  expect(getInfiniteCanvasGroupDockEdgeAtPoint(rect, { x: 50, y: 2 })).toBe("north");
  expect(getInfiniteCanvasGroupDockEdgeAtPoint(rect, { x: 50, y: 98 })).toBe("south");
  expect(
    getInfiniteCanvasGroupDockEdgeAtPoint({ height: 0, width: 0, x: 0, y: 0 }, { x: 0, y: 0 }),
  ).toBe("center");
});

test("a seam drag moves weight between exactly two panes", () => {
  const weights = getInfiniteCanvasGroupGutterWeights(
    container("split", [1, 1, 1]),
    { afterChildId: "w0", beforeChildId: "w1" },
    { availableExtent: 600, delta: 100 },
  );

  expect(weights.w2).toBeUndefined();
  expect(weights.w0).toBeGreaterThan(weights.w1!);
  expect(weights.w0! + weights.w1!).toBeCloseTo(2, 6);
});

test("a pane can never be dragged out of existence", () => {
  const weights = getInfiniteCanvasGroupGutterWeights(
    container("split", [1, 1]),
    { afterChildId: "w0", beforeChildId: "w1" },
    { availableExtent: 600, delta: -10_000 },
  );

  expect(weights.w0).toBeGreaterThan(0);
  expect(weights.w1).toBeGreaterThan(0);
});

test("a seam with an unknown child, or no room, changes nothing", () => {
  const node = container("split", [1, 1]);

  expect(
    getInfiniteCanvasGroupGutterWeights(
      node,
      { afterChildId: "ghost", beforeChildId: "w1" },
      { availableExtent: 600, delta: 50 },
    ),
  ).toEqual({});
  expect(
    getInfiniteCanvasGroupGutterWeights(
      node,
      { afterChildId: "w0", beforeChildId: "w1" },
      { availableExtent: 0, delta: 50 },
    ),
  ).toEqual({});
});
