import { getRectCenter, getVisibleWorldRect } from "./geometry";
import { isSelectableWindow } from "./selection";
import type {
  InfiniteCanvasDirection,
  InfiniteCanvasPoint,
  InfiniteCanvasRect,
  InfiniteCanvasState,
  InfiniteCanvasWindow,
} from "./types";

/**
 * Directional focus: which window an arrow key moves to (FR-9).
 *
 * The rule, and it is the one i3 and AeroSpace settled on: **arrow keys must not
 * drift diagonally.** A window that sits beside you — one whose span overlaps
 * yours on the cross axis — always beats a window that is merely nearer but off
 * to the side. Pressing Right twice and Left twice should return you where you
 * started, and that only holds if "beside" outranks "close".
 *
 * Everything here is pure geometry over `state.windows`. No DOM, no group model,
 * so this lands before P1 and keeps working after it.
 *
 * Scope: this is the *global geometric* tier of FOCUS-001. The group-local tier
 * that scenario says should be preferred first needs P1's group model, and this
 * becomes its fallback rather than its replacement.
 */

/** World space grows downward, matching the DOM — and matching `window.nudge`. */
const INFINITE_CANVAS_DIRECTION_VECTORS = {
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
} as const satisfies Record<InfiniteCanvasDirection, InfiniteCanvasPoint>;

/** How far `to` lies along `direction` from `from`. Negative means behind. */
function getDistanceAlongDirection(
  direction: InfiniteCanvasDirection,
  from: InfiniteCanvasPoint,
  to: InfiniteCanvasPoint,
): number {
  const vector = INFINITE_CANVAS_DIRECTION_VECTORS[direction];

  return (to.x - from.x) * vector.x + (to.y - from.y) * vector.y;
}

/** How far `to` strays off the axis. The perpendicular of `(x, y)` is `(-y, x)`. */
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

/** The span both rects must share for the candidate to count as "beside" the source. */
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

/**
 * Beside beats near; near beats aligned; the window id breaks the last tie so a
 * focus move is never ambiguous for two windows stacked at the same point.
 */
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

function getFocusableInfiniteCanvasWindows<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
): readonly InfiniteCanvasWindow<Kind>[] {
  return state.windows.filter(isSelectableWindow);
}

/**
 * With nothing focused, an arrow key has no origin to move from. Entering at the
 * window nearest the camera's center means the keyboard always has a way in,
 * from wherever the user has panned to.
 */
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

/**
 * The window an arrow key moves focus to, or `null` when there is nowhere to go.
 * Focus does not wrap: running out of windows to the right is a dead end, not a
 * jump back to the left edge of the world.
 */
function getInfiniteCanvasDirectionalFocusTarget<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  direction: InfiniteCanvasDirection,
): string | null {
  const focusableWindows = getFocusableInfiniteCanvasWindows(state);
  const source = focusableWindows.find((window) => window.id === state.activeWindowId);

  if (source === undefined) {
    return getInfiniteCanvasWindowNearestCameraCenter(state, focusableWindows);
  }

  const sourceCenter = getRectCenter(source.rect);
  const candidates: InfiniteCanvasFocusCandidate[] = [];

  for (const window of focusableWindows) {
    if (window.id === source.id) {
      continue;
    }

    const center = getRectCenter(window.rect);
    const distanceAlong = getDistanceAlongDirection(direction, sourceCenter, center);

    // Strictly ahead. A window whose center sits level with ours is not "to the
    // right" of us, however far right its far edge reaches.
    if (distanceAlong <= 0) {
      continue;
    }

    candidates.push({
      distanceAcross: getDistanceAcrossDirection(direction, sourceCenter, center),
      distanceAlong,
      isBeside: overlapsAcrossDirection(direction, source.rect, window.rect),
      windowId: window.id,
    });
  }

  return candidates.sort(compareInfiniteCanvasFocusCandidates)[0]?.windowId ?? null;
}

/**
 * Whether a rect sits entirely inside what the camera can see right now. Used to
 * decide if focusing a window should also move the camera: recentring on every
 * arrow press would be nauseating, and never recentring would let focus escape
 * offscreen where the user cannot see what they selected.
 *
 * A zero-area viewport has not been measured yet, so nothing can be offscreen.
 */
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

export {
  INFINITE_CANVAS_DIRECTION_VECTORS,
  getInfiniteCanvasDirectionalFocusTarget,
  getInfiniteCanvasWindowNearestCameraCenter,
  isInfiniteCanvasWindowFullyVisible,
};
export type { InfiniteCanvasFocusCandidate };
