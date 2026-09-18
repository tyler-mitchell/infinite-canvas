import { d, std, tgpu } from "typegpu";
import {
  alignInInterval,
  clampIntervalWithin,
  clampToInterval,
  containsInterval,
  containsValue,
  gapBetweenIntervals,
  insetIntervalLength,
  insetIntervalStart,
  intervalEnd,
  intersectionLength,
  intersectionStart,
  intersectsInterval,
  overlapsInterval,
  scaleIntervalAbout,
  unionLength,
  unionStart,
} from "./interval";
import { approxEquals } from "./scalar";

export const Rect = d.struct({ x: d.f32, y: d.f32, width: d.f32, height: d.f32 });
export type Rect = d.Infer<typeof Rect>;

export const Insets = d.struct({ top: d.f32, right: d.f32, bottom: d.f32, left: d.f32 });
export type Insets = d.Infer<typeof Insets>;

export const Intersection = d.struct({ rect: Rect, overlaps: d.bool });
export type Intersection = d.Infer<typeof Intersection>;

export const Pieces = d.struct({ items: d.arrayOf(Rect, 4), count: d.u32 });
export type Pieces = d.Infer<typeof Pieces>;

export type ResizeHandle =
  | "north"
  | "south"
  | "east"
  | "west"
  | "north-east"
  | "north-west"
  | "south-east"
  | "south-west";

export const rectRight = tgpu.fn(
  [Rect],
  d.f32,
)((rect) => {
  "use gpu";
  return intervalEnd(rect.x, rect.width);
});

export const rectBottom = tgpu.fn(
  [Rect],
  d.f32,
)((rect) => {
  "use gpu";
  return intervalEnd(rect.y, rect.height);
});

export const centerOfRect = tgpu.fn(
  [Rect],
  d.vec2f,
)((rect) => {
  "use gpu";
  return d.vec2f(rect.x + rect.width / 2, rect.y + rect.height / 2);
});

export const areaOfRect = tgpu.fn(
  [Rect],
  d.f32,
)((rect) => {
  "use gpu";
  return rect.width * rect.height;
});

export const aspectRatioOfRect = tgpu.fn(
  [Rect],
  d.f32,
)((rect) => {
  "use gpu";
  if (rect.height <= 0) {
    return 0;
  }
  return rect.width / rect.height;
});

export const containsPoint = tgpu.fn(
  [Rect, d.vec2f],
  d.bool,
)((rect, point) => {
  "use gpu";
  return containsValue(rect.x, rect.width, point.x) && containsValue(rect.y, rect.height, point.y);
});

export const containsRect = tgpu.fn(
  [Rect, Rect],
  d.bool,
)((rect, other) => {
  "use gpu";
  return (
    containsInterval(rect.x, rect.width, other.x, other.width) &&
    containsInterval(rect.y, rect.height, other.y, other.height)
  );
});

export const intersectsRect = tgpu.fn(
  [Rect, Rect],
  d.bool,
)((rect, other) => {
  "use gpu";
  return (
    intersectsInterval(rect.x, rect.width, other.x, other.width) &&
    intersectsInterval(rect.y, rect.height, other.y, other.height)
  );
});

export const overlapsRect = tgpu.fn(
  [Rect, Rect],
  d.bool,
)((rect, other) => {
  "use gpu";
  return (
    overlapsInterval(rect.x, rect.width, other.x, other.width) &&
    overlapsInterval(rect.y, rect.height, other.y, other.height)
  );
});

export const intersectionRect = tgpu.fn(
  [Rect, Rect],
  Intersection,
)((rect, other) => {
  "use gpu";
  const width = intersectionLength(rect.x, rect.width, other.x, other.width);
  const height = intersectionLength(rect.y, rect.height, other.y, other.height);
  return Intersection({
    rect: Rect({
      x: intersectionStart(rect.x, other.x),
      y: intersectionStart(rect.y, other.y),
      width: std.max(width, 0),
      height: std.max(height, 0),
    }),
    overlaps: width >= 0 && height >= 0,
  });
});

export const unionRect = tgpu.fn(
  [Rect, Rect],
  Rect,
)((rect, other) => {
  "use gpu";
  return Rect({
    x: unionStart(rect.x, other.x),
    y: unionStart(rect.y, other.y),
    width: unionLength(rect.x, rect.width, other.x, other.width),
    height: unionLength(rect.y, rect.height, other.y, other.height),
  });
});

export const gapBetweenRects = tgpu.fn(
  [Rect, Rect],
  d.vec2f,
)((rect, other) => {
  "use gpu";
  return d.vec2f(
    gapBetweenIntervals(rect.x, rect.width, other.x, other.width),
    gapBetweenIntervals(rect.y, rect.height, other.y, other.height),
  );
});

export const insetRect = tgpu.fn(
  [Rect, Insets],
  Rect,
)((rect, insets) => {
  "use gpu";
  return Rect({
    x: insetIntervalStart(rect.x, insets.left),
    y: insetIntervalStart(rect.y, insets.top),
    width: insetIntervalLength(rect.width, insets.left, insets.right),
    height: insetIntervalLength(rect.height, insets.top, insets.bottom),
  });
});

export const insetRectBy = tgpu.fn(
  [Rect, d.f32],
  Rect,
)((rect, by) => {
  "use gpu";
  return insetRect(rect, Insets({ top: by, right: by, bottom: by, left: by }));
});

export const outsetRect = tgpu.fn(
  [Rect, Insets],
  Rect,
)((rect, insets) => {
  "use gpu";
  return insetRect(
    rect,
    Insets({
      top: -insets.top,
      right: -insets.right,
      bottom: -insets.bottom,
      left: -insets.left,
    }),
  );
});

export const outsetRectBy = tgpu.fn(
  [Rect, d.f32],
  Rect,
)((rect, by) => {
  "use gpu";
  return insetRectBy(rect, -by);
});

export const translateRect = tgpu.fn(
  [Rect, d.vec2f],
  Rect,
)((rect, by) => {
  "use gpu";
  return Rect({ x: rect.x + by.x, y: rect.y + by.y, width: rect.width, height: rect.height });
});

export const scaleRectAbout = tgpu.fn(
  [Rect, d.vec2f, d.f32],
  Rect,
)((rect, origin, factor) => {
  "use gpu";
  return Rect({
    x: scaleIntervalAbout(rect.x, origin.x, factor),
    y: scaleIntervalAbout(rect.y, origin.y, factor),
    width: rect.width * factor,
    height: rect.height * factor,
  });
});

export const clampPointToRect = tgpu.fn(
  [d.vec2f, Rect],
  d.vec2f,
)((point, rect) => {
  "use gpu";
  return d.vec2f(
    clampToInterval(point.x, rect.x, rect.width),
    clampToInterval(point.y, rect.y, rect.height),
  );
});

export const distanceToRect = tgpu.fn(
  [Rect, d.vec2f],
  d.f32,
)((rect, point) => {
  "use gpu";
  return std.distance(point, clampPointToRect(point, rect));
});

export const clampRectWithin = tgpu.fn(
  [Rect, Rect],
  Rect,
)((rect, bounds) => {
  "use gpu";
  return Rect({
    x: clampIntervalWithin(rect.x, rect.width, bounds.x, bounds.width),
    y: clampIntervalWithin(rect.y, rect.height, bounds.y, bounds.height),
    width: rect.width,
    height: rect.height,
  });
});

export const alignRectIn = tgpu.fn(
  [Rect, d.vec2f, d.vec2f],
  Rect,
)((bounds, size, align) => {
  "use gpu";
  return Rect({
    x: alignInInterval(bounds.x, bounds.width, size.x, align.x),
    y: alignInInterval(bounds.y, bounds.height, size.y, align.y),
    width: size.x,
    height: size.y,
  });
});

export const lerpRect = tgpu.fn(
  [Rect, Rect, d.f32, d.f32],
  Rect,
)((from, to, amount, sizeAmount) => {
  "use gpu";
  return Rect({
    x: std.mix(from.x, to.x, amount),
    y: std.mix(from.y, to.y, amount),
    width: std.mix(from.width, to.width, sizeAmount),
    height: std.mix(from.height, to.height, sizeAmount),
  });
});

export const approxEqualsRect = tgpu.fn(
  [Rect, Rect, d.f32],
  d.bool,
)((rect, other, epsilon) => {
  "use gpu";
  return (
    approxEquals(rect.x, other.x, epsilon) &&
    approxEquals(rect.y, other.y, epsilon) &&
    approxEquals(rect.width, other.width, epsilon) &&
    approxEquals(rect.height, other.height, epsilon)
  );
});

export const subtractRect = tgpu.fn(
  [Rect, Rect],
  Pieces,
)((rect, other) => {
  "use gpu";
  const pieces = d.arrayOf(Rect, 4)();
  let count = d.u32(0);
  if (!overlapsRect(rect, other)) {
    pieces[0] = Rect(rect);
    return Pieces({ items: pieces, count: d.u32(1) });
  }
  const right = rect.x + rect.width;
  const bottom = rect.y + rect.height;
  const otherRight = other.x + other.width;
  const otherBottom = other.y + other.height;
  if (other.y > rect.y) {
    pieces[count] = Rect({
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: other.y - rect.y,
    });
    count++;
  }
  if (otherBottom < bottom) {
    pieces[count] = Rect({
      x: rect.x,
      y: otherBottom,
      width: rect.width,
      height: bottom - otherBottom,
    });
    count++;
  }
  if (other.x > rect.x) {
    pieces[count] = Rect({
      x: rect.x,
      y: rect.y,
      width: other.x - rect.x,
      height: rect.height,
    });
    count++;
  }
  if (otherRight < right) {
    pieces[count] = Rect({
      x: otherRight,
      y: rect.y,
      width: right - otherRight,
      height: rect.height,
    });
    count++;
  }
  return Pieces({ items: pieces, count });
});

export function unionRects(rects: readonly Rect[]): Rect | null {
  return rects.length === 0
    ? null
    : rects.reduce((bounds, rect) => unionRect(bounds, rect), rects[0]!);
}

export function pruneContainedRects(rects: readonly Rect[]): Rect[] {
  return rects.filter(
    (rect, index) =>
      !rects.some(
        (other, otherIndex) =>
          otherIndex !== index &&
          containsRect(other, rect) &&
          (otherIndex < index || !containsRect(rect, other)),
      ),
  );
}

export function resizeRect({
  rect,
  handle,
  delta,
  minSize,
  maxSize,
  aspectRatio,
}: {
  rect: Rect;
  handle: ResizeHandle;
  delta: d.v2f;
  minSize: d.v2f;
  maxSize?: d.v2f | undefined;
  aspectRatio?: number | undefined;
}): Rect {
  const limitWidth = maxSize === undefined ? Number.POSITIVE_INFINITY : maxSize.x;
  const limitHeight = maxSize === undefined ? Number.POSITIVE_INFINITY : maxSize.y;
  const west = handle.includes("west");
  const east = handle.includes("east");
  const north = handle.includes("north");
  const south = handle.includes("south");
  const widthDelta = (Number(east) - Number(west)) * delta.x;
  const heightDelta = (Number(south) - Number(north)) * delta.y;
  const ratio =
    aspectRatio !== undefined && aspectRatio > 0 && Number.isFinite(aspectRatio)
      ? aspectRatio
      : undefined;
  const rawWidth = Math.max(minSize.x, Math.min(limitWidth, rect.width + widthDelta));
  const rawHeight = Math.max(minSize.y, Math.min(limitHeight, rect.height + heightDelta));
  const useHeight =
    !(west || east) ||
    ((north || south) && Math.abs(heightDelta * (ratio ?? 1)) > Math.abs(widthDelta));
  const width =
    ratio === undefined
      ? rawWidth
      : Math.max(
          Math.max(minSize.x, minSize.y * ratio),
          Math.min(
            useHeight ? rawHeight * ratio : rawWidth,
            Math.min(limitWidth, limitHeight * ratio),
          ),
        );
  const height = ratio === undefined ? rawHeight : width / ratio;
  return Rect({
    width,
    height,
    x: west ? rect.x + rect.width - width : rect.x,
    y: north ? rect.y + rect.height - height : rect.y,
  });
}
