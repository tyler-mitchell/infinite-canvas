import { compareByKey } from "@thi.ng/compare";
import {
  centroidOfRect,
  fitRectInto,
  insetRectBy,
  intersectsRect,
  mapPoint,
  rectCorners,
  unionRects,
  unmapPoint,
  type Rect,
} from "./rect";
import { heading, mag2, mulN2, normalize2, sub2 } from "@thi.ng/vectors";
import { intersectRayRect } from "@thi.ng/geom-isec";
import type { Point } from "./vector";
import type { Size } from "./size";

export type MinimapLayout = {
  scale: number;
  bounds: Rect;
  plate: Rect;
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
  const within = insetRectBy({ x: 0, y: 0, ...size }, padding);
  if (within.width <= 0 || within.height <= 0 || bounds.width <= 0 || bounds.height <= 0)
    return null;
  const { rect: plate, scale } = fitRectInto(bounds, within);
  const project = (rect: Rect): Rect => {
    const { x, y } = unmapPoint(plate, mapPoint(bounds, rect));
    const [width, height] = mulN2([], [rect.width, rect.height], scale);
    return { x, y, width: width!, height: height! };
  };
  return {
    scale,
    bounds,
    plate,
    viewport: project(viewport),
    items: Object.fromEntries(Object.entries(rects).map(([key, rect]) => [key, project(rect)])),
  };
}

export function getMinimapWorldPoint({
  layout,
  point,
}: {
  layout: MinimapLayout;
  point: Point;
}): Point {
  return unmapPoint(layout.bounds, mapPoint(layout.plate, point));
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
  const [bmin, bmax] = rectCorners(viewport);
  const center = centroidOfRect(viewport);
  return Object.entries(rects)
    .flatMap(([key, rect]) => {
      if (intersectsRect(rect, viewport)) return [];
      const focus = centroidOfRect(rect);
      const delta = sub2([], [focus.x, focus.y], [center.x, center.y]);
      const exit = intersectRayRect(
        [center.x, center.y],
        normalize2([], delta),
        bmin,
        bmax,
      ).isec?.at(-1);
      if (exit === undefined) return [];
      return [
        {
          key,
          rect,
          angle: heading(delta),
          distance: mag2(delta),
          edge: mapPoint(viewport, { x: exit[0]!, y: exit[1]! }),
        },
      ];
    })
    .toSorted(compareByKey("distance"));
}
