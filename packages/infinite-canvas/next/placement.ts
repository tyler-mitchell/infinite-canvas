import { unionRects, type Rect, type Size } from "./geometry";

const regions = {
  left: { x: 0, y: 0, width: 0.5, height: 1 },
  right: { x: 0.5, y: 0, width: 0.5, height: 1 },
  top: { x: 0, y: 0, width: 1, height: 0.5 },
  bottom: { x: 0, y: 0.5, width: 1, height: 0.5 },
  "top-left": { x: 0, y: 0, width: 0.5, height: 0.5 },
  "top-right": { x: 0.5, y: 0, width: 0.5, height: 0.5 },
  "bottom-left": { x: 0, y: 0.5, width: 0.5, height: 0.5 },
  "bottom-right": { x: 0.5, y: 0.5, width: 0.5, height: 0.5 },
  fill: { x: 0, y: 0, width: 1, height: 1 },
};

export type PlacementRegion = keyof typeof regions | "center";

export function getPlacementRect({
  bounds,
  region,
  size,
  minSize,
}: {
  bounds: Rect;
  region: PlacementRegion;
  size: Size;
  minSize: Size;
}): Rect {
  if (region === "center") {
    const width = Math.max(Math.min(size.width, bounds.width), minSize.width);
    const height = Math.max(Math.min(size.height, bounds.height), minSize.height);
    return {
      x: bounds.x + (bounds.width - width) / 2,
      y: bounds.y + (bounds.height - height) / 2,
      width,
      height,
    };
  }
  const fraction = regions[region];
  const width = Math.max(bounds.width * fraction.width, minSize.width);
  const height = Math.max(bounds.height * fraction.height, minSize.height);
  return {
    width,
    height,
    x: fraction.x > 0 ? bounds.x + bounds.width - width : bounds.x,
    y: fraction.y > 0 ? bounds.y + bounds.height - height : bounds.y,
  };
}

export function getVacantRect({
  bounds,
  preferred: requested,
  occupied,
  gap,
  reach,
}: {
  bounds: Rect;
  preferred: Rect;
  occupied: readonly Rect[];
  gap: number;
  reach: number;
}): Rect {
  const preferred = {
    ...requested,
    x: Math.max(bounds.x, Math.min(requested.x, bounds.x + bounds.width - requested.width)),
    y: Math.max(bounds.y, Math.min(requested.y, bounds.y + bounds.height - requested.height)),
  };
  const isClear = (rect: Rect) =>
    !occupied.some(
      (taken) =>
        Math.min(rect.x + rect.width + gap, taken.x + taken.width) >
          Math.max(rect.x - gap, taken.x) &&
        Math.min(rect.y + rect.height + gap, taken.y + taken.height) >
          Math.max(rect.y - gap, taken.y),
    );
  if (isClear(preferred)) return preferred;
  const span = reach * 2 + 1;
  const candidates = Array.from({ length: span * span }, (_, index) => ({
    ...preferred,
    x: preferred.x + ((index % span) - reach) * (preferred.width + gap),
    y: preferred.y + (Math.floor(index / span) - reach) * (preferred.height + gap),
  })).sort(
    (left, right) =>
      Math.hypot(left.x - preferred.x, left.y - preferred.y) -
      Math.hypot(right.x - preferred.x, right.y - preferred.y),
  );
  const clear = candidates.find(isClear);
  if (clear !== undefined) return clear;
  const occupiedBounds = unionRects(occupied);
  return occupiedBounds === null
    ? preferred
    : { ...preferred, y: occupiedBounds.y + occupiedBounds.height + gap };
}
