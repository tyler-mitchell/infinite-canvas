import {
  alignRectIn,
  centroidOfRect,
  clampRectWithin,
  intersectsRect,
  outsetRectBy,
  rectWithCentroid,
  unionRects,
  type Rect,
} from "./rect";
import { clamp, minMax } from "@thi.ng/math";
import { spiral2d } from "@thi.ng/grid-iterators";
import type { Size } from "./size";

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

export function getAdjacentRect({
  anchor,
  size,
  side,
  gap,
  occupied,
  bounds,
  stack = false,
}: {
  anchor: Rect;
  size: Size;
  side: "left" | "right" | "top" | "bottom";
  gap: number;
  occupied: readonly Rect[];
  bounds: Rect;
  stack?: boolean;
}): Rect {
  if (stack && (side === "left" || side === "right")) {
    const top = clamp(
      anchor.y,
      bounds.y,
      Math.max(bounds.y, bounds.y + bounds.height - size.height),
    );
    const x = side === "left" ? anchor.x - size.width - gap : anchor.x + anchor.width + gap;
    const y = occupied
      .filter((rect) => rect.x < x + size.width + gap && rect.x + rect.width + gap > x)
      .sort((a, b) => a.y - b.y)
      .reduce((y, rect) => {
        if (y + size.height + gap <= rect.y || y >= rect.y + rect.height + gap) return y;
        return rect.y + rect.height + gap;
      }, top);
    return { x, y, ...size };
  }
  const horizontal = side === "left" || side === "right";
  const before = side === "left" || side === "top";
  const axis = horizontal ? "x" : "y";
  const cross = horizontal ? "y" : "x";
  const extent = horizontal ? "width" : "height";
  const crossExtent = horizontal ? "height" : "width";
  const boundary = occupied
    .filter(
      (rect) =>
        rect[cross] < anchor[cross] + size[crossExtent] + gap &&
        rect[cross] + rect[crossExtent] + gap > anchor[cross],
    )
    .reduce(
      (edge, rect) =>
        before ? Math.min(edge, rect[axis]) : Math.max(edge, rect[axis] + rect[extent]),
      anchor[axis] + (before ? 0 : anchor[extent]),
    );
  return {
    ...anchor,
    ...size,
    [axis]: boundary + (before ? -size[extent] - gap : gap),
  };
}

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
    const width = clamp(size.width, ...minMax(minSize.width, bounds.width));
    const height = clamp(size.height, ...minMax(minSize.height, bounds.height));
    return rectWithCentroid(centroidOfRect(bounds), { width, height });
  }
  const fraction = regions[region];
  const width = Math.max(bounds.width * fraction.width, minSize.width);
  const height = Math.max(bounds.height * fraction.height, minSize.height);
  return alignRectIn(
    bounds,
    { width, height },
    { x: fraction.x > 0 ? 1 : 0, y: fraction.y > 0 ? 1 : 0 },
  );
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
  const preferred = clampRectWithin(requested, bounds);
  const isClear = (rect: Rect) => {
    const cleared = outsetRectBy(rect, gap);
    return !occupied.some((taken) => intersectsRect(cleared, taken));
  };
  const span = reach * 2 + 1;
  for (const [column, row] of spiral2d({ cols: span, rows: span })) {
    const rect = {
      ...preferred,
      x: preferred.x + (column - reach) * (preferred.width + gap),
      y: preferred.y + (row - reach) * (preferred.height + gap),
    };
    if (isClear(rect)) return rect;
  }
  const occupiedBounds = unionRects(occupied);
  return occupiedBounds === null
    ? preferred
    : { ...preferred, y: occupiedBounds.y + occupiedBounds.height + gap };
}
