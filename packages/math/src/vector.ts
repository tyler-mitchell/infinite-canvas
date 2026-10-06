import { d, std, tgpu } from "typegpu";
import { EPS } from "./scalar";

export type Point = { x: number; y: number };

// Source: @thi.ng/vectors@8.7.0 cross.js:2 (cross2)
//   const cross2 = (a, b) => a[0] * b[1] - a[1] * b[0];
export const cross2 = tgpu.fn(
  [d.vec2f, d.vec2f],
  d.f32,
)((a, b) => {
  "use gpu";
  return a.x * b.y - a.y * b.x;
});

// Source: @thi.ng/vectors@8.7.0 perpendicular.js:2 (perpendicularCCW)
//   const perpendicularCCW = (out, a) => setC2(out || a, -a[1], a[0]);
// setC2 writes the two components into out; a WGSL function returns the vector instead.
export const perpendicularCCW = tgpu.fn(
  [d.vec2f],
  d.vec2f,
)((a) => {
  "use gpu";
  return d.vec2f(-a.y, a.x);
});

// Source: @thi.ng/vectors@8.7.0 magsq.js:2 (magSq2)
//   const magSq2 = (a) => a[0] * a[0] + a[1] * a[1];
export const magSq2 = tgpu.fn(
  [d.vec2f],
  d.f32,
)((a) => {
  "use gpu";
  return a.x * a.x + a.y * a.y;
});

// Source: @thi.ng/vectors@8.7.0 normalize.js:5-11 (normalize2)
//   const $ = (magSq5, mulN5, set5) => (out, v, n = 1) => {
//     const m = Math.sqrt(magSq5(v));
//     return m >= EPS ? mulN5(out, v, n / m) : out !== v ? set5(out, v) : out;
//   };
//   const normalize2 = $(magSq2, mulN2, set2);
// A WGSL function returns a value, so the out-parameter is gone and both arms of upstream's inner
// ternary become v. The target length n keeps its default of 1.
export const normalize2 = tgpu.fn(
  [d.vec2f],
  d.vec2f,
)((v) => {
  "use gpu";
  const m = std.sqrt(magSq2(v));
  if (m >= EPS) {
    return std.mul(v, 1 / m);
  }
  return d.vec2f(v.x, v.y);
});
