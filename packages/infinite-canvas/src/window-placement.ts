import {
  getInfiniteCanvasContentWorldRect,
  getInfiniteCanvasOccluderWorldRects,
  unionRects,
} from "./geometry";
import type {
  InfiniteCanvasRect,
  InfiniteCanvasSize,
  InfiniteCanvasState,
  InfiniteCanvasWindow,
} from "./types";
import { isInfiniteCanvasWindowInActiveWorkspace } from "./workspace-membership";

/** Calculates fixed window placement regions without snapping. */
type InfiniteCanvasWindowPlacementRegion =
  | "bottom"
  | "bottom-left"
  | "bottom-right"
  | "center"
  | "fill"
  | "left"
  | "right"
  | "top"
  | "top-left"
  | "top-right";

/** Placement origin and size as fractions of bounds. */
type PlacementFractions = Readonly<{ height: number; width: number; x: number; y: number }>;

const PLACEMENT_FRACTIONS: Readonly<
  Record<Exclude<InfiniteCanvasWindowPlacementRegion, "center">, PlacementFractions>
> = {
  bottom: { height: 0.5, width: 1, x: 0, y: 0.5 },
  "bottom-left": { height: 0.5, width: 0.5, x: 0, y: 0.5 },
  "bottom-right": { height: 0.5, width: 0.5, x: 0.5, y: 0.5 },
  fill: { height: 1, width: 1, x: 0, y: 0 },
  left: { height: 1, width: 0.5, x: 0, y: 0 },
  right: { height: 1, width: 0.5, x: 0.5, y: 0 },
  top: { height: 0.5, width: 1, x: 0, y: 0 },
  "top-left": { height: 0.5, width: 0.5, x: 0, y: 0 },
  "top-right": { height: 0.5, width: 0.5, x: 0.5, y: 0 },
};

/** Clamps extent and keeps the anchored edge fixed. */
function getClampedAxis(
  boundsOrigin: number,
  boundsExtent: number,
  fractionOrigin: number,
  fractionExtent: number,
  minimumExtent: number,
): Readonly<{ extent: number; origin: number }> {
  const extent = Math.max(boundsExtent * fractionExtent, minimumExtent);
  const isAnchoredToEnd = fractionOrigin + fractionExtent >= 1 && fractionOrigin > 0;
  const origin = isAnchoredToEnd
    ? boundsOrigin + boundsExtent - extent
    : boundsOrigin + boundsExtent * fractionOrigin;

  return { extent, origin };
}

/** Returns a region rect within bounds and enforces minimum size. */
function getInfiniteCanvasWindowPlacementRect(
  bounds: InfiniteCanvasRect,
  region: InfiniteCanvasWindowPlacementRegion,
  size: InfiniteCanvasSize,
  minSize: InfiniteCanvasSize = { height: 0, width: 0 },
): InfiniteCanvasRect {
  if (region === "center") {
    const width = Math.max(Math.min(size.width, bounds.width), minSize.width);
    const height = Math.max(Math.min(size.height, bounds.height), minSize.height);

    return {
      height,
      width,
      x: bounds.x + (bounds.width - width) / 2,
      y: bounds.y + (bounds.height - height) / 2,
    };
  }

  const fractions = PLACEMENT_FRACTIONS[region];
  const horizontal = getClampedAxis(
    bounds.x,
    bounds.width,
    fractions.x,
    fractions.width,
    minSize.width,
  );
  const vertical = getClampedAxis(
    bounds.y,
    bounds.height,
    fractions.y,
    fractions.height,
    minSize.height,
  );

  return {
    height: vertical.extent,
    width: horizontal.extent,
    x: horizontal.origin,
    y: vertical.origin,
  };
}

/** Rings of candidate spots searched around the preferred one. */
const VACANCY_REACH = 6;

/** Returns the nearest clear rect, preferring the visible region but not confined to it. */
function getInfiniteCanvasVacantRect(
  input: Readonly<{
    /** Allowed placement region. */
    bounds: InfiniteCanvasRect;
    /** Required gap between the result and occupants. */
    gapPx?: number;
    occupied: readonly InfiniteCanvasRect[];
    preferred: InfiniteCanvasRect;
  }>,
): InfiniteCanvasRect {
  const { bounds, gapPx = 0, occupied, preferred: requested } = input;
  // Clamp the origin to bounds. Oversize rects keep the bounds origin.
  const containedRect = (rect: InfiniteCanvasRect): InfiniteCanvasRect => ({
    height: rect.height,
    width: rect.width,
    x: Math.max(bounds.x, Math.min(rect.x, bounds.x + bounds.width - rect.width)),
    y: Math.max(bounds.y, Math.min(rect.y, bounds.y + bounds.height - rect.height)),
  });
  // Rank candidates from the nearest reachable position.
  const preferred = containedRect(requested);
  // The gap counts as occupied, so neighbours never touch.
  const isClear = (candidate: InfiniteCanvasRect) =>
    !occupied.some(
      (taken) =>
        Math.min(candidate.x + candidate.width + gapPx, taken.x + taken.width) >
          Math.max(candidate.x - gapPx, taken.x) &&
        Math.min(candidate.y + candidate.height + gapPx, taken.y + taken.height) >
          Math.max(candidate.y - gapPx, taken.y),
    );

  if (isClear(preferred)) {
    return preferred;
  }

  const stepX = preferred.width + gapPx;
  const stepY = preferred.height + gapPx;
  const span = VACANCY_REACH * 2 + 1;
  /*
   * Candidates grow outward from the preferred spot and pass outside `bounds` when they must.
   * A full viewport is a reason to look further out. It is never a reason to stack two windows on
   * one spot, which is what a search confined to the visible region has to do.
   */
  const candidates = Array.from({ length: span * span }, (_unused, index) => ({
    height: preferred.height,
    width: preferred.width,
    x: preferred.x + ((index % span) - VACANCY_REACH) * stepX,
    y: preferred.y + (Math.floor(index / span) - VACANCY_REACH) * stepY,
  })).sort(
    (left, right) =>
      (left.x - preferred.x) ** 2 +
      (left.y - preferred.y) ** 2 -
      ((right.x - preferred.x) ** 2 + (right.y - preferred.y) ** 2),
  );

  const clear = candidates.find(isClear);

  if (clear !== undefined) {
    return clear;
  }

  /*
   * Nothing clear within reach means the neighbourhood is full, which is a reason to look further
   * out and never a reason to stack. Past the bottom of everything occupied is clear at any x, so
   * the search always ends on a free spot instead of the least-bad overlap.
   */
  const occupiedBounds = unionRects(occupied);

  return occupiedBounds === null
    ? preferred
    : { ...preferred, y: occupiedBounds.y + occupiedBounds.height + gapPx };
}

/**
 * Asks for a rect instead of supplying one.
 *
 * A caller that computes a rect from a state snapshot places against the canvas as it was, not as
 * it is. Anything awaited between the two — a fetch, a database write — makes the snapshot older
 * still, and every window opened in one burst lands on the same spot.
 */
type InfiniteCanvasWindowPlacement = Readonly<{
  /** Required gap between the window and its neighbours. */
  gapPx?: number;
  /** Where to try first. Defaults to the middle of the visible region. */
  region?: InfiniteCanvasWindowPlacementRegion;
}>;

/** Returns where a window fits in the canvas as it is now. */
function getInfiniteCanvasPlacedWindowRect<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  window: InfiniteCanvasWindow<Kind>,
  placement: InfiniteCanvasWindowPlacement = {},
): InfiniteCanvasRect {
  const bounds = getInfiniteCanvasContentWorldRect(
    state.camera,
    state.viewport,
    state.viewportInsets,
  );

  return getInfiniteCanvasVacantRect({
    bounds,
    gapPx: placement.gapPx,
    occupied: [
      ...getInfiniteCanvasOccluderWorldRects(state.camera, state.viewport, state.viewportOccluders),
      ...state.groups.map((group) => group.rect),
      // A minimized window, or one on another workspace, reserves no space.
      ...state.windows
        .filter(
          (occupant) =>
            occupant.id !== window.id &&
            occupant.mode !== "minimized" &&
            isInfiniteCanvasWindowInActiveWorkspace(state, occupant.id),
        )
        .map((occupant) => occupant.rect),
    ],
    preferred: getInfiniteCanvasWindowPlacementRect(
      bounds,
      placement.region ?? "center",
      window.rect,
      window.minSize,
    ),
  });
}

export {
  getInfiniteCanvasPlacedWindowRect,
  getInfiniteCanvasVacantRect,
  getInfiniteCanvasWindowPlacementRect,
};
export type { InfiniteCanvasWindowPlacement, InfiniteCanvasWindowPlacementRegion };
