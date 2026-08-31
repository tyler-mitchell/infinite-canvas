import { getRectCenter, getVisibleWorldRect, rectContainsPoint } from "./geometry";
import { getInfiniteCanvasGroupProjection, getInfiniteCanvasWindowGroup } from "./group-state";
import { getInfiniteCanvasGroupWindowIds } from "./group-tree";
import type { InfiniteCanvasGroupAxis } from "./group-tree";
import { isSelectableWindow } from "./selection";
import type {
  InfiniteCanvasDirection,
  InfiniteCanvasPoint,
  InfiniteCanvasRect,
  InfiniteCanvasState,
  InfiniteCanvasWindow,
} from "./types";

/** Resolves keyboard focus by group context and directional geometry. */
/** World space grows down, as in the DOM. */
const INFINITE_CANVAS_DIRECTION_VECTORS = {
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
} as const satisfies Record<InfiniteCanvasDirection, InfiniteCanvasPoint>;

/** Returns signed distance along the movement direction. */
function getDistanceAlongDirection(
  direction: InfiniteCanvasDirection,
  from: InfiniteCanvasPoint,
  to: InfiniteCanvasPoint,
): number {
  const vector = INFINITE_CANVAS_DIRECTION_VECTORS[direction];

  return (to.x - from.x) * vector.x + (to.y - from.y) * vector.y;
}

/** Returns distance across the movement direction. */
function getDistanceAcrossDirection(
  direction: InfiniteCanvasDirection,
  from: InfiniteCanvasPoint,
  to: InfiniteCanvasPoint,
): number {
  const vector = INFINITE_CANVAS_DIRECTION_VECTORS[direction];

  return Math.abs((to.x - from.x) * -vector.y + (to.y - from.y) * vector.x);
}

function isHorizontalDirection(direction: InfiniteCanvasDirection): boolean {
  return direction === "left" || direction === "right";
}

/** Returns whether rects overlap across the movement axis. */
function overlapsAcrossDirection(
  direction: InfiniteCanvasDirection,
  source: InfiniteCanvasRect,
  candidate: InfiniteCanvasRect,
): boolean {
  const isHorizontal = isHorizontalDirection(direction);
  const sourceStart = isHorizontal ? source.y : source.x;
  const sourceEnd = sourceStart + (isHorizontal ? source.height : source.width);
  const candidateStart = isHorizontal ? candidate.y : candidate.x;
  const candidateEnd = candidateStart + (isHorizontal ? candidate.height : candidate.width);

  return candidateStart < sourceEnd && sourceStart < candidateEnd;
}

type InfiniteCanvasFocusCandidate = Readonly<{
  distanceAcross: number;
  distanceAlong: number;
  isBeside: boolean;
  windowId: string;
}>;

/** Ranks beside windows before near windows, with stable ID ties. */
function compareInfiniteCanvasFocusCandidates(
  left: InfiniteCanvasFocusCandidate,
  right: InfiniteCanvasFocusCandidate,
): number {
  if (left.isBeside !== right.isBeside) {
    return left.isBeside ? -1 : 1;
  }

  if (left.distanceAlong !== right.distanceAlong) {
    return left.distanceAlong - right.distanceAlong;
  }

  if (left.distanceAcross !== right.distanceAcross) {
    return left.distanceAcross - right.distanceAcross;
  }

  return left.windowId < right.windowId ? -1 : 1;
}

/** Returns the smallest group that contains the point. */
function getInfiniteCanvasContextualGroup<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  point: InfiniteCanvasPoint,
): InfiniteCanvasState<Kind>["groups"][number] | null {
  let contextualGroup: InfiniteCanvasState<Kind>["groups"][number] | null = null;
  let smallestArea = Number.POSITIVE_INFINITY;

  for (const group of state.groups) {
    if (!rectContainsPoint(group.rect, point)) {
      continue;
    }

    const area = group.rect.width * group.rect.height;
    const isTighter =
      area < smallestArea ||
      (area === smallestArea && contextualGroup !== null && group.id < contextualGroup.id);

    if (isTighter) {
      smallestArea = area;
      contextualGroup = group;
    }
  }

  return contextualGroup;
}

/** Excludes minimized and hidden group members. */
function getFocusableInfiniteCanvasWindows<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
): readonly InfiniteCanvasWindow<Kind>[] {
  const { hiddenWindowIds } = getInfiniteCanvasGroupProjection(state.groups, state.groupMetrics);

  return state.windows.filter(
    (window) => isSelectableWindow(window) && !hiddenWindowIds.has(window.id),
  );
}

/** Returns the nearest candidate ahead of the source. */
function getDirectionalTargetAmong<Kind extends string>(
  source: InfiniteCanvasWindow<Kind>,
  candidates: readonly InfiniteCanvasWindow<Kind>[],
  direction: InfiniteCanvasDirection,
): string | null {
  const sourceCenter = getRectCenter(source.rect);
  const ranked: InfiniteCanvasFocusCandidate[] = [];

  for (const window of candidates) {
    if (window.id === source.id) {
      continue;
    }

    const center = getRectCenter(window.rect);
    const distanceAlong = getDistanceAlongDirection(direction, sourceCenter, center);

    // Require the candidate center to be ahead of the source center.
    if (distanceAlong <= 0) {
      continue;
    }

    ranked.push({
      distanceAcross: getDistanceAcrossDirection(direction, sourceCenter, center),
      distanceAlong,
      isBeside: overlapsAcrossDirection(direction, source.rect, window.rect),
      windowId: window.id,
    });
  }

  return ranked.sort(compareInfiniteCanvasFocusCandidates)[0]?.windowId ?? null;
}

/** Returns the window nearest the camera center. */
function getInfiniteCanvasWindowNearestCameraCenter<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  windows: readonly InfiniteCanvasWindow<Kind>[],
): string | null {
  let nearestWindowId: string | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const window of windows) {
    const center = getRectCenter(window.rect);
    const distance = Math.hypot(center.x - state.camera.center.x, center.y - state.camera.center.y);
    const isNearer =
      distance < nearestDistance ||
      (distance === nearestDistance && nearestWindowId !== null && window.id < nearestWindowId);

    if (isNearer) {
      nearestDistance = distance;
      nearestWindowId = window.id;
    }
  }

  return nearestWindowId;
}

/** Returns the next focus target without wrapping. */
function getInfiniteCanvasDirectionalFocusTarget<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  direction: InfiniteCanvasDirection,
): string | null {
  const focusableWindows = getFocusableInfiniteCanvasWindows(state);
  const source = focusableWindows.find((window) => window.id === state.activeWindowId);

  if (source === undefined) {
    return getInfiniteCanvasWindowNearestCameraCenter(state, focusableWindows);
  }

  // Search the member group before the full canvas.
  const group =
    getInfiniteCanvasWindowGroup(state, source.id) ??
    getInfiniteCanvasContextualGroup(state, getRectCenter(source.rect));

  if (group !== null) {
    const memberIds = new Set(getInfiniteCanvasGroupWindowIds(group.tree));
    const localTarget = getDirectionalTargetAmong(
      source,
      focusableWindows.filter((window) => memberIds.has(window.id)),
      direction,
    );

    if (localTarget !== null) {
      return localTarget;
    }
  }

  return getDirectionalTargetAmong(source, focusableWindows, direction);
}

/** Returns full visibility. An unmeasured viewport returns true. */
function isInfiniteCanvasWindowFullyVisible<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  rect: InfiniteCanvasRect,
): boolean {
  if (state.viewport.width <= 0 || state.viewport.height <= 0) {
    return true;
  }

  const visible = getVisibleWorldRect(state.camera, state.viewport, 0);

  return (
    rect.x >= visible.x &&
    rect.y >= visible.y &&
    rect.x + rect.width <= visible.x + visible.width &&
    rect.y + rect.height <= visible.y + visible.height
  );
}

/** Returns the next tab or accordion index for the pressed navigation key. */
function getNextInfiniteCanvasRovingIndex(
  key: string,
  index: number,
  count: number,
  axis: InfiniteCanvasGroupAxis,
): number | null {
  const previousKey = axis === "horizontal" ? "ArrowLeft" : "ArrowUp";
  const nextKey = axis === "horizontal" ? "ArrowRight" : "ArrowDown";

  if (key === previousKey) {
    return (index - 1 + count) % count;
  }

  if (key === nextKey) {
    return (index + 1) % count;
  }

  if (key === "Home") {
    return 0;
  }

  return key === "End" ? count - 1 : null;
}

export {
  INFINITE_CANVAS_DIRECTION_VECTORS,
  getInfiniteCanvasContextualGroup,
  getInfiniteCanvasDirectionalFocusTarget,
  getInfiniteCanvasWindowNearestCameraCenter,
  getNextInfiniteCanvasRovingIndex,
  isInfiniteCanvasWindowFullyVisible,
};
export type { InfiniteCanvasFocusCandidate };
