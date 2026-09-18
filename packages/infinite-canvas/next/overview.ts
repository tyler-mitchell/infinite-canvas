import { intersectsRect, unionRects, type Point, type Rect, type Size } from "./geometry";

export type MinimapLayout = {
  scale: number;
  bounds: Rect;
  items: Record<string, Rect>;
  viewport: Rect;
};

export function getMinimapLayout({
  rects,
  viewport,
  size,
  padding = 0,
}: {
  rects: Readonly<Record<string, Rect>>;
  viewport: Rect;
  size: Size;
  padding?: number;
}): MinimapLayout | null {
  const bounds = unionRects([...Object.values(rects), viewport])!;
  const width = size.width - padding * 2;
  const height = size.height - padding * 2;
  if (width <= 0 || height <= 0 || bounds.width <= 0 || bounds.height <= 0) return null;
  const scale = Math.min(width / bounds.width, height / bounds.height);
  const origin = {
    x: (size.width - bounds.width * scale) / 2,
    y: (size.height - bounds.height * scale) / 2,
  };
  const project = (rect: Rect): Rect => ({
    x: origin.x + (rect.x - bounds.x) * scale,
    y: origin.y + (rect.y - bounds.y) * scale,
    width: rect.width * scale,
    height: rect.height * scale,
  });
  return {
    scale,
    bounds,
    viewport: project(viewport),
    items: Object.fromEntries(Object.entries(rects).map(([key, rect]) => [key, project(rect)])),
  };
}

export function getMinimapWorldPoint({
  layout,
  size,
  point,
}: {
  layout: MinimapLayout;
  size: Size;
  point: Point;
}): Point {
  return {
    x:
      layout.bounds.x +
      (point.x - (size.width - layout.bounds.width * layout.scale) / 2) / layout.scale,
    y:
      layout.bounds.y +
      (point.y - (size.height - layout.bounds.height * layout.scale) / 2) / layout.scale,
  };
}

export type DetailLevel = "full" | "summary";

export function getDetailLevel({
  width,
  previous,
  summaryBelow,
  fullAbove,
}: {
  width: number;
  previous: DetailLevel;
  summaryBelow: number;
  fullAbove: number;
}): DetailLevel {
  if (width < summaryBelow) return "summary";
  return width >= fullAbove ? "full" : previous;
}

export type OffscreenIndicator = {
  key: string;
  rect: Rect;
  angle: number;
  edge: Point;
  distance: number;
};

export function getOffscreenIndicators({
  rects,
  viewport,
}: {
  rects: Readonly<Record<string, Rect>>;
  viewport: Rect;
}): OffscreenIndicator[] {
  if (viewport.width <= 0 || viewport.height <= 0) return [];
  const center = { x: viewport.x + viewport.width / 2, y: viewport.y + viewport.height / 2 };
  return Object.entries(rects)
    .flatMap(([key, rect]) => {
      if (intersectsRect({ rect, other: viewport })) return [];
      const delta = {
        x: rect.x + rect.width / 2 - center.x,
        y: rect.y + rect.height / 2 - center.y,
      };
      const reach = Math.min(
        delta.x === 0 ? Infinity : viewport.width / 2 / Math.abs(delta.x),
        delta.y === 0 ? Infinity : viewport.height / 2 / Math.abs(delta.y),
      );
      return [
        {
          key,
          rect,
          angle: Math.atan2(delta.y, delta.x),
          distance: Math.hypot(delta.x, delta.y),
          edge: {
            x: 0.5 + (delta.x * reach) / viewport.width,
            y: 0.5 + (delta.y * reach) / viewport.height,
          },
        },
      ];
    })
    .toSorted((left, right) => left.distance - right.distance);
}
