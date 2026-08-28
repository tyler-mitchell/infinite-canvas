import { getVisibleWorldRect, isUsableViewport, unionRects } from "./geometry";
import { getInfiniteCanvasGroupProjection } from "./group-state";
import { getInfiniteCanvasGroupWindowIds } from "./group-tree";
import { isWindowSelected } from "./selection";
import { getInfiniteCanvasWorkspaceWindowIds } from "./workspace-membership";
import type {
  InfiniteCanvasPoint,
  InfiniteCanvasRect,
  InfiniteCanvasSize,
  InfiniteCanvasState,
} from "./types";

/**
 * Computes a world overview: world rects projected into a small box, and the inverse projection
 * for click-to-navigate. Draws nothing.
 *
 * Pure — no DOM, React, or store. Built from the same `unionRects` and `getVisibleWorldRect` a
 * consumer already has, so an alternative overview can be written without this.
 *
 * @experimental Landed 2026-07-08.
 */

/** A window as the overview sees it: a rect, and the two states worth styling differently. */
type InfiniteCanvasMinimapWindow = Readonly<{
  isActive: boolean;
  isSelected: boolean;
  rect: InfiniteCanvasRect;
  windowId: string;
}>;

type InfiniteCanvasMinimapGroup = Readonly<{
  groupId: string;
  rect: InfiniteCanvasRect;
}>;

type InfiniteCanvasMinimapLayout = Readonly<{
  /** The world region the overview covers. */
  bounds: InfiniteCanvasRect;
  groups: readonly InfiniteCanvasMinimapGroup[];
  /**
   * Overview pixels from the box's top-left to `bounds`' top-left: padding plus centring slack.
   * Carried rather than recomputed so `getInfiniteCanvasMinimapWorldPoint` is an exact inverse.
   */
  offset: InfiniteCanvasPoint;
  /** World units to overview pixels. Uniform on both axes, so the projection does not distort. */
  scale: number;
  /**
   * Where the camera is looking, in overview pixels. `null` when the camera contains everything
   * drawn, since the indicator would then span the whole box.
   */
  viewport: InfiniteCanvasRect | null;
  windows: readonly InfiniteCanvasMinimapWindow[];
}>;

type InfiniteCanvasMinimapOptions = Readonly<{
  /** Overview pixels of breathing room around the content. */
  paddingPx?: number;
}>;

const DEFAULT_MINIMAP_PADDING_PX = 8;

const scaleRect = (
  rect: InfiniteCanvasRect,
  bounds: InfiniteCanvasRect,
  scale: number,
  offset: InfiniteCanvasPoint,
): InfiniteCanvasRect => ({
  height: rect.height * scale,
  width: rect.width * scale,
  x: offset.x + (rect.x - bounds.x) * scale,
  y: offset.y + (rect.y - bounds.y) * scale,
});

/**
 * Projects the canvas into a box of `size` overview pixels, or `null` when there is nothing to
 * show.
 *
 * The camera's visible rect is unioned into `bounds`, so panning away from every window shrinks
 * the content rather than pushing the viewport indicator outside the box.
 *
 * Omits windows nothing draws: minimized ones have no rect, and tab-hidden or folded members are
 * solved into one but not rendered.
 *
 * Returns `null` for an unmeasured (`0 × 0`) viewport, a box too small for its padding, or nothing
 * drawn. "Nothing drawn" means this function's filtered set, not `state.windows` — a workspace
 * admitting none of the canvas's windows has nothing to map even when the canvas is full.
 */
function getInfiniteCanvasMinimapLayout<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  size: InfiniteCanvasSize,
  options: InfiniteCanvasMinimapOptions = {},
): InfiniteCanvasMinimapLayout | null {
  const { paddingPx = DEFAULT_MINIMAP_PADDING_PX } = options;
  const innerWidth = size.width - paddingPx * 2;
  const innerHeight = size.height - paddingPx * 2;

  if (!isUsableViewport(state.viewport) || innerWidth <= 0 || innerHeight <= 0) {
    return null;
  }

  const { hiddenWindowIds } = getInfiniteCanvasGroupProjection(state.groups, state.groupMetrics);
  // A workspace hides windows, so the map must not draw them either — they would also be unioned
  // into `bounds` and shrink everything visible. `null` means no workspace is active.
  const admitted = getInfiniteCanvasWorkspaceWindowIds(state);
  const drawnWindows = state.windows.filter(
    (window) =>
      window.mode !== "minimized" &&
      !hiddenWindowIds.has(window.id) &&
      (admitted === null || admitted.has(window.id)),
  );
  // Membership is group-complete, so one admitted member settles the group.
  const drawnGroups = state.groups.filter(
    (group) =>
      admitted === null ||
      getInfiniteCanvasGroupWindowIds(group.tree).some((windowId) => admitted.has(windowId)),
  );
  // Must be checked before `bounds`, which unions the camera in and is therefore never empty.
  if (drawnWindows.length === 0 && drawnGroups.length === 0) {
    return null;
  }

  const visibleWorldRect = getVisibleWorldRect(state.camera, state.viewport, 0);
  // Computed separately: whether the camera already contains the content decides the indicator.
  const contentBounds = unionRects([
    ...drawnWindows.map((window) => window.rect),
    ...drawnGroups.map((group) => group.rect),
  ]);
  const bounds = unionRects(
    contentBounds === null ? [visibleWorldRect] : [contentBounds, visibleWorldRect],
  );

  if (bounds === null || bounds.width <= 0 || bounds.height <= 0) {
    return null;
  }

  // Uniform scale, centred on whichever axis has room left. Fitting each axis independently
  // would distort the aspect ratio.
  const scale = Math.min(innerWidth / bounds.width, innerHeight / bounds.height);
  const offset = {
    x: paddingPx + (innerWidth - bounds.width * scale) / 2,
    y: paddingPx + (innerHeight - bounds.height * scale) / 2,
  };

  return {
    bounds,
    // `drawnGroups`, not `state.groups` — a group excluded from the bounds above must also be
    // excluded here, or the map draws a rect for a desktop it deliberately did not measure.
    groups: drawnGroups.map((group) => ({
      groupId: group.id,
      rect: scaleRect(group.rect, bounds, scale, offset),
    })),
    offset,
    scale,
    // Exact equality: `bounds` is a union, so a contained camera contributes all four unchanged.
    viewport:
      bounds.x === visibleWorldRect.x &&
      bounds.y === visibleWorldRect.y &&
      bounds.width === visibleWorldRect.width &&
      bounds.height === visibleWorldRect.height
        ? null
        : scaleRect(visibleWorldRect, bounds, scale, offset),
    windows: drawnWindows.map((window) => ({
      isActive: state.activeWindowId === window.id,
      isSelected: isWindowSelected(state, window.id),
      rect: scaleRect(window.rect, bounds, scale, offset),
      windowId: window.id,
    })),
  };
}

/**
 * Converts a point in overview pixels to the world point under it, for click-to-navigate. Must
 * stay the exact inverse of the projection above; pass the result to `navigateToPoint`.
 */
function getInfiniteCanvasMinimapWorldPoint(
  layout: InfiniteCanvasMinimapLayout,
  minimapPoint: InfiniteCanvasPoint,
): InfiniteCanvasPoint {
  return {
    x: layout.bounds.x + (minimapPoint.x - layout.offset.x) / layout.scale,
    y: layout.bounds.y + (minimapPoint.y - layout.offset.y) / layout.scale,
  };
}

export { getInfiniteCanvasMinimapLayout, getInfiniteCanvasMinimapWorldPoint };
export type {
  InfiniteCanvasMinimapGroup,
  InfiniteCanvasMinimapLayout,
  InfiniteCanvasMinimapOptions,
  InfiniteCanvasMinimapWindow,
};
