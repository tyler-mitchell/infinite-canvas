import {
  getInfiniteCanvasGroupChildWeightSum,
  isInfiniteCanvasGroupContainer,
  type InfiniteCanvasGroupAxis,
  type InfiniteCanvasGroupContainerNode,
  type InfiniteCanvasGroupDockEdge,
  type InfiniteCanvasGroupNode,
} from "./group-tree";
import type {
  InfiniteCanvasGroupMetrics,
  InfiniteCanvasGroupMetricsInput,
  InfiniteCanvasPoint,
  InfiniteCanvasRect,
  InfiniteCanvasSize,
} from "./types";

/** Solves group geometry from the model without DOM measurements. */

const DEFAULT_INFINITE_CANVAS_GROUP_METRICS: InfiniteCanvasGroupMetrics = {
  accordionHeaderSize: 28,
  gutterSize: 6,
  tabStripSize: 30,
};

/** Overrides provided metrics and preserves defaults for omitted metrics. */
function resolveInfiniteCanvasGroupMetrics(
  metrics: InfiniteCanvasGroupMetricsInput = {},
): InfiniteCanvasGroupMetrics {
  return {
    accordionHeaderSize:
      metrics.accordionHeaderSize ?? DEFAULT_INFINITE_CANVAS_GROUP_METRICS.accordionHeaderSize,
    gutterSize: metrics.gutterSize ?? DEFAULT_INFINITE_CANVAS_GROUP_METRICS.gutterSize,
    tabStripSize: metrics.tabStripSize ?? DEFAULT_INFINITE_CANVAS_GROUP_METRICS.tabStripSize,
  };
}

type InfiniteCanvasGroupWindowPlacement = Readonly<{
  rect: InfiniteCanvasRect;
  windowId: string;
}>;

/** A split seam that changes the weights of its adjacent panes. */
type InfiniteCanvasGroupGutter = Readonly<{
  afterChildId: string;
  /** Child extent after gutters. Drag math uses this value to update weights. */
  availableExtent: number;
  axis: InfiniteCanvasGroupAxis;
  beforeChildId: string;
  containerId: string;
  rect: InfiniteCanvasRect;
}>;

type InfiniteCanvasGroupTabStrip = Readonly<{
  activeChildId: string;
  childIds: readonly string[];
  containerId: string;
  rect: InfiniteCanvasRect;
}>;

type InfiniteCanvasGroupAccordionHeader = Readonly<{
  /** Axis used for accordion header layout and keyboard navigation. */
  axis: InfiniteCanvasGroupAxis;
  childId: string;
  containerId: string;
  isExpanded: boolean;
  rect: InfiniteCanvasRect;
}>;

/** Includes hidden member rects so tear-out preserves the revealed size. */
type InfiniteCanvasGroupLayout = Readonly<{
  accordionHeaders: readonly InfiniteCanvasGroupAccordionHeader[];
  gutters: readonly InfiniteCanvasGroupGutter[];
  hiddenWindows: readonly InfiniteCanvasGroupWindowPlacement[];
  tabStrips: readonly InfiniteCanvasGroupTabStrip[];
  windows: readonly InfiniteCanvasGroupWindowPlacement[];
}>;

type InfiniteCanvasGroupLayoutDraft = {
  accordionHeaders: InfiniteCanvasGroupAccordionHeader[];
  gutters: InfiniteCanvasGroupGutter[];
  hiddenWindows: InfiniteCanvasGroupWindowPlacement[];
  tabStrips: InfiniteCanvasGroupTabStrip[];
  windows: InfiniteCanvasGroupWindowPlacement[];
};

function isHorizontalAxis(axis: InfiniteCanvasGroupAxis): boolean {
  return axis === "horizontal";
}

function getExtentAlongAxis(rect: InfiniteCanvasRect, axis: InfiniteCanvasGroupAxis): number {
  return isHorizontalAxis(axis) ? rect.width : rect.height;
}

function sliceRectAlongAxis(
  rect: InfiniteCanvasRect,
  axis: InfiniteCanvasGroupAxis,
  offset: number,
  extent: number,
): InfiniteCanvasRect {
  return isHorizontalAxis(axis)
    ? { height: rect.height, width: extent, x: offset, y: rect.y }
    : { height: extent, width: rect.width, x: rect.x, y: offset };
}

function getAxisOrigin(rect: InfiniteCanvasRect, axis: InfiniteCanvasGroupAxis): number {
  return isHorizontalAxis(axis) ? rect.x : rect.y;
}

/** Partitions a rect by child weights and reserves gutters between children. */
function solveSplitContainer(
  container: InfiniteCanvasGroupContainerNode,
  rect: InfiniteCanvasRect,
  metrics: InfiniteCanvasGroupMetrics,
  draft: InfiniteCanvasGroupLayoutDraft,
  isHidden: boolean,
) {
  const { axis, children } = container;
  const gutterCount = Math.max(children.length - 1, 0);
  const available = Math.max(getExtentAlongAxis(rect, axis) - metrics.gutterSize * gutterCount, 0);
  const totalWeight = getInfiniteCanvasGroupChildWeightSum(children);
  let offset = getAxisOrigin(rect, axis);

  children.forEach((child, index) => {
    // Use equal shares when all weights are zero.
    const share = totalWeight > 0 ? child.weight / totalWeight : 1 / children.length;
    const extent = available * share;

    solveInfiniteCanvasGroupNode(
      child,
      sliceRectAlongAxis(rect, axis, offset, extent),
      metrics,
      draft,
      isHidden,
    );
    offset += extent;

    const nextChild = children[index + 1];

    if (nextChild !== undefined && !isHidden) {
      draft.gutters.push({
        afterChildId: child.id,
        availableExtent: available,
        axis,
        beforeChildId: nextChild.id,
        containerId: container.id,
        rect: sliceRectAlongAxis(rect, axis, offset, metrics.gutterSize),
      });
    }

    if (nextChild !== undefined) {
      offset += metrics.gutterSize;
    }
  });
}

/** Reserves a tab strip and gives all children the remaining rect. */
function solveTabsContainer(
  container: InfiniteCanvasGroupContainerNode,
  rect: InfiniteCanvasRect,
  metrics: InfiniteCanvasGroupMetrics,
  draft: InfiniteCanvasGroupLayoutDraft,
  isHidden: boolean,
) {
  const activeChild = getActiveChild(container);

  if (activeChild === undefined) {
    return;
  }

  const stripHeight = Math.min(metrics.tabStripSize, rect.height);

  if (!isHidden) {
    draft.tabStrips.push({
      activeChildId: activeChild.id,
      childIds: container.children.map((child) => child.id),
      containerId: container.id,
      rect: { height: stripHeight, width: rect.width, x: rect.x, y: rect.y },
    });
  }

  const contentRect = {
    height: Math.max(rect.height - stripHeight, 0),
    width: rect.width,
    x: rect.x,
    y: rect.y + stripHeight,
  };

  for (const child of container.children) {
    solveInfiniteCanvasGroupNode(
      child,
      contentRect,
      metrics,
      draft,
      isHidden || child.id !== activeChild.id,
    );
  }
}

/** Reserves each header and gives the active child the remaining rect. */
function solveAccordionContainer(
  container: InfiniteCanvasGroupContainerNode,
  rect: InfiniteCanvasRect,
  metrics: InfiniteCanvasGroupMetrics,
  draft: InfiniteCanvasGroupLayoutDraft,
  isHidden: boolean,
) {
  const { axis, children } = container;
  const activeChild = getActiveChild(container);

  if (activeChild === undefined) {
    return;
  }

  const total = getExtentAlongAxis(rect, axis);
  const headerSize = Math.min(metrics.accordionHeaderSize, total / children.length);
  const expandedExtent = Math.max(total - headerSize * children.length, 0);
  let offset = getAxisOrigin(rect, axis);

  for (const child of children) {
    const isExpanded = child.id === activeChild.id;

    if (!isHidden) {
      draft.accordionHeaders.push({
        axis,
        childId: child.id,
        containerId: container.id,
        isExpanded,
        rect: sliceRectAlongAxis(rect, axis, offset, headerSize),
      });
    }

    offset += headerSize;

    // Give each hidden child the rect that it uses when expanded.
    solveInfiniteCanvasGroupNode(
      child,
      sliceRectAlongAxis(rect, axis, offset, expandedExtent),
      metrics,
      draft,
      isHidden || !isExpanded,
    );

    if (isExpanded) {
      offset += expandedExtent;
    }
  }
}

function getActiveChild(
  container: InfiniteCanvasGroupContainerNode,
): InfiniteCanvasGroupNode | undefined {
  return (
    container.children.find((child) => child.id === container.activeChildId) ??
    container.children[0]
  );
}

function solveInfiniteCanvasGroupNode(
  node: InfiniteCanvasGroupNode,
  rect: InfiniteCanvasRect,
  metrics: InfiniteCanvasGroupMetrics,
  draft: InfiniteCanvasGroupLayoutDraft,
  isHidden: boolean,
) {
  if (!isInfiniteCanvasGroupContainer(node)) {
    (isHidden ? draft.hiddenWindows : draft.windows).push({ rect, windowId: node.id });

    return;
  }

  if (node.layout === "split") {
    solveSplitContainer(node, rect, metrics, draft, isHidden);

    return;
  }

  if (node.layout === "tabs") {
    solveTabsContainer(node, rect, metrics, draft, isHidden);

    return;
  }

  solveAccordionContainer(node, rect, metrics, draft, isHidden);
}

function getInfiniteCanvasGroupLayout(
  root: InfiniteCanvasGroupNode,
  rect: InfiniteCanvasRect,
  metrics: InfiniteCanvasGroupMetrics = DEFAULT_INFINITE_CANVAS_GROUP_METRICS,
): InfiniteCanvasGroupLayout {
  const draft: InfiniteCanvasGroupLayoutDraft = {
    accordionHeaders: [],
    gutters: [],
    hiddenWindows: [],
    tabStrips: [],
    windows: [],
  };

  solveInfiniteCanvasGroupNode(root, rect, metrics, draft, false);

  return draft;
}

/** Returns the nearest dock edge or the center merge region. */
function getInfiniteCanvasGroupDockEdgeAtPoint(
  rect: InfiniteCanvasRect,
  point: InfiniteCanvasPoint,
  centerRatio = 0.34,
): InfiniteCanvasGroupDockEdge {
  if (rect.width <= 0 || rect.height <= 0) {
    return "center";
  }

  const west = (point.x - rect.x) / rect.width;
  const north = (point.y - rect.y) / rect.height;
  const east = 1 - west;
  const south = 1 - north;
  const margin = Math.min(Math.max(centerRatio, 0), 0.5);

  if (west >= margin && east >= margin && north >= margin && south >= margin) {
    return "center";
  }

  const nearest = Math.min(east, north, south, west);

  if (nearest === west) {
    return "west";
  }

  if (nearest === east) {
    return "east";
  }

  return nearest === north ? "north" : "south";
}

/** Minimum adjacent-pane share during a gutter drag. */
const MINIMUM_GROUP_PANE_SHARE = 0.02;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

/** Updates only the two panes beside a gutter from its total pointer delta. */
function getInfiniteCanvasGroupGutterWeights(
  container: InfiniteCanvasGroupContainerNode,
  seam: Readonly<{ afterChildId: string; beforeChildId: string }>,
  input: Readonly<{ availableExtent: number; delta: number; minimumExtent?: number }>,
): Readonly<Record<string, number>> {
  const { availableExtent, delta, minimumExtent = 0 } = input;
  const before = container.children.find((child) => child.id === seam.afterChildId);
  const after = container.children.find((child) => child.id === seam.beforeChildId);

  if (before === undefined || after === undefined || availableExtent <= 0) {
    return {};
  }

  const totalWeight = getInfiniteCanvasGroupChildWeightSum(container.children);
  const pairWeight = before.weight + after.weight;

  if (totalWeight <= 0 || pairWeight <= 0) {
    return {};
  }

  const weightPerUnit = totalWeight / availableExtent;
  const floor = Math.max(minimumExtent * weightPerUnit, pairWeight * MINIMUM_GROUP_PANE_SHARE);

  if (pairWeight <= floor * 2) {
    return {};
  }

  const beforeWeight = clamp(before.weight + delta * weightPerUnit, floor, pairWeight - floor);

  return {
    [before.id]: beforeWeight,
    [after.id]: pairWeight - beforeWeight,
  };
}

/** Minimum pane extent. Member `minSize` applies only when floating. */
const MINIMUM_GROUP_PANE_EXTENT = 48;

/** Returns the smallest shell size that preserves structural chrome and panes. */
function getInfiniteCanvasGroupMinimumSize(
  node: InfiniteCanvasGroupNode,
  metrics: InfiniteCanvasGroupMetrics = DEFAULT_INFINITE_CANVAS_GROUP_METRICS,
): InfiniteCanvasSize {
  if (!isInfiniteCanvasGroupContainer(node)) {
    return { height: MINIMUM_GROUP_PANE_EXTENT, width: MINIMUM_GROUP_PANE_EXTENT };
  }

  const children = node.children.map((child) => getInfiniteCanvasGroupMinimumSize(child, metrics));

  // Use a zero extent for an empty unnormalized tree.
  if (children.length === 0) {
    return { height: MINIMUM_GROUP_PANE_EXTENT, width: MINIMUM_GROUP_PANE_EXTENT };
  }

  const widest = Math.max(...children.map((size) => size.width));
  const tallest = Math.max(...children.map((size) => size.height));

  if (node.layout === "tabs") {
    return { height: tallest + metrics.tabStripSize, width: widest };
  }

  const isHorizontal = isHorizontalAxis(node.axis);

  if (node.layout === "accordion") {
    // Size each fold for the widest child so activation cannot violate the pane floor.
    const headers = metrics.accordionHeaderSize * children.length;

    return isHorizontal
      ? { height: tallest, width: headers + widest }
      : { height: headers + tallest, width: widest };
  }

  const gutters = metrics.gutterSize * Math.max(children.length - 1, 0);
  const sum = (extents: readonly number[]) => extents.reduce((total, extent) => total + extent, 0);

  return isHorizontal
    ? { height: tallest, width: sum(children.map((size) => size.width)) + gutters }
    : { height: sum(children.map((size) => size.height)) + gutters, width: widest };
}

export {
  DEFAULT_INFINITE_CANVAS_GROUP_METRICS,
  MINIMUM_GROUP_PANE_EXTENT,
  getInfiniteCanvasGroupDockEdgeAtPoint,
  getInfiniteCanvasGroupGutterWeights,
  getInfiniteCanvasGroupLayout,
  getInfiniteCanvasGroupMinimumSize,
  resolveInfiniteCanvasGroupMetrics,
};
export type {
  InfiniteCanvasGroupAccordionHeader,
  InfiniteCanvasGroupGutter,
  InfiniteCanvasGroupLayout,
  InfiniteCanvasGroupTabStrip,
  InfiniteCanvasGroupWindowPlacement,
};
