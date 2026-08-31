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

/** @experimental Calculates edge indicators for offscreen groups and windows. */
type InfiniteCanvasOffscreenTargetKind = "group" | "window";

type InfiniteCanvasOffscreenIndicator = Readonly<{
  /** Radians from the viewport center. Zero points right. */
  angle: number;
  /** Screen-pixel distance from the viewport center. */
  distancePx: number;
  id: string;
  /** True for the active window or its group. */
  isActive: boolean;
  kind: InfiniteCanvasOffscreenTargetKind;
  /** Screen-pixel position on the inset viewport edge. */
  point: InfiniteCanvasPoint;
  /** Target rect in world units. */
  rect: InfiniteCanvasRect;
  /** Number of merged targets represented by this indicator. */
  targetCount: number;
}>;

type InfiniteCanvasOffscreenOptions = Readonly<{
  /** Screen-pixel inset from the viewport edge. */
  insetPx?: number;
  /** Maximum result count, sorted nearest first. */
  limit?: number;
  /** Extra screen pixels before a target counts as offscreen. */
  marginPx?: number;
  /** Merge distance in screen pixels. Zero disables merging. */
  mergeWithinPx?: number;
}>;

const DEFAULT_OFFSCREEN_INSET_PX = 24;

const DEFAULT_OFFSCREEN_MERGE_WITHIN_PX = 28;

/** Projects a ray to the inset edge. A zero delta returns the center. */
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

/** Returns offscreen targets nearest first. Invalid geometry returns an empty list. */
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
  // Measure the visible content area because chrome can cover the element.
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

  // Apply the active workspace filter to all targets.
  const admitted = getInfiniteCanvasWorkspaceWindowIds(state);
  const targets = [
    // One admitted member admits its complete group.
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
    // Group projection owns all group member rects, including hidden tabs.
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

  // Merge before the limit so one direction cannot consume all slots.
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
