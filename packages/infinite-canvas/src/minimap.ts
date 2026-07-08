import { getVisibleWorldRect, isUsableViewport, unionRects } from "./geometry";
import { getInfiniteCanvasGroupProjection } from "./group-state";
import { isWindowSelected } from "./selection";
import type {
  InfiniteCanvasPoint,
  InfiniteCanvasRect,
  InfiniteCanvasSize,
  InfiniteCanvasState,
} from "./types";

/**
 * A world overview, as geometry rather than as a widget.
 *
 * An infinite canvas has a failure mode nothing bounded does: **you can pan into empty space
 * and lose everything.** Fit-all, directional focus, and recipes all recover you *after* you
 * are lost; none of them tell you where you are. An overview is the only affordance that
 * answers "where is everything, and where am I in it" continuously.
 *
 * This module computes the overview and draws nothing, which is the same bargain the rest of
 * the framework strikes: components emit structure and a `data-slot` vocabulary and carry no
 * visual identity. A minimap is almost entirely a projection problem — world rects into a
 * small box, and a click in that box back into the world — and the projection is what a
 * consumer cannot easily get right. The rounded corners are what they can.
 *
 * Pure: no DOM, no React, no store. It composes from the same `unionRects` and
 * `getVisibleWorldRect` a consumer already has, which is the point — nothing here is
 * privileged, and a consumer who wants a different overview can write one.
 *
 * @experimental Landed 2026-07-08 and no minimap has been drawn in a browser. The shape may change.
 */

/** A window as the overview sees it: a box, and the two states worth styling differently. */
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
   * Overview pixels from the box's top-left to `bounds`' top-left: the padding, plus the
   * centring slack on whichever axis had room left over.
   *
   * Carried rather than recomputed so `getInfiniteCanvasMinimapWorldPoint` is the exact
   * inverse of the projection. Reconstructing it there would be a second implementation of
   * the same arithmetic, and the two would disagree at the edges — the camera landing a few
   * units from where the user clicked.
   */
  offset: InfiniteCanvasPoint;
  /** World units → overview pixels. Uniform on both axes: an overview must not distort. */
  scale: number;
  /** Where the camera is looking, in overview pixels. Always inside the box, by construction. */
  viewport: InfiniteCanvasRect;
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
 * Project the canvas into a box of `size` overview pixels, or `null` when there is nothing to
 * show.
 *
 * **The camera's visible rect is unioned into the bounds.** Without it, panning away from
 * every window would push the viewport indicator outside the box and the overview would show
 * you a world you are no longer in — which is precisely the moment you reached for it. With
 * it, the content shrinks as you travel, and the indicator always has somewhere to be.
 *
 * Windows behind an inactive tab or a collapsed accordion fold are omitted: they are solved
 * into a rect, but nothing draws them, and an overview is a map of what is on screen to be
 * found. A minimized window has no rect at all.
 *
 * Returns `null` for an unmeasured (`0 × 0`) viewport, an empty canvas, or a box too small to
 * hold its own padding. Rendering nothing beats rendering a degenerate projection.
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

  const { hiddenWindowIds } = getInfiniteCanvasGroupProjection(state.groups);
  const drawnWindows = state.windows.filter(
    (window) => window.mode !== "minimized" && !hiddenWindowIds.has(window.id),
  );
  const visibleWorldRect = getVisibleWorldRect(state.camera, state.viewport, 0);
  const bounds = unionRects([
    ...drawnWindows.map((window) => window.rect),
    ...state.groups.map((group) => group.rect),
    visibleWorldRect,
  ]);

  if (bounds === null || bounds.width <= 0 || bounds.height <= 0) {
    return null;
  }

  // Uniform scale, and the content centred in whatever axis has room left over. Fitting each
  // axis independently would stretch the world, and a map that lies about aspect ratio is
  // worse than no map.
  const scale = Math.min(innerWidth / bounds.width, innerHeight / bounds.height);
  const offset = {
    x: paddingPx + (innerWidth - bounds.width * scale) / 2,
    y: paddingPx + (innerHeight - bounds.height * scale) / 2,
  };

  return {
    bounds,
    groups: state.groups.map((group) => ({
      groupId: group.id,
      rect: scaleRect(group.rect, bounds, scale, offset),
    })),
    offset,
    scale,
    viewport: scaleRect(visibleWorldRect, bounds, scale, offset),
    windows: drawnWindows.map((window) => ({
      isActive: state.activeWindowId === window.id,
      isSelected: isWindowSelected(state, window.id),
      rect: scaleRect(window.rect, bounds, scale, offset),
      windowId: window.id,
    })),
  };
}

/**
 * A point in overview pixels → the world point under it, for click-to-navigate.
 *
 * The inverse of the projection above, and it must stay the inverse: a consumer that
 * re-derives it will disagree at the edges, and the camera will land a few units from where
 * the user clicked. Hand the result to `navigateToPoint`.
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
