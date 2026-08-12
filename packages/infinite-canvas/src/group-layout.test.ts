import { expect, test } from "vite-plus/test";

import {
  DEFAULT_INFINITE_CANVAS_GROUP_METRICS,
  MINIMUM_GROUP_PANE_EXTENT,
  getInfiniteCanvasGroupDockEdgeAtPoint,
  getInfiniteCanvasGroupGutterWeights,
  getInfiniteCanvasGroupLayout,
  getInfiniteCanvasGroupMinimumSize,
} from "./group-layout";
import { createInfiniteCanvasGroupWindowNode } from "./group-tree";
import type { InfiniteCanvasGroupContainerNode, InfiniteCanvasGroupLayoutMode } from "./group-tree";

/**
 * The group layout solver, which had no test at all.
 *
 * This is the module that decides where every grouped window is drawn: `group-state` projects its
 * output onto each member's `rect`, and everything downstream — snapping, camera framing,
 * persistence, hit-testing — reads those rects and stays group-blind. So a solver defect does not
 * look like a solver defect; it looks like windows in the wrong place for no reason.
 *
 * The acceptance-scenario tests exercised it *indirectly* through
 * `getInfiniteCanvasGroupProjection` and asserted properties of the projection. None asserted the
 * solver's own contracts, and four public functions had zero coverage.
 */

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

test("a split partitions by weight, after the gutters take their share", () => {
  // The arithmetic everything downstream depends on: gutters are subtracted first, then the
  // remainder is divided by weight. Dividing first and subtracting after would overflow the shell.
  const layout = getInfiniteCanvasGroupLayout(container("split", [1, 1]), RECT);
  const available = RECT.width - gutterSize;

  expect(layout.windows).toHaveLength(2);
  expect(layout.windows[0]!.rect.width).toBeCloseTo(available / 2, 6);
  expect(layout.windows[1]!.rect.width).toBeCloseTo(available / 2, 6);
  // No pane overlaps the seam, and the panes plus the gutter exactly fill the shell.
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
  // Three panes, two seams. An off-by-one here would either strand a draggable seam at the
  // shell's edge or lose the last one.
  const layout = getInfiniteCanvasGroupLayout(container("split", [1, 1, 1]), RECT);

  expect(layout.gutters).toHaveLength(2);
  expect(layout.gutters.map((gutter) => gutter.rect.width)).toEqual([gutterSize, gutterSize]);
});

test("tabs give every child the same content rect, and hide the inactive ones", () => {
  // Inactive children are solved into the same rect rather than omitted, so a tear-out frees a
  // hidden window at the size it would have been revealed at instead of at zero.
  const layout = getInfiniteCanvasGroupLayout(container("tabs", [1, 1], "w1"), RECT);

  expect(layout.tabStrips).toHaveLength(1);
  expect(layout.tabStrips[0]!.rect.height).toBe(tabStripSize);
  expect(layout.windows).toHaveLength(1);
  expect(layout.windows[0]!.windowId).toBe("w1");
  expect(layout.hiddenWindows.map((placement) => placement.windowId)).toEqual(["w0"]);
  // Same rect, visible or not — the strip's height is taken off the top for both.
  expect(layout.hiddenWindows[0]!.rect).toEqual(layout.windows[0]!.rect);
  expect(layout.windows[0]!.rect.height).toBeCloseTo(RECT.height - tabStripSize, 6);
});

test("an accordion gives every child a header and the active one the remainder", () => {
  const layout = getInfiniteCanvasGroupLayout(container("accordion", [1, 1], "w0"), RECT);

  expect(layout.accordionHeaders).toHaveLength(2);
  expect(layout.windows).toHaveLength(1);
  expect(layout.windows[0]!.windowId).toBe("w0");
  // Both headers come off the shell; what is left belongs to the expanded fold.
  expect(layout.windows[0]!.rect.width).toBeCloseTo(RECT.width - accordionHeaderSize * 2, 6);
});

test("the minimum size is structural, never a member's own minSize", () => {
  // The rule the shell-resize work corrected: the solver has never consulted `minSize`, because
  // inside a tree a member has no rect of its own. Letting one stubborn window veto a resize of
  // the group it merely belongs to would contradict the gutter drag, which floors by extent.
  const split = getInfiniteCanvasGroupMinimumSize(container("split", [1, 1]));

  // Two panes plus the seam between them, along the axis.
  expect(split.width).toBeCloseTo(MINIMUM_GROUP_PANE_EXTENT * 2 + gutterSize, 6);
  expect(split.height).toBeCloseTo(MINIMUM_GROUP_PANE_EXTENT, 6);

  // A lone window floors at the pane extent in both directions.
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

  // The middle `1 - 2 * centerRatio` of each axis merges into a tab group.
  expect(getInfiniteCanvasGroupDockEdgeAtPoint(rect, { x: 50, y: 50 })).toBe("center");
  // Outside it, the nearest edge wins.
  expect(getInfiniteCanvasGroupDockEdgeAtPoint(rect, { x: 2, y: 50 })).toBe("west");
  expect(getInfiniteCanvasGroupDockEdgeAtPoint(rect, { x: 98, y: 50 })).toBe("east");
  expect(getInfiniteCanvasGroupDockEdgeAtPoint(rect, { x: 50, y: 2 })).toBe("north");
  expect(getInfiniteCanvasGroupDockEdgeAtPoint(rect, { x: 50, y: 98 })).toBe("south");
  // A degenerate rect cannot be divided into regions, so everything is a merge.
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

  // The untouched third pane keeps its weight — a seam is local to its pair.
  expect(weights.w2).toBeUndefined();
  expect(weights.w0).toBeGreaterThan(weights.w1!);
  // Total weight across the pair is conserved, so the rest of the shell does not shift.
  expect(weights.w0! + weights.w1!).toBeCloseTo(2, 6);
});

test("a pane can never be dragged out of existence", () => {
  // Weights must stay strictly positive: `group-tree` requires it, and would otherwise silently
  // repair a zero by resetting it to 1 — inverting the very ratio the drag was adjusting.
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
