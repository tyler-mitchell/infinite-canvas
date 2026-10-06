import { masonryEngine } from "./masonry-engine";

import { clamp, unionRects } from "./geometry";
import { isInfiniteCanvasWindowInActiveWorkspace } from "./workspace-membership";
import {
  getInfiniteCanvasGroupChildWeightSum,
  isInfiniteCanvasGroupContainer,
  type InfiniteCanvasGroupAxis,
  type InfiniteCanvasGroupContainerNode,
  type InfiniteCanvasGroupDockEdge,
  type InfiniteCanvasGroupNode,
  type InfiniteCanvasGroupLayoutMode,
  type InfiniteCanvasGroupWindowNodeLayout,
} from "./group-tree";
import type {
  InfiniteCanvasGroupMetrics,
  InfiniteCanvasGroupMetricsInput,
  InfiniteCanvasPoint,
  InfiniteCanvasRect,
  InfiniteCanvasSize,
  InfiniteCanvasResizeHandle,
  InfiniteCanvasState,
  TransformTarget,
} from "./types";

/** Solves group geometry from the model without DOM measurements. */

const DEFAULT_INFINITE_CANVAS_GROUP_METRICS: InfiniteCanvasGroupMetrics = {
  accordionHeaderSize: 28,
  gutterSize: 6,
  tabStripSize: 30,
};

export type LayoutInput = Readonly<{
  container: InfiniteCanvasGroupContainerNode;
  rect: InfiniteCanvasRect;
}>;
type MemberLayoutInput = LayoutInput & Readonly<{ windowId: string }>;
type MemberLayoutChanges = Readonly<Record<string, InfiniteCanvasGroupWindowNodeLayout>>;

export type LayoutEngine = Readonly<{
  layout: (
    input: LayoutInput,
  ) => Readonly<{ extent: number; rects: ReadonlyMap<string, InfiniteCanvasRect> }>;
  move: (
    input: MemberLayoutInput & Readonly<{ windowRect: InfiniteCanvasRect }>,
  ) => MemberLayoutChanges;
  resize: (
    input: MemberLayoutInput &
      Readonly<{ windowRect: InfiniteCanvasRect; handle: InfiniteCanvasResizeHandle }>,
  ) => MemberLayoutChanges;
  contentHeight: (input: MemberLayoutInput & Readonly<{ height: number }>) => MemberLayoutChanges;
  step: (input: LayoutInput) => InfiniteCanvasSize;
  drop: (input: MemberLayoutInput & Readonly<{ windowRect: InfiniteCanvasRect }>) => Readonly<{
    layout: InfiniteCanvasGroupWindowNodeLayout;
    rect: InfiniteCanvasRect;
  }>;
}>;

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
  bounds: InfiniteCanvasRect;
  accordionHeaders: readonly InfiniteCanvasGroupAccordionHeader[];
  containerRects: ReadonlyMap<string, InfiniteCanvasRect>;
  gutters: readonly InfiniteCanvasGroupGutter[];
  hiddenWindows: readonly InfiniteCanvasGroupWindowPlacement[];
  tabStrips: readonly InfiniteCanvasGroupTabStrip[];
  windows: readonly InfiniteCanvasGroupWindowPlacement[];
}>;

type InfiniteCanvasGroupLayoutDraft = {
  accordionHeaders: InfiniteCanvasGroupAccordionHeader[];
  containerRects: Map<string, InfiniteCanvasRect>;
  gutters: InfiniteCanvasGroupGutter[];
  hiddenWindows: InfiniteCanvasGroupWindowPlacement[];
  tabStrips: InfiniteCanvasGroupTabStrip[];
  windows: InfiniteCanvasGroupWindowPlacement[];
};

/** Projects packed grid items into world rectangles. */
function solveMasonryContainer(
  container: InfiniteCanvasGroupContainerNode,
  rect: InfiniteCanvasRect,
  metrics: InfiniteCanvasGroupMetrics,
  draft: InfiniteCanvasGroupLayoutDraft,
  isHidden: boolean,
): InfiniteCanvasRect {
  const { rects, extent } = masonryEngine.layout({ container, rect });

  for (const child of container.children) {
    const childRect = rects.get(child.id);

    if (childRect === undefined) {
      solveInfiniteCanvasGroupNode(child, rect, metrics, draft, true);
      continue;
    }

    solveInfiniteCanvasGroupNode(child, childRect, metrics, draft, isHidden);
  }

  return { ...rect, height: extent };
}

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
): InfiniteCanvasRect {
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
  return rect;
}

/** Reserves a tab strip and gives all children the remaining rect. */
function solveTabsContainer(
  container: InfiniteCanvasGroupContainerNode,
  rect: InfiniteCanvasRect,
  metrics: InfiniteCanvasGroupMetrics,
  draft: InfiniteCanvasGroupLayoutDraft,
  isHidden: boolean,
): InfiniteCanvasRect {
  const activeChild = getActiveChild(container);

  if (activeChild === undefined) {
    return rect;
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
  return rect;
}

/** Reserves each header and gives the active child the remaining rect. */
function solveAccordionContainer(
  container: InfiniteCanvasGroupContainerNode,
  rect: InfiniteCanvasRect,
  metrics: InfiniteCanvasGroupMetrics,
  draft: InfiniteCanvasGroupLayoutDraft,
  isHidden: boolean,
): InfiniteCanvasRect {
  const { axis, children } = container;
  const activeChild = getActiveChild(container);

  if (activeChild === undefined) {
    return rect;
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
  return rect;
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
): InfiniteCanvasRect {
  if (!isInfiniteCanvasGroupContainer(node)) {
    (isHidden ? draft.hiddenWindows : draft.windows).push({ rect, windowId: node.id });

    return rect;
  }

  draft.containerRects.set(node.id, rect);

  return layoutDefinitions[node.layout].solve(node, rect, metrics, draft, isHidden);
}

export const layoutDefinitions: Readonly<
  Record<
    InfiniteCanvasGroupLayoutMode,
    Readonly<{
      solve: typeof solveSplitContainer;
      bounds?: (
        input: LayoutInput & Readonly<{ viewport?: InfiniteCanvasSize }>,
      ) => InfiniteCanvasRect;
      members?: Partial<Omit<LayoutEngine, "layout">>;
    }>
  >
> = {
  split: { solve: solveSplitContainer },
  tabs: { solve: solveTabsContainer },
  accordion: { solve: solveAccordionContainer },
  masonry: {
    solve: solveMasonryContainer,
    members: masonryEngine,
    bounds: ({ container, rect, viewport }) => {
      if (
        container.masonry?.responsive?.fitViewport !== true ||
        viewport === undefined ||
        viewport.width <= 0
      )
        return rect;
      const width = Math.min(rect.width, viewport.width);
      return { ...rect, width, x: rect.x + (rect.width - width) / 2 };
    },
  },
};

function getInfiniteCanvasGroupLayout(
  root: InfiniteCanvasGroupNode,
  rect: InfiniteCanvasRect,
  metrics: InfiniteCanvasGroupMetrics = DEFAULT_INFINITE_CANVAS_GROUP_METRICS,
  viewport?: InfiniteCanvasSize,
  frameBounds?: "content" | InfiniteCanvasRect,
): InfiniteCanvasGroupLayout {
  const draft: InfiniteCanvasGroupLayoutDraft = {
    accordionHeaders: [],
    containerRects: new Map(),
    gutters: [],
    hiddenWindows: [],
    tabStrips: [],
    windows: [],
  };

  const layoutRect =
    root.kind === "container"
      ? (layoutDefinitions[root.layout].bounds?.({ container: root, rect, viewport }) ?? rect)
      : rect;
  const rootRect = solveInfiniteCanvasGroupNode(root, layoutRect, metrics, draft, false);
  const bounds =
    frameBounds === "content"
      ? (unionRects(draft.windows.map(({ rect }) => rect)) ?? rootRect)
      : (frameBounds ?? rootRect);
  return { ...draft, bounds };
}

export type CanvasLayout = Readonly<{
  groupRects: ReadonlyMap<string, InfiniteCanvasRect>;
  hiddenWindowIds: ReadonlySet<string>;
  windowRects: ReadonlyMap<string, InfiniteCanvasRect>;
  layouts: ReadonlyMap<string, InfiniteCanvasGroupLayout>;
  visibleWindowIds: ReadonlySet<string>;
  visibleGroupIds: ReadonlySet<string>;
}>;

type CanvasLayoutInput<Kind extends string = string> = Pick<
  InfiniteCanvasState<Kind>,
  | "activeWorkspaceId"
  | "groupMetrics"
  | "groups"
  | "interaction"
  | "viewport"
  | "windows"
  | "workspaces"
>;

function getDraggedWindowRect({
  rect,
  origin,
  delta,
}: Readonly<{
  rect: InfiniteCanvasRect;
  origin?: InfiniteCanvasRect;
  delta?: InfiniteCanvasPoint;
}>): InfiniteCanvasRect {
  return origin === undefined || delta === undefined
    ? rect
    : {
        ...rect,
        x: origin.x + delta.x,
        y: origin.y + delta.y,
      };
}

export function getCanvasLayout<Kind extends string>(state: CanvasLayoutInput<Kind>): CanvasLayout {
  const move = state.interaction?.kind === "move" ? state.interaction : null;
  const origins = new Map(
    move?.originRects.flatMap(({ target, bounds }) =>
      target.type === "window" ? [[target.id, bounds] as const] : [],
    ) ?? [],
  );
  const layouts = new Map<string, InfiniteCanvasGroupLayout>();
  const groupRects = new Map<string, InfiniteCanvasRect>();
  const windowRects = new Map(
    state.windows.map((window) => {
      const { aspectRatio, rect } = window;
      if (aspectRatio === undefined || aspectRatio <= 0) return [window.id, rect] as const;
      const width =
        window.mode === "maximized" ? Math.min(rect.width, rect.height * aspectRatio) : rect.width;
      return [window.id, { ...rect, width, height: width / aspectRatio }] as const;
    }),
  );
  const windows = new Map(state.windows.map((window) => [window.id, window]));
  const admittedWindowIds = new Set(
    state.windows
      .filter(
        (window) =>
          window.mode !== "minimized" && isInfiniteCanvasWindowInActiveWorkspace(state, window.id),
      )
      .map((window) => window.id),
  );
  const visibleWindowIds = new Set(admittedWindowIds);
  const visibleGroupIds = new Set<string>();
  const hiddenWindowIds = new Set<string>();
  for (const group of state.groups) {
    const allocation = getInfiniteCanvasGroupLayout(
      group.tree,
      group.rect,
      state.groupMetrics,
      state.viewport,
      group.bounds,
    );
    const fitContent = (placement: InfiniteCanvasGroupWindowPlacement) => {
      const window = windows.get(placement.windowId);
      const container = getInfiniteCanvasGroupParent(group.tree, placement.windowId);
      const contentHeight =
        container !== null &&
        layoutDefinitions[container.layout].members?.contentHeight !== undefined;
      if (window?.aspectRatio !== undefined && window.aspectRatio > 0) {
        const width = contentHeight
          ? placement.rect.width
          : Math.min(placement.rect.width, placement.rect.height * window.aspectRatio);
        return {
          ...placement,
          rect: { ...placement.rect, width, height: width / window.aspectRatio },
        };
      }
      if (
        window?.heightMode === "manual" ||
        window?.contentSize?.width !== placement.rect.width ||
        !contentHeight
      )
        return placement;
      return { ...placement, rect: { ...placement.rect, height: window.contentSize.height } };
    };
    const placements = allocation.windows.map(fitContent);
    const layout = {
      ...allocation,
      windows: placements,
      hiddenWindows: allocation.hiddenWindows.map(fitContent),
      bounds:
        group.bounds === "content"
          ? (unionRects(placements.map(({ rect }) => rect)) ?? allocation.bounds)
          : allocation.bounds,
    };
    layouts.set(group.id, layout);
    groupRects.set(group.id, layout.bounds);
    for (const { windowId, rect } of [...layout.windows, ...layout.hiddenWindows]) {
      windowRects.set(
        windowId,
        getDraggedWindowRect({ rect, origin: origins.get(windowId), delta: move?.delta }),
      );
      if (admittedWindowIds.has(windowId)) visibleGroupIds.add(group.id);
    }
    for (const { windowId } of layout.hiddenWindows) {
      hiddenWindowIds.add(windowId);
      visibleWindowIds.delete(windowId);
    }
  }
  return { layouts, groupRects, windowRects, hiddenWindowIds, visibleWindowIds, visibleGroupIds };
}

export function getTargetBounds<Kind extends string>({
  state,
  target,
}: Readonly<{
  state: InfiniteCanvasState<Kind>;
  target: TransformTarget;
}>): InfiniteCanvasRect | null {
  const layout = getCanvasLayout(state);
  return (target.type === "group" ? layout.groupRects : layout.windowRects).get(target.id) ?? null;
}

export function getVisibleWindowBounds<Kind extends string>(state: CanvasLayoutInput<Kind>) {
  const layout = getCanvasLayout(state);
  return unionRects([...layout.visibleWindowIds].map((id) => layout.windowRects.get(id)!));
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

  // A masonry shell can shrink to one track that holds its tallest child.
  if (node.layout === "masonry") {
    return { height: tallest, width: widest };
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
import { getInfiniteCanvasGroupParent } from "./group-tree";
