import {
  getInfiniteCanvasGroupChildWeightSum,
  isInfiniteCanvasGroupContainer,
  type InfiniteCanvasGroupAxis,
  type InfiniteCanvasGroupContainerNode,
  type InfiniteCanvasGroupDockEdge,
  type InfiniteCanvasGroupNode,
} from "./group-tree";
import type { InfiniteCanvasPoint, InfiniteCanvasRect } from "./types";

/**
 * The layout solver for a group shell's container tree.
 *
 * Everything here is a pure function of the tree and the shell's content rect.
 * That is the point, and it is the rule the spec insists on: **docking and
 * resizing resolve in the canonical model, never from DOM measurements.**
 * Dragging a gutter changes a child's `weight`; rects are then re-derived from
 * scratch. No DOM width is ever the source of truth, so a group laid out
 * offscreen, in a test, or on a server produces exactly the same geometry as
 * one the user is looking at (SPLIT-001).
 *
 * Coordinates are whatever space the caller passes in. The group shell hands us
 * its content rect in world units, so every rect out of here is world units too.
 */

type InfiniteCanvasGroupMetrics = Readonly<{
  /** Extent, along the container's axis, of a collapsed accordion child's header. */
  accordionHeaderSize: number;
  /** Extent of the draggable seam between two split children. */
  gutterSize: number;
  /** Height of the tab strip above a tab group's content. */
  tabStripSize: number;
}>;

const DEFAULT_INFINITE_CANVAS_GROUP_METRICS: InfiniteCanvasGroupMetrics = {
  accordionHeaderSize: 28,
  gutterSize: 6,
  tabStripSize: 30,
};

type InfiniteCanvasGroupWindowPlacement = Readonly<{
  rect: InfiniteCanvasRect;
  windowId: string;
}>;

/** The draggable seam between two split siblings. Dragging it reweights the pair. */
type InfiniteCanvasGroupGutter = Readonly<{
  afterChildId: string;
  /**
   * The extent, along `axis`, that the container had left for its children after
   * reserving every gutter. Published here because the solver already computed it
   * and a drag needs exactly this number to convert a pointer delta into weight —
   * re-deriving it at the call site is how the seam drifts away from the cursor.
   */
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
  childId: string;
  containerId: string;
  isExpanded: boolean;
  rect: InfiniteCanvasRect;
}>;

/**
 * Everything a renderer needs, flattened.
 *
 * `hiddenWindows` are still members — behind an inactive tab or a collapsed fold —
 * and they carry **the rect they would occupy if revealed**, not nothing and not
 * the shell's. Nothing draws them, but a tear-out gesture hands that rect to the
 * window it frees, so a torn-out tab lands at its own size rather than swelling to
 * fill the group. Anything that unions member rects gets the right answer too.
 */
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

/** The rect's extent along `axis` — its width when horizontal, height when vertical. */
function getExtentAlongAxis(rect: InfiniteCanvasRect, axis: InfiniteCanvasGroupAxis): number {
  return isHorizontalAxis(axis) ? rect.width : rect.height;
}

/**
 * A slice of `rect` running from `offset` for `extent` along `axis`, spanning the
 * full cross-axis. Every rect in this file is cut this way, which is why none of
 * them need to reason about x-versus-y.
 */
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

/**
 * Partition `rect` among the children by weight, reserving a gutter between each
 * adjacent pair. Weights are shares, not sizes: the solver is what turns a ratio
 * into pixels, so a shell can be resized without touching the tree.
 */
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
    // Degenerate weights would otherwise divide by zero; equal shares is the
    // only sane reading of "every child wants nothing".
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

    // Chrome inside a hidden subtree is never drawn, so it is never emitted.
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

/**
 * A tab strip across the top, the active child filling what is left. Inactive
 * children contribute no rect — they are hidden, not removed.
 */
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

  // Every child of a tab group shares the same content rect; the inactive ones
  // are solved into it too, so they know the size they would be revealed at.
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

/**
 * Every child gets a header along the axis; the active one additionally gets all
 * the space the headers did not claim. When the headers alone would overflow the
 * shell, they share it equally and nothing expands — a squeezed accordion stays
 * navigable rather than pushing folds out of the group.
 */
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
        childId: child.id,
        containerId: container.id,
        isExpanded,
        rect: sliceRectAlongAxis(rect, axis, offset, headerSize),
      });
    }

    offset += headerSize;

    // A collapsed fold is solved into the extent it would expand to, at its own
    // offset — so a member torn out of it lands at the size it would have shown.
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

/**
 * Normalization guarantees a live `activeChildId` on tab and accordion groups,
 * so the fallback to the first child is defence against a hand-built tree, not a
 * path the framework's own mutations can reach.
 */
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

/** Solve a group shell's content rect into window rects and the chrome between them. */
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

/**
 * Which edge of `rect` a pointer at `point` is docking against. The middle
 * `1 - 2 * centerRatio` of each axis is the tab-merge zone; outside it, the
 * nearest edge wins.
 *
 * This reads a *model* rect, never a measured element — a drop target computed
 * from `getBoundingClientRect` would disagree with the canonical tree the moment
 * a CSS transform, a scroll, or a zoom got involved.
 */
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

/**
 * A pane may never be dragged out of existence: it keeps at least this share of
 * the pair a gutter separates, however far the pointer travels. It also keeps
 * both weights strictly positive, which `group-tree` requires (invariant 2) and
 * would otherwise silently repair by resetting the weight to 1 — inverting the
 * very ratio the drag was adjusting.
 */
const MINIMUM_GROUP_PANE_SHARE = 0.02;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

/**
 * The weights a gutter drag produces. Only the two children the gutter separates
 * move; everyone else keeps their share, so dragging one seam never ripples
 * across the group.
 *
 * `delta` is measured along the container's axis in the same units as the rect
 * that produced the layout, and `availableExtent` is the extent that rect had
 * left over for children after gutters. Converting through
 * `totalWeight / availableExtent` — the exact scale `solveSplitContainer` used
 * in the other direction — is what makes the seam track the cursor rather than
 * drift away from it.
 *
 * Returns `{}` when nothing can move, so the caller can treat "no change" and
 * "no room" identically.
 */
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

export {
  DEFAULT_INFINITE_CANVAS_GROUP_METRICS,
  getInfiniteCanvasGroupDockEdgeAtPoint,
  getInfiniteCanvasGroupGutterWeights,
  getInfiniteCanvasGroupLayout,
};
export type {
  InfiniteCanvasGroupAccordionHeader,
  InfiniteCanvasGroupGutter,
  InfiniteCanvasGroupLayout,
  InfiniteCanvasGroupMetrics,
  InfiniteCanvasGroupTabStrip,
  InfiniteCanvasGroupWindowPlacement,
};
