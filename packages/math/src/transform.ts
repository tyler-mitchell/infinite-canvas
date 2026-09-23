import { d, std, tgpu } from "typegpu";
import { Rect } from "./rect";

export const Transform = d.struct({ xAxis: d.vec2f, yAxis: d.vec2f, origin: d.vec2f });
export type Transform = d.Infer<typeof Transform>;

// Source: @thi.ng/matrices@3.0.54 identity.js:6 (identity23)
//   const identity23 = identity.add(6, (m) => set(m, IDENT23));
// IDENT23 is [1, 0, 0, 1, 0, 0]: xAxis, then yAxis, then origin.
export const identityTransform = tgpu.fn(
  [],
  Transform,
)(() => {
  "use gpu";
  return Transform({
    xAxis: d.vec2f(1, 0),
    yAxis: d.vec2f(0, 1),
    origin: d.vec2f(0, 0),
  });
});

// Source: @thi.ng/matrices@3.0.54 translation.js:2 (translation23)
//   const translation23 = (m, v) => setC6(m || [], 1, 0, 0, 1, v[0], v[1]);
export const translationTransform = tgpu.fn(
  [d.vec2f],
  Transform,
)((by) => {
  "use gpu";
  return Transform({ xAxis: d.vec2f(1, 0), yAxis: d.vec2f(0, 1), origin: by });
});

// Source: @thi.ng/matrices@3.0.54 scale.js:4 (scale23)
//   setC6(m || [], s[0], 0, 0, s[1], 0, 0)
// Upstream widens a scalar factor to a vector first; this signature takes the vector.
export const scalingTransform = tgpu.fn(
  [d.vec2f],
  Transform,
)((factor) => {
  "use gpu";
  return Transform({
    xAxis: d.vec2f(factor.x, 0),
    yAxis: d.vec2f(0, factor.y),
    origin: d.vec2f(0, 0),
  });
});

// Source: @thi.ng/matrices@3.0.54 rotation.js:7-10 (rotation23)
//   const [s, c] = sincos(theta);
//   return setC6(out || [], c, s, -s, c, 0, 0);
export const rotationTransform = tgpu.fn(
  [d.f32],
  Transform,
)((radians) => {
  "use gpu";
  const cosine = std.cos(radians);
  const sine = std.sin(radians);
  return Transform({
    xAxis: d.vec2f(cosine, sine),
    yAxis: d.vec2f(-sine, cosine),
    origin: d.vec2f(0, 0),
  });
});

// Source: @thi.ng/matrices@3.0.54 mulv.js:9-12 (mulV23), without the translation column
//   setC2(out || v, dotS2(m, v, 0, 0, 2) + m[4], dotS2(m, v, 1, 0, 2) + m[5])
// A direction ignores m[4] and m[5], so only the two strided dots remain; transformPoint below adds
// the origin back.
export const transformDirection = tgpu.fn(
  [Transform, d.vec2f],
  d.vec2f,
)((transform, direction) => {
  "use gpu";
  return std.add(std.mul(direction.x, transform.xAxis), std.mul(direction.y, transform.yAxis));
});

// Source: @thi.ng/matrices@3.0.54 mulv.js:9-12 (mulV23)
//   setC2(out || v, dotS2(m, v, 0, 0, 2) + m[4], dotS2(m, v, 1, 0, 2) + m[5])
export const transformPoint = tgpu.fn(
  [Transform, d.vec2f],
  d.vec2f,
)((transform, point) => {
  "use gpu";
  return std.add(transformDirection(transform, point), transform.origin);
});

// Source: @thi.ng/matrices@3.0.54 mulm.js:15-26 (mulM23)
//   dotS2(a, b, 0, 0, 2), dotS2(a, b, 1, 0, 2), dotS2(a, b, 0, 2, 2),
//   dotS2(a, b, 1, 2, 2), dotS2(a, b, 0, 4, 2) + a[4], dotS2(a, b, 1, 4, 2) + a[5]
// Transform holds the same six numbers as a 2x3: a0/a1 are xAxis, a2/a3 are yAxis, a4/a5 are
// origin. dotS2(a, b, i, j, 2) is a[i]*b[j] + a[i+2]*b[j+1], written out because a kernel has no
// strided dot. The out-parameter is dropped because this package returns values.
export const composeTransforms = tgpu.fn(
  [Transform, Transform],
  Transform,
)((outer, inner) => {
  "use gpu";
  const a0 = outer.xAxis.x;
  const a1 = outer.xAxis.y;
  const a2 = outer.yAxis.x;
  const a3 = outer.yAxis.y;
  const a4 = outer.origin.x;
  const a5 = outer.origin.y;
  const b0 = inner.xAxis.x;
  const b1 = inner.xAxis.y;
  const b2 = inner.yAxis.x;
  const b3 = inner.yAxis.y;
  const b4 = inner.origin.x;
  const b5 = inner.origin.y;
  return Transform({
    xAxis: d.vec2f(a0 * b0 + a2 * b1, a1 * b0 + a3 * b1),
    yAxis: d.vec2f(a0 * b2 + a2 * b3, a1 * b2 + a3 * b3),
    origin: d.vec2f(a0 * b4 + a2 * b5 + a4, a1 * b4 + a3 * b5 + a5),
  });
});

// Source: @thi.ng/matrices@3.0.54 determinant.js:2-3 (det22, which det23 aliases)
//   const det22 = (m) => dotC4(m[0], m[3], -m[1], m[2]);
// dotC4(a, b, c, d) is a*b + c*d, so this is m[0]*m[3] - m[1]*m[2].
export const transformDeterminant = tgpu.fn(
  [Transform],
  d.f32,
)((transform) => {
  "use gpu";
  return transform.xAxis.x * transform.yAxis.y - transform.xAxis.y * transform.yAxis.x;
});

// Source: @thi.ng/matrices@3.0.54 invert.js:14-28 (invert23)
//   let det = dotC4(m00, m11, -m01, m10);
//   if (det === 0) return;
//   det = 1 / det;
// m00/m01 are xAxis, m10/m11 are yAxis, m20/m21 are origin. The six assignments are upstream's.
// ADAPTED BEHAVIOUR, not ergonomics: upstream returns undefined for a singular matrix. A kernel
// resolving to WGSL has no undefined, so this returns the identity instead. That substitution is
// this package's decision and is pinned by transform.test.ts.
export const invertTransform = tgpu.fn(
  [Transform],
  Transform,
)((transform) => {
  "use gpu";
  const aa = transform.xAxis.x;
  const ab = transform.xAxis.y;
  const ac = transform.yAxis.x;
  const ad = transform.yAxis.y;
  const atx = transform.origin.x;
  const aty = transform.origin.y;

  const determinant = aa * ad - ab * ac;
  if (determinant === 0) {
    return identityTransform();
  }
  const det = 1.0 / determinant;

  return Transform({
    xAxis: d.vec2f(ad * det, -ab * det),
    yAxis: d.vec2f(-ac * det, aa * det),
    origin: d.vec2f((ac * aty - ad * atx) * det, (ab * atx - aa * aty) * det),
  });
});

// Source: @thi.ng/geom@8.3.38 transform.js:70, the rect branch
//   rect: ($, mat) => transform(new Quad(vertices($), __copyAttribs($.attribs)), mat),
// Upstream turns a rect into its four vertices and transforms those, because a rotated rect is no
// longer axis-aligned; the axis-aligned result here is the bounds of that quad, which is why all
// four corners are carried through rather than the origin and the extent.
export const transformRect = tgpu.fn(
  [Transform, Rect],
  Rect,
)((transform, rect) => {
  "use gpu";
  const topLeft = transformPoint(transform, d.vec2f(rect.x, rect.y));
  const topRight = transformPoint(transform, d.vec2f(rect.x + rect.width, rect.y));
  const bottomLeft = transformPoint(transform, d.vec2f(rect.x, rect.y + rect.height));
  const bottomRight = transformPoint(transform, d.vec2f(rect.x + rect.width, rect.y + rect.height));
  const least = std.min(std.min(topLeft, topRight), std.min(bottomLeft, bottomRight));
  const most = std.max(std.max(topLeft, topRight), std.max(bottomLeft, bottomRight));
  return Rect({
    x: least.x,
    y: least.y,
    width: most.x - least.x,
    height: most.y - least.y,
  });
});
