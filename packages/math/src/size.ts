import { d, std, tgpu } from "typegpu";

export const containScale = tgpu.fn(
  [d.vec2f, d.vec2f],
  d.f32,
)((size, within) => {
  "use gpu";
  if (size.x <= 0 || size.y <= 0) {
    return 1;
  }
  return std.min(within.x / size.x, within.y / size.y);
});

export const coverScale = tgpu.fn(
  [d.vec2f, d.vec2f],
  d.f32,
)((size, within) => {
  "use gpu";
  if (size.x <= 0 || size.y <= 0) {
    return 1;
  }
  return std.max(within.x / size.x, within.y / size.y);
});
