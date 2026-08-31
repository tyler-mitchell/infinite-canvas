import type { InfiniteCanvasRect, InfiniteCanvasSize } from "./types";

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

/** Returns the nearest in-bounds rect with the least occupied area. */
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
  // Include the gap when measuring occupied area.
  const coveredArea = (candidate: InfiniteCanvasRect) =>
    occupied.reduce((total, taken) => {
      const width =
        Math.min(candidate.x + candidate.width + gapPx, taken.x + taken.width) -
        Math.max(candidate.x - gapPx, taken.x);
      const height =
        Math.min(candidate.y + candidate.height + gapPx, taken.y + taken.height) -
        Math.max(candidate.y - gapPx, taken.y);

      return total + (width > 0 && height > 0 ? width * height : 0);
    }, 0);

  if (coveredArea(preferred) === 0) {
    return preferred;
  }

  const stepX = preferred.width + gapPx;
  const stepY = preferred.height + gapPx;
  const columns = Math.max(Math.floor(bounds.width / stepX), 1);
  const rows = Math.max(Math.floor(bounds.height / stepY), 1);
  // Sort the loose grid by distance from the preferred origin.
  const candidates = Array.from({ length: columns * rows }, (_unused, index) => ({
    height: preferred.height,
    width: preferred.width,
    x: bounds.x + (index % columns) * stepX,
    y: bounds.y + Math.floor(index / columns) * stepY,
  })).sort(
    (left, right) =>
      (left.x - preferred.x) ** 2 +
      (left.y - preferred.y) ** 2 -
      ((right.x - preferred.x) ** 2 + (right.y - preferred.y) ** 2),
  );

  // Keep the nearest candidate with the least occupied area.
  return candidates.reduce(
    (best, candidate) => (coveredArea(candidate) < coveredArea(best) ? candidate : best),
    preferred,
  );
}

export { getInfiniteCanvasVacantRect, getInfiniteCanvasWindowPlacementRect };
export type { InfiniteCanvasWindowPlacementRegion };
