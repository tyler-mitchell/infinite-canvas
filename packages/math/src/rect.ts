import {
  rect as geomRect,
  rectWithCentroid as geomRectWithCentroid,
  rectFromMinMax,
  union,
} from "@thi.ng/geom";
import { pointInRect, testRectRect } from "@thi.ng/geom-isec";
import { clamp } from "@thi.ng/math";
import {
  add2,
  addN2,
  clamp2,
  div2,
  madd2,
  maddN2,
  max2,
  min2,
  mix2,
  mulN2,
  sub2,
  subN2,
  type Vec,
} from "@thi.ng/vectors";
import { d, std, tgpu } from "typegpu";
import { eqDeltaScaled } from "./scalar";
import { fitScales, type Size, type SizeLimits } from "./size";
import type { Point } from "./vector";

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

// NOT GROUNDED, and correctly so: the far edge of a start-and-length interval is start + length.
// thi.ng stores a Rect the same way (pos and size) and reads the far edge inline wherever it needs
// it, so there is no upstream function to cite.
export const rectRight = tgpu.fn(
  [Rect],
  d.f32,
)((rect) => {
  "use gpu";
  return rect.x + rect.width;
});

// NOT GROUNDED, for the same reason as rectRight above.
export const rectBottom = tgpu.fn(
  [Rect],
  d.f32,
)((rect) => {
  "use gpu";
  return rect.y + rect.height;
});

// Source: @thi.ng/geom@8.3.38 centroid.js:35 (aabb)
//   out[0] = (box[0] + box[2]) * 0.5;
//   out[1] = (box[1] + box[3]) * 0.5;
// Upstream stores min and max. Here max is x + width, and (x + (x + width)) * 0.5 is x + width / 2.
export const centerOfRect = tgpu.fn(
  [Rect],
  d.vec2f,
)((rect) => {
  "use gpu";
  return d.vec2f(rect.x + rect.width / 2, rect.y + rect.height / 2);
});

// Source: @thi.ng/geom@8.3.38 area.js:29 (rect)
//   return (box[2] - box[0]) * (box[3] - box[1]);
// width is the stored form of box[2] - box[0], and height of box[3] - box[1].
export const areaOfRectKernel = tgpu.fn(
  [Rect],
  d.f32,
)((rect) => {
  "use gpu";
  return rect.width * rect.height;
});

export const areaOfRect = (rect: Rect): number => rect.width * rect.height;

// NOT GROUNDED. Width over height is a ratio of two fields, not an operation thi.ng publishes; the
// guard against a zero height is this package's own.
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

// Source: @thi.ng/geom-isec@4.0.95 point.js:140-143 (pointInRect)
//   return point[0] >= box[0] && point[0] <= box[2] && point[1] >= box[1] && point[1] <= box[3];
// The same test, as one vector comparison per corner.
export const containsPointKernel = tgpu.fn(
  [Rect, d.vec2f],
  d.bool,
)((rect, point) => {
  "use gpu";
  const pos = d.vec2f(rect.x, rect.y);
  const far = std.add(pos, d.vec2f(rect.width, rect.height));
  return !std.any(std.lt(point, pos)) && !std.any(std.lt(far, point));
});

// Source: @thi.ng/geom-isec@4.0.95 point.js:140-143 (pointInRect), on both corners
//   contained[0] >= container[0] &&
//   contained[2] <= container[2] &&
// The same test, applied to both corners of the contained rect.
export const containsRectKernel = tgpu.fn(
  [Rect, Rect],
  d.bool,
)((rect, other) => {
  "use gpu";
  const pos = d.vec2f(rect.x, rect.y);
  const otherPos = d.vec2f(other.x, other.y);
  const far = std.add(pos, d.vec2f(rect.width, rect.height));
  const otherFar = std.add(otherPos, d.vec2f(other.width, other.height));
  return !std.any(std.lt(otherPos, pos)) && !std.any(std.lt(far, otherFar));
});

// Source: @thi.ng/geom-isec@4.0.95 rect-rect.js:1 (testRectRect)
//   return boxA[0] <= boxB[2] && boxA[2] >= boxB[0] && boxA[1] <= boxB[3] && boxA[3] >= boxB[1];
// The same test, as one vector comparison per corner pair.
export const intersectsRectKernel = tgpu.fn(
  [Rect, Rect],
  d.bool,
)((rect, other) => {
  "use gpu";
  const pos = d.vec2f(rect.x, rect.y);
  const otherPos = d.vec2f(other.x, other.y);
  const far = std.add(pos, d.vec2f(rect.width, rect.height));
  const otherFar = std.add(otherPos, d.vec2f(other.width, other.height));
  return !std.any(std.lt(otherFar, pos)) && !std.any(std.lt(far, otherPos));
});

// Source: @thi.ng/vectors@8.7.0 subn.js (subN2) and addn.js (addN2), composed: both edges move out
// by the margin, so the position drops by it and the extent grows by twice it. A negative margin
// insets. A caller wanting a padded hit test writes containsPoint(outsetRectBy(rect, pad), point)
// rather than a second predicate carrying a padding argument.
export const outsetRectBy = (rect: Rect, margin: number): Rect => {
  const [x, y] = subN2([], [rect.x, rect.y], margin) as [number, number];
  const [width, height] = addN2([], [rect.width, rect.height], margin * 2) as [number, number];
  return { x, y, width, height };
};

// Source: @thi.ng/geom@8.3.38 map-point.js:9, the rect branch
//   div(null, sub(out, p, $.pos), $.size)
export const mapPoint = (rect: Rect, point: Point): Point => {
  const [x, y] = div2(
    null,
    sub2([], [point.x, point.y], [rect.x, rect.y]),
    [rect.width, rect.height],
  ) as [number, number];
  return { x, y };
};

// Source: @thi.ng/geom@8.3.38 unmap-point.js:21, the rect branch
//   madd(out, $.size, uvw, $.pos)
export const unmapPoint = (rect: Rect, unit: Point): Point => {
  const [x, y] = madd2([], [rect.width, rect.height], [unit.x, unit.y], [rect.x, rect.y]) as [
    number,
    number,
  ];
  return { x, y };
};

export const insetRectBy = (rect: Rect, by: number): Rect => {
  const [x, y] = addN2([], [rect.x, rect.y], by) as [number, number];
  const [width, height] = max2([], subN2([], [rect.width, rect.height], by * 2), [0, 0]) as [
    number,
    number,
  ];
  return { x, y, width, height };
};

export const containsPoint = (rect: Rect, point: Point): boolean =>
  pointInRect([point.x, point.y], [rect.x, rect.y], [rect.width, rect.height]);

// Source: @thi.ng/geom-isec@4.0.95 point.js (pointInRect), applied to both corners of `other`. A
// rect contains another exactly when it contains its minimum and its maximum corner.
export const containsRect = (rect: Rect, other: Rect): boolean =>
  pointInRect([other.x, other.y], [rect.x, rect.y], [rect.width, rect.height]) &&
  pointInRect(
    [other.x + other.width, other.y + other.height],
    [rect.x, rect.y],
    [rect.width, rect.height],
  );

// Source: @thi.ng/geom-isec@4.0.95 rect-rect.js (testRectRect)
//   !(ax > bx + bw || bx > ax + aw || ay > by + bh || by > ay + ah)
export const intersectsRect = (rect: Rect, other: Rect): boolean =>
  testRectRect(
    [rect.x, rect.y],
    [rect.width, rect.height],
    [other.x, other.y],
    [other.width, other.height],
  );

// Source: @thi.ng/intervals@4.2.142 index.js:107-108 (isBefore, isAfter) via :119-120 (classify,
// overlaps), applied per axis. This is the strict form: touching rects do not overlap, where
// geom-isec testRectRect counts them as intersecting.
export const overlapsRect = tgpu.fn(
  [Rect, Rect],
  d.bool,
)((rect, other) => {
  "use gpu";
  const pos = d.vec2f(rect.x, rect.y);
  const otherPos = d.vec2f(other.x, other.y);
  const far = std.add(pos, d.vec2f(rect.width, rect.height));
  const otherFar = std.add(otherPos, d.vec2f(other.width, other.height));
  return std.all(std.lt(pos, otherFar)) && std.all(std.lt(otherPos, far));
});

// Source: @thi.ng/geom@8.3.38 rect.js:23-28 (intersectionRect)
//   const p = max2([], a.pos, b.pos);
//   const q = min2(null, add2([], a.pos, a.size), add2([], b.pos, b.size));
//   const size = max2(null, sub2(null, q, p), ZERO2);
//   return size[0] > 0 && size[1] > 0 ? new Rect(p, size) : void 0;
// ADAPTED RETURN, not ergonomics: upstream returns undefined when the rects do not meet. A kernel
// resolving to WGSL has no undefined, so the empty case is a zero-sized rect and the overlaps flag
// reports it instead.
export const intersectionRect = tgpu.fn(
  [Rect, Rect],
  Intersection,
)((rect, other) => {
  "use gpu";
  const pos = d.vec2f(rect.x, rect.y);
  const otherPos = d.vec2f(other.x, other.y);
  const start = std.max(pos, otherPos);
  const extent = std.sub(
    std.min(
      std.add(pos, d.vec2f(rect.width, rect.height)),
      std.add(otherPos, d.vec2f(other.width, other.height)),
    ),
    start,
  );
  const held = std.max(extent, d.vec2f(0, 0));
  return Intersection({
    rect: Rect({ x: start.x, y: start.y, width: held.x, height: held.y }),
    overlaps: !std.any(std.lt(extent, d.vec2f(0, 0))),
  });
});

// Source: @thi.ng/geom@8.3.38 union.js:6-15 (union), the aabb branch
//   out[0] = Math.min(boxA[0], boxB[0]);
//   out[2] = Math.max(boxA[2], boxB[2]);
// The min and max are taken as vectors; width and height come from :251-255 (size).
export const unionRectKernel = tgpu.fn(
  [Rect, Rect],
  Rect,
)((rect, other) => {
  "use gpu";
  const pos = d.vec2f(rect.x, rect.y);
  const otherPos = d.vec2f(other.x, other.y);
  const start = std.min(pos, otherPos);
  const extent = std.sub(
    std.max(
      std.add(pos, d.vec2f(rect.width, rect.height)),
      std.add(otherPos, d.vec2f(other.width, other.height)),
    ),
    start,
  );
  return Rect({ x: start.x, y: start.y, width: extent.x, height: extent.y });
});

// Source: @thi.ng/intervals@4.2.142 index.js:117 (distance)
//   const distance = (a, b) => overlaps(a, b) ? 0 : a.l < b.l ? b.l - a.r : a.l - b.r;
// Applied per axis. Upstream floors an overlap at zero; the signed form here reports the overlap as
// a negative gap.
export const gapBetweenRects = tgpu.fn(
  [Rect, Rect],
  d.vec2f,
)((rect, other) => {
  "use gpu";
  const pos = d.vec2f(rect.x, rect.y);
  const otherPos = d.vec2f(other.x, other.y);
  return std.sub(
    std.max(pos, otherPos),
    std.min(
      std.add(pos, d.vec2f(rect.width, rect.height)),
      std.add(otherPos, d.vec2f(other.width, other.height)),
    ),
  );
});

// Source: @thi.ng/geom@8.3.38 api/rect.js:36-41 (Rect.offset), per axis
//   out[0] = box[0] - vector[0];
//   out[2] = box[2] + vector[0];
// Negated: upstream expands, this insets. Per-edge rather than per-axis, so each edge takes its own
// inset, which is what a padding box needs.
export const insetRect = tgpu.fn(
  [Rect, Insets],
  Rect,
)((rect, insets) => {
  "use gpu";
  const start = std.add(d.vec2f(rect.x, rect.y), d.vec2f(insets.left, insets.top));
  const extent = std.max(
    std.sub(
      d.vec2f(rect.width, rect.height),
      d.vec2f(insets.left + insets.right, insets.top + insets.bottom),
    ),
    d.vec2f(0, 0),
  );
  return Rect({ x: start.x, y: start.y, width: extent.x, height: extent.y });
});

// Source: @thi.ng/geom@8.3.38 api/rect.js:36-41 (Rect.offset)
//   out[0] = box[0] - margin;
//   out[2] = box[2] + margin;
// Negated: upstream expands by the margin, this insets by it.
export const insetRectByKernel = tgpu.fn(
  [Rect, d.f32],
  Rect,
)((rect, by) => {
  "use gpu";
  return insetRect(rect, Insets({ top: by, right: by, bottom: by, left: by }));
});

// Source: @thi.ng/geom@8.3.38 api/rect.js:36-41 (Rect.offset), per axis
//   out[0] = box[0] - vector[0];
//   out[2] = box[2] + vector[0];
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

// Source: @thi.ng/geom@8.3.38 api/rect.js:36-41 (Rect.offset)
//   out[0] = box[0] - margin;
//   out[2] = box[2] + margin;
export const outsetRectByKernel = tgpu.fn(
  [Rect, d.f32],
  Rect,
)((rect, by) => {
  "use gpu";
  return insetRectByKernel(rect, -by);
});

// Source: research/sources/pmndrs-math.vec2.ts:103-107 (add)
//   out[0] = a[0] + b[0];
//   out[1] = a[1] + b[1];
// Applied to the origin only. Size is carried through, which is what makes this a translation.
export const translateRectKernel = tgpu.fn(
  [Rect, d.vec2f],
  Rect,
)((rect, by) => {
  "use gpu";
  return Rect({ x: rect.x + by.x, y: rect.y + by.y, width: rect.width, height: rect.height });
});

// Source: @thi.ng/math@5.15.17 mix.js:2 (mix)
//   a + (b - a) * t
// applied to both corners about the given origin.
export const scaleRectAbout = tgpu.fn(
  [Rect, d.vec2f, d.f32],
  Rect,
)((rect, origin, factor) => {
  "use gpu";
  const start = std.mix(origin, d.vec2f(rect.x, rect.y), factor);
  return Rect({
    x: start.x,
    y: start.y,
    width: rect.width * factor,
    height: rect.height * factor,
  });
});

// Source: @thi.ng/math@5.15.17 interval.js:1 (clamp), applied per axis. This is the componentwise
// clamp, not @thi.ng/geom-closest-point closestPointRect: that one snaps an interior point out to
// the nearest edge, and a point already inside stays where it is here.
export const clampPointToRect = tgpu.fn(
  [d.vec2f, Rect],
  d.vec2f,
)((point, rect) => {
  "use gpu";
  const pos = d.vec2f(rect.x, rect.y);
  return std.clamp(point, pos, std.max(pos, std.add(pos, d.vec2f(rect.width, rect.height))));
});

// Source: @thi.ng/math@5.15.17 interval.js:1 (clamp), through clampPointToRect above. The distance
// from a point to a rect is the distance to its clamp, and is zero inside.
export const distanceToRect = tgpu.fn(
  [Rect, d.vec2f],
  d.f32,
)((rect, point) => {
  "use gpu";
  return std.distance(point, clampPointToRect(point, rect));
});

// Source: @thi.ng/math@5.15.17 interval.js:1 (clamp)
//   x < min ? min : x > max ? max : x
// applied to the position vector, where max is the far corner less the rect's own size. The far
// corner is ordered against the near one so a rect larger than its bounds pins to the near corner.
export const clampRectWithinKernel = tgpu.fn(
  [Rect, Rect],
  Rect,
)((rect, bounds) => {
  "use gpu";
  const boundsPos = d.vec2f(bounds.x, bounds.y);
  const far = std.sub(
    std.add(boundsPos, d.vec2f(bounds.width, bounds.height)),
    d.vec2f(rect.width, rect.height),
  );
  const start = std.clamp(d.vec2f(rect.x, rect.y), boundsPos, std.max(boundsPos, far));
  return Rect({ x: start.x, y: start.y, width: rect.width, height: rect.height });
});

// Source: @thi.ng/math@5.15.17 mix.js:2 (mix)
//   a + (b - a) * t
// applied to the position vector, mixing from the near corner to the far corner less the size.
export const alignRectInKernel = tgpu.fn(
  [Rect, d.vec2f, d.vec2f],
  Rect,
)((bounds, size, align) => {
  "use gpu";
  const boundsPos = d.vec2f(bounds.x, bounds.y);
  const start = std.mix(
    boundsPos,
    std.sub(std.add(boundsPos, d.vec2f(bounds.width, bounds.height)), size),
    align,
  );
  return Rect({ x: start.x, y: start.y, width: size.x, height: size.y });
});

// Source: research/sources/pmndrs-math.vec2.ts:406-412 (lerp)
//   out[0] = ax + t * (b[0] - ax);
//   out[1] = ay + t * (b[1] - ay);
// std.mix is that expression, supplied by WGSL rather than written again.
// ADAPTED SIGNATURE, not ergonomics: upstream takes one t. This takes two, so position and size can
// settle at different rates, which a window animating to a new cell needs.
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

// Source: research/sources/pmndrs-math.box2.ts:124-139 (equals)
//   Math.abs(a0 - b0) <= EPSILON * Math.max(1.0, Math.abs(a0), Math.abs(b0)) &&
//   Math.abs(a1 - b1) <= EPSILON * Math.max(1.0, Math.abs(a1), Math.abs(b1)) &&
// Four components conjoined, each through scalar.ts approxEquals, which carries that comparison.
// The epsilon is a parameter here rather than upstream's module constant.
export const approxEqualsRect = tgpu.fn(
  [Rect, Rect, d.f32],
  d.bool,
)((rect, other, epsilon) => {
  "use gpu";
  return (
    eqDeltaScaled(rect.x, other.x, epsilon) &&
    eqDeltaScaled(rect.y, other.y, epsilon) &&
    eqDeltaScaled(rect.width, other.width, epsilon) &&
    eqDeltaScaled(rect.height, other.height, epsilon)
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

// Source: @thi.ng/geom@8.3.38 union.js:6-15 (union), the aabb branch
//   out[0] = Math.min(boxA[0], boxB[0]);
//   out[1] = Math.min(boxA[1], boxB[1]);
//   out[2] = Math.max(boxA[2], boxB[2]);
//   out[3] = Math.max(boxA[3], boxB[3]);
// The out-parameter is dropped because this package returns values; the four assignments are the
// upstream ones. Width and height come from :251-255 (size): box[2] - box[0], box[3] - box[1].
export const centroidOfRect = (rect: Rect): Point => {
  const [x, y] = maddN2([], [rect.width, rect.height], 0.5, [rect.x, rect.y]) as [number, number];
  return { x, y };
};

export const translateRect = (rect: Rect, by: Point): Rect => {
  const [x, y] = add2([], [rect.x, rect.y], [by.x, by.y]) as [number, number];
  return { x, y, width: rect.width, height: rect.height };
};

export const clampRectWithin = (rect: Rect, bounds: Rect): Rect => {
  const pos: Vec = [bounds.x, bounds.y];
  const far = sub2([], add2([], pos, [bounds.width, bounds.height]), [rect.width, rect.height]);
  const [x, y] = clamp2([], [rect.x, rect.y], pos, max2([], pos, far)) as [number, number];
  return { x, y, width: rect.width, height: rect.height };
};

export const alignRectIn = (bounds: Rect, size: Size, align: Point): Rect => {
  const pos: Vec = [bounds.x, bounds.y];
  const extent: Vec = [size.width, size.height];
  const [x, y] = mix2(
    [],
    pos,
    sub2([], add2([], pos, [bounds.width, bounds.height]), extent),
    [align.x, align.y],
  ) as [number, number];
  return { x, y, width: size.width, height: size.height };
};

export const fitRectInto = (rect: Rect, within: Rect): { rect: Rect; scale: number } => {
  const scale = fitScales(rect, within).both;
  const [width, height] = mulN2([], [rect.width, rect.height], scale) as [number, number];
  return { scale, rect: rectWithCentroid(centroidOfRect(within), { width, height }) };
};

export const rectCorners = (rect: Rect): [Vec, Vec] => {
  const pos: Vec = [rect.x, rect.y];
  return [pos, add2([], pos, [rect.width, rect.height])];
};

export const rectFromCorners = (a: Point, b: Point): Rect => {
  const made = rectFromMinMax(min2([], [a.x, a.y], [b.x, b.y]), max2([], [a.x, a.y], [b.x, b.y]));
  return { x: made.pos[0]!, y: made.pos[1]!, width: made.size[0]!, height: made.size[1]! };
};

export const rectWithCentroid = (centroid: Point, size: Size): Rect => {
  const made = geomRectWithCentroid([centroid.x, centroid.y], [size.width, size.height]);
  return { x: made.pos[0]!, y: made.pos[1]!, width: made.size[0]!, height: made.size[1]! };
};

export const unionRect = (rect: Rect, other: Rect): Rect => {
  const merged = union(
    geomRect([rect.x, rect.y], [rect.width, rect.height]),
    geomRect([other.x, other.y], [other.width, other.height]),
  );
  return {
    x: merged.pos[0]!,
    y: merged.pos[1]!,
    width: merged.size[0]!,
    height: merged.size[1]!,
  };
};

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
  limits,
  aspectRatio,
}: {
  rect: Rect;
  handle: ResizeHandle;
  delta: Point;
  limits: SizeLimits;
  aspectRatio?: number | undefined;
}): Rect {
  const minSize = limits.min;
  const limitWidth = limits.max.width;
  const limitHeight = limits.max.height;
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
  const rawWidth = clamp(rect.width + widthDelta, minSize.width, Math.max(minSize.width, limitWidth));
  const rawHeight = clamp(
    rect.height + heightDelta,
    minSize.height,
    Math.max(minSize.height, limitHeight),
  );
  const useHeight =
    !(west || east) ||
    ((north || south) && Math.abs(heightDelta * (ratio ?? 1)) > Math.abs(widthDelta));
  const width =
    ratio === undefined
      ? rawWidth
      : Math.max(
          Math.max(minSize.width, minSize.height * ratio),
          Math.min(
            useHeight ? rawHeight * ratio : rawWidth,
            Math.min(limitWidth, limitHeight * ratio),
          ),
        );
  const height = ratio === undefined ? rawHeight : width / ratio;
  return {
    width,
    height,
    x: west ? rect.x + rect.width - width : rect.x,
    y: north ? rect.y + rect.height - height : rect.y,
  };
}
