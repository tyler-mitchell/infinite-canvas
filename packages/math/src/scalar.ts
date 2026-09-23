import { d, std, tgpu } from "typegpu";

// Source: @thi.ng/math@5.15.17 api.js:20
//   let EPS = 1e-6;
// Upstream declares it mutable so a consumer can retune the global tolerance. A pinned WGSL
// signature inlines the value at resolve time, so it is a constant here.
export const EPS = 1e-6;

// Source: @thi.ng/math@5.15.17 interval.js:1 (clamp)
//   const clamp = (x, min, max) => x < min ? min : x > max ? max : x;
export const clamp = tgpu.fn(
  [d.f32, d.f32, d.f32],
  d.f32,
)((x, min, max) => {
  "use gpu";
  return x < min ? min : x > max ? max : x;
});

// Source: @thi.ng/math@5.15.17 fit.js:2 (norm)
//   const norm = (x, a, b) => b !== a ? (x - a) / (b - a) : 0;
export const norm = tgpu.fn(
  [d.f32, d.f32, d.f32],
  d.f32,
)((x, a, b) => {
  "use gpu";
  return b !== a ? (x - a) / (b - a) : 0;
});

// Source: @thi.ng/math@5.15.17 prec.js:5 (roundTo)
//   const roundTo = (x, prec = 1) => Math.round(x / prec) * prec;
// A default parameter does not survive a pinned WGSL signature, so prec is explicit.
export const roundTo = tgpu.fn(
  [d.f32, d.f32],
  d.f32,
)((x, prec) => {
  "use gpu";
  return std.round(x / prec) * prec;
});

// Source: @thi.ng/math@5.15.17 eqdelta.js:5 (eqDeltaScaled)
//   const eqDeltaScaled = (a, b, eps = EPS) => abs(a - b) <= eps * max(1, abs(a), abs(b));
// std.max is binary, so upstream's three-argument max is nested. The default eps is explicit for
// the same reason as roundTo.
export const eqDeltaScaled = tgpu.fn(
  [d.f32, d.f32, d.f32],
  d.bool,
)((a, b, eps) => {
  "use gpu";
  return std.abs(a - b) <= eps * std.max(1, std.max(std.abs(a), std.abs(b)));
});
