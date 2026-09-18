import { d, std, tgpu } from "typegpu";

export const EPSILON = 1e-6;

export const clamp = tgpu.fn(
  [d.f32, d.f32, d.f32],
  d.f32,
)((value, low, high) => {
  "use gpu";
  return std.max(low, std.min(high, value));
});

export const inverseLerp = tgpu.fn(
  [d.f32, d.f32, d.f32],
  d.f32,
)((value, from, to) => {
  "use gpu";
  if (from === to) {
    return 0;
  }
  return (value - from) / (to - from);
});

export const roundTo = tgpu.fn(
  [d.f32, d.f32],
  d.f32,
)((value, step) => {
  "use gpu";
  if (step <= 0) {
    return value;
  }
  return std.round(value / step) * step;
});

export const mod = tgpu.fn(
  [d.f32, d.f32],
  d.f32,
)((value, length) => {
  "use gpu";
  return ((value % length) + length) % length;
});

export const approxEquals = tgpu.fn(
  [d.f32, d.f32, d.f32],
  d.bool,
)((a, b, epsilon) => {
  "use gpu";
  return std.abs(a - b) <= epsilon * std.max(1, std.max(std.abs(a), std.abs(b)));
});
