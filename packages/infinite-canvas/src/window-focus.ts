import { getRectCenter, getVisibleWorldRect, rectContainsPoint } from "./geometry";
import { getInfiniteCanvasGroupProjection, getInfiniteCanvasWindowGroup } from "./group-state";
import { getInfiniteCanvasGroupWindowIds } from "./group-tree";
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
 * Focus is two-tiered (FOCUS-001). Inside a group, the arrow first looks at the
 * group's own members: a window docked beside you in a split is a nearer
 * neighbour, in the sense the user means, than a floating window that happens to
 * be geometrically closer. Only when the group has nothing in that direction does
 * the arrow leave it and search the whole canvas.
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

/**
 * The smallest group whose rect contains `point`, or `null` (FOCUS-002).
 *
 * A floating window sitting over a shell has no membership, but it has a **contextual
 * parent**: the group it is spatially inside. Directional focus searches that group's
 * members before it searches the canvas, so a floating window does not need a keyboard
 * model of its own — which is the whole mitigation for the "focus model fragments" risk in
 * `research/state-focus-and-recipes.md`.
 *
 * Smallest wins, because group rects can overlap and the tighter one is the one the window
 * is really "in". Area ties break on group id, so an arrow key is never ambiguous.
 */
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

/**
 * A window behind an inactive tab or a collapsed fold is solved into a rect, but
 * nothing draws it. Focusing it would move `aria-current` onto something invisible.
 */
function getFocusableInfiniteCanvasWindows<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
): readonly InfiniteCanvasWindow<Kind>[] {
  const { hiddenWindowIds } = getInfiniteCanvasGroupProjection(state.groups);

  return state.windows.filter(
    (window) => isSelectableWindow(window) && !hiddenWindowIds.has(window.id),
  );
}

/** The nearest window strictly ahead of `source`, among `candidates`, or `null`. */
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

    // Strictly ahead. A window whose center sits level with ours is not "to the
    // right" of us, however far right its far edge reaches.
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

  // Group-local first (FOCUS-001). A pane docked beside you is the neighbour the
  // user means, even when a floating window happens to sit geometrically closer.
  //
  // A floating window gets the same tier through its **contextual parent** — the smallest
  // group its centre lies inside (FOCUS-002). Membership takes precedence and short-circuits
  // the scan: group rects may overlap, so a member's centre can sit inside a group that is
  // not its own, and its own tree is unambiguously the group it belongs to.
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
  getInfiniteCanvasContextualGroup,
  getInfiniteCanvasDirectionalFocusTarget,
  getInfiniteCanvasWindowNearestCameraCenter,
  isInfiniteCanvasWindowFullyVisible,
};
export type { InfiniteCanvasFocusCandidate };
