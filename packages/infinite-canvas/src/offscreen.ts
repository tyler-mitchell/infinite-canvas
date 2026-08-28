import {
  getInfiniteCanvasContentViewport,
  getRectCenter,
  isUsableViewport,
  isWorldRectWithinViewport,
  worldPointToScreenPoint,
} from "./geometry";
import { getInfiniteCanvasGroupProjection } from "./group-state";
import { getInfiniteCanvasGroupWindowIds } from "./group-tree";
import type { InfiniteCanvasPoint, InfiniteCanvasRect, InfiniteCanvasState } from "./types";
import { getInfiniteCanvasWorkspaceWindowIds } from "./workspace-membership";

/**
 * Computes edge indicators for windows outside the viewport. Returns geometry, not markup.
 *
 * A group produces one indicator rather than one per pane. Minimized windows are omitted.
 * Tab-hidden windows are omitted individually but counted through their group. Indicators landing
 * on the same pixel are merged; see `mergeWithinPx`.
 *
 * @experimental Landed 2026-07-08.
 */

type InfiniteCanvasOffscreenTargetKind = "group" | "window";

type InfiniteCanvasOffscreenIndicator = Readonly<{
  /**
   * Bearing from the viewport centre, in radians per `Math.atan2`. `0` points right and the angle
   * grows clockwise; rotate a right-pointing arrow by this and it aims at the target.
   */
  angle: number;
  /** Screen pixels from the viewport centre to the target's centre. The sort key, nearest first. */
  distancePx: number;
  /** The window id or the group id, per `kind`. */
  id: string;
  /** True for the active window, or the group containing it. At most one indicator is true. */
  isActive: boolean;
  kind: InfiniteCanvasOffscreenTargetKind;
  /** Draw position in screen pixels: on the inset viewport edge, along `angle`. */
  point: InfiniteCanvasPoint;
  /** The target's world rect. Pass to `navigateToRect`, or its centre to `navigateToPoint`. */
  rect: InfiniteCanvasRect;
  /**
   * How many targets this indicator represents, including itself. Merged targets are not returned
   * separately.
   */
  targetCount: number;
}>;

type InfiniteCanvasOffscreenOptions = Readonly<{
  /** Screen pixels to inset the indicator ring from the viewport edge, so arrows are not clipped. */
  insetPx?: number;
  /**
   * Maximum indicators returned, nearest first. Unbounded by default. A consumer that caps should
   * indicate so in its UI, since the result otherwise looks complete.
   */
  limit?: number;
  /**
   * Screen pixels of slack before a target counts as offscreen, matching
   * `isWorldRectWithinViewport`. A non-finite margin means nothing is ever offscreen, and this
   * returns an empty array.
   */
  marginPx?: number;
  /**
   * Merge indicators landing within this many screen pixels of a nearer one, which keeps the count.
   * `0` disables merging.
   *
   * Measured in pixels rather than degrees because the ring is a rectangle, so the same angular
   * separation spans tens of pixels along an edge and almost none near a corner.
   */
  mergeWithinPx?: number;
}>;

const DEFAULT_OFFSCREEN_INSET_PX = 24;

/** Approximately the size of a chip, which is what consumers draw at each point. */
const DEFAULT_OFFSCREEN_MERGE_WITHIN_PX = 28;

/**
 * Projects a ray from the viewport centre onto the inset edge. `t` is the smaller of the two axis
 * crossings, since the ray exits whichever edge it reaches first.
 *
 * A zero `delta` has no direction and would produce `NaN`. It should be unreachable, but `NaN` in a
 * transform renders nothing, so it returns the centre instead.
 */
const projectOntoEdge = (
  center: InfiniteCanvasPoint,
  delta: InfiniteCanvasPoint,
  halfWidth: number,
  halfHeight: number,
): InfiniteCanvasPoint => {
  const horizontal = delta.x === 0 ? Number.POSITIVE_INFINITY : halfWidth / Math.abs(delta.x);
  const vertical = delta.y === 0 ? Number.POSITIVE_INFINITY : halfHeight / Math.abs(delta.y);
  const t = Math.min(horizontal, vertical);

  if (!Number.isFinite(t)) {
    return center;
  }

  return {
    x: center.x + delta.x * t,
    y: center.y + delta.y * t,
  };
};

/**
 * Returns every drawn target that does not overlap the viewport, nearest first.
 *
 * Returns empty for an unmeasured (`0 × 0`) viewport, and for an `insetPx` larger than the
 * viewport, since neither leaves a ring to place indicators on.
 */
function getInfiniteCanvasOffscreenIndicators<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  options: InfiniteCanvasOffscreenOptions = {},
): readonly InfiniteCanvasOffscreenIndicator[] {
  const {
    insetPx = DEFAULT_OFFSCREEN_INSET_PX,
    limit = Number.POSITIVE_INFINITY,
    marginPx = 0,
    mergeWithinPx = DEFAULT_OFFSCREEN_MERGE_WITHIN_PX,
  } = options;
  const { camera, viewport } = state;
  // Inset from the visible content area, not the element, or chrome would cover part of the ring.
  const content = getInfiniteCanvasContentViewport(viewport, state.viewportInsets);
  const halfWidth = content.width / 2 - insetPx;
  const halfHeight = content.height / 2 - insetPx;

  if (!isUsableViewport(viewport) || halfWidth <= 0 || halfHeight <= 0 || limit <= 0) {
    return [];
  }

  const { windowRects } = getInfiniteCanvasGroupProjection(state.groups, state.groupMetrics);
  const { activeWindowId } = state;
  const activeGroupId =
    activeWindowId === null
      ? null
      : (state.groups.find((group) =>
          getInfiniteCanvasGroupWindowIds(group.tree).includes(activeWindowId),
        )?.id ?? null);

  // Indicators point only at what the canvas draws, so the active workspace filters them too.
  // `null` means no workspace is active, which admits everything.
  const admitted = getInfiniteCanvasWorkspaceWindowIds(state);
  const targets = [
    // Membership is group-complete, so one admitted member settles the group. `some` rather than
    // `every` because an empty group admits nothing and has no rect to point at.
    ...state.groups
      .filter(
        (group) =>
          admitted === null ||
          getInfiniteCanvasGroupWindowIds(group.tree).some((windowId) => admitted.has(windowId)),
      )
      .map((group) => ({
        id: group.id,
        isActive: group.id === activeGroupId,
        kind: "group" as const,
        rect: group.rect,
      })),
    // `windowRects` holds every window a group placed, tab-hidden ones included, so `has` is the
    // membership test.
    ...state.windows
      .filter(
        (window) =>
          window.mode !== "minimized" &&
          !windowRects.has(window.id) &&
          (admitted === null || admitted.has(window.id)),
      )
      .map((window) => ({
        id: window.id,
        isActive: window.id === activeWindowId,
        kind: "window" as const,
        rect: window.rect,
      })),
  ];

  const screenCenter = {
    x: content.x + content.width / 2,
    y: content.y + content.height / 2,
  };

  const projected = targets
    .filter((target) => !isWorldRectWithinViewport(camera, viewport, target.rect, marginPx))
    .map((target) => {
      const targetCenter = worldPointToScreenPoint(camera, viewport, getRectCenter(target.rect));
      const delta = { x: targetCenter.x - screenCenter.x, y: targetCenter.y - screenCenter.y };

      return {
        ...target,
        angle: Math.atan2(delta.y, delta.x),
        distancePx: Math.hypot(delta.x, delta.y),
        point: projectOntoEdge(screenCenter, delta, halfWidth, halfHeight),
        targetCount: 1,
      };
    })
    .sort((left, right) => left.distancePx - right.distancePx);

  // Fold what lands on the same pixel, nearest kept. Before `limit`, or a cap of five spent in one
  // direction would hide every other.
  const folded =
    mergeWithinPx <= 0
      ? projected
      : projected.reduce<(typeof projected)[number][]>((kept, candidate) => {
          const nearer = kept.find(
            (indicator) =>
              Math.hypot(
                indicator.point.x - candidate.point.x,
                indicator.point.y - candidate.point.y,
              ) <= mergeWithinPx,
          );

          if (nearer === undefined) {
            return [...kept, candidate];
          }

          nearer.targetCount += 1;

          return kept;
        }, []);

  return folded.slice(0, limit);
}

export { getInfiniteCanvasOffscreenIndicators };
export type {
  InfiniteCanvasOffscreenIndicator,
  InfiniteCanvasOffscreenOptions,
  InfiniteCanvasOffscreenTargetKind,
};
