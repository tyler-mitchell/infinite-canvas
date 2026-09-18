import { d, std, tgpu } from "typegpu";
import { clamp } from "./scalar";

export const intervalEnd = tgpu.fn(
  [d.f32, d.f32],
  d.f32,
)((start, length) => {
  "use gpu";
  return start + length;
});

export const containsValue = tgpu.fn(
  [d.f32, d.f32, d.f32],
  d.bool,
)((start, length, value) => {
  "use gpu";
  return value >= start && value <= start + length;
});

export const containsInterval = tgpu.fn(
  [d.f32, d.f32, d.f32, d.f32],
  d.bool,
)((start, length, otherStart, otherLength) => {
  "use gpu";
  return otherStart >= start && otherStart + otherLength <= start + length;
});

export const intersectsInterval = tgpu.fn(
  [d.f32, d.f32, d.f32, d.f32],
  d.bool,
)((start, length, otherStart, otherLength) => {
  "use gpu";
  return start <= otherStart + otherLength && start + length >= otherStart;
});

export const overlapsInterval = tgpu.fn(
  [d.f32, d.f32, d.f32, d.f32],
  d.bool,
)((start, length, otherStart, otherLength) => {
  "use gpu";
  return start < otherStart + otherLength && start + length > otherStart;
});

export const gapBetweenIntervals = tgpu.fn(
  [d.f32, d.f32, d.f32, d.f32],
  d.f32,
)((start, length, otherStart, otherLength) => {
  "use gpu";
  return std.max(start, otherStart) - std.min(start + length, otherStart + otherLength);
});

export const intersectionStart = tgpu.fn(
  [d.f32, d.f32],
  d.f32,
)((start, otherStart) => {
  "use gpu";
  return std.max(start, otherStart);
});

export const intersectionLength = tgpu.fn(
  [d.f32, d.f32, d.f32, d.f32],
  d.f32,
)((start, length, otherStart, otherLength) => {
  "use gpu";
  return std.min(start + length, otherStart + otherLength) - std.max(start, otherStart);
});

export const unionStart = tgpu.fn(
  [d.f32, d.f32],
  d.f32,
)((start, otherStart) => {
  "use gpu";
  return std.min(start, otherStart);
});

export const unionLength = tgpu.fn(
  [d.f32, d.f32, d.f32, d.f32],
  d.f32,
)((start, length, otherStart, otherLength) => {
  "use gpu";
  return std.max(start + length, otherStart + otherLength) - std.min(start, otherStart);
});

export const clampToInterval = tgpu.fn(
  [d.f32, d.f32, d.f32],
  d.f32,
)((value, start, length) => {
  "use gpu";
  return clamp(value, start, start + length);
});

export const clampIntervalWithin = tgpu.fn(
  [d.f32, d.f32, d.f32, d.f32],
  d.f32,
)((start, length, boundsStart, boundsLength) => {
  "use gpu";
  return clamp(start, boundsStart, boundsStart + boundsLength - length);
});

export const alignInInterval = tgpu.fn(
  [d.f32, d.f32, d.f32, d.f32],
  d.f32,
)((boundsStart, boundsLength, length, align) => {
  "use gpu";
  return boundsStart + (boundsLength - length) * align;
});

export const insetIntervalStart = tgpu.fn(
  [d.f32, d.f32],
  d.f32,
)((start, before) => {
  "use gpu";
  return start + before;
});

export const insetIntervalLength = tgpu.fn(
  [d.f32, d.f32, d.f32],
  d.f32,
)((length, before, after) => {
  "use gpu";
  return std.max(0, length - before - after);
});

export const scaleIntervalAbout = tgpu.fn(
  [d.f32, d.f32, d.f32],
  d.f32,
)((start, origin, factor) => {
  "use gpu";
  return origin + (start - origin) * factor;
});
