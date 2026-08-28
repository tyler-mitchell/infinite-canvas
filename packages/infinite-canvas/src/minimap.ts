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
  /**
   * Where the camera is looking, in overview pixels — `null` when it contains everything drawn, in
   * which case it would trace the box's own edge and say nothing.
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
 * Returns `null` for an unmeasured (`0 × 0`) viewport, a canvas with nothing drawn on this
 * desktop, or a box too small to hold its own padding. Rendering nothing beats rendering a
 * degenerate projection.
 *
 * "Nothing drawn" is this function's own filtered set, not `state.windows`: a desktop holding none
 * of the canvas's windows has nothing to map even though the canvas is full.
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
  /*
   * A desktop hides windows, so the map may not draw them either.
   *
   * This filtered minimized windows and folded group members and stopped there, which made the
   * overview the last surface still claiming a canvas holds everything in `state.windows`. Standing
   * on a desktop drew a map of windows that are not rendered — and worse than drawing them, they
   * are unioned into `bounds` below, so every window you *can* see shrinks to make room for ones
   * you cannot. An empty desktop produced a map full of content over a blank canvas.
   *
   * This function's own docstring already stated the rule it was breaking: an overview is a map of
   * what is on screen to be found. `window.reveal` and the offscreen ring each took this same
   * correction; the map was the third surface filtering on `minimized` alone.
   *
   * `null` means no workspace is active and admits everything, so a canvas that never creates a
   * desktop is unaffected.
   */
  const admitted = getInfiniteCanvasWorkspaceWindowIds(state);
  const drawnWindows = state.windows.filter(
    (window) =>
      window.mode !== "minimized" &&
      !hiddenWindowIds.has(window.id) &&
      (admitted === null || admitted.has(window.id)),
  );
  // Membership is group-complete — a workspace admits all of a group's windows or none — so one
  // admitted member settles the group, matching how the offscreen ring reads the same set.
  const drawnGroups = state.groups.filter(
    (group) =>
      admitted === null ||
      getInfiniteCanvasGroupWindowIds(group.tree).some((windowId) => admitted.has(windowId)),
  );
  /*
   * Nothing to map is not a map, and this function said so before it did so.
   *
   * The docstring below promised `null` for an empty canvas and the code could not deliver it: the
   * camera's rect is unioned into `bounds` unconditionally — correctly, so a traveller is never
   * pushed out of the box — which also means `bounds` is never empty and the early return below
   * never fired. A canvas with no windows produced a layout whose only content was the viewport
   * indicator, and by construction that indicator then filled the entire box: `bounds` *is* the
   * visible rect, so the projection maps it onto the whole inner area, every time, at every zoom.
   *
   * That is the degenerate projection the rule at the bottom of this docstring exists to refuse. It
   * conveys nothing — it cannot move, cannot shrink, and answers "where am I in it" with "there is
   * no it". Found by drawing this in a browser for the first time, which is also the first time
   * anybody could have seen it.
   */
  if (drawnWindows.length === 0 && drawnGroups.length === 0) {
    return null;
  }

  const visibleWorldRect = getVisibleWorldRect(state.camera, state.viewport, 0);
  // Separately, because whether the camera already contains the content decides the indicator.
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
