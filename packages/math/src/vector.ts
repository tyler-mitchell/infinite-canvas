import { d, std, tgpu } from "typegpu";

export const cross = tgpu.fn(
  [d.vec2f, d.vec2f],
  d.f32,
)((a, b) => {
  "use gpu";
  return a.x * b.y - a.y * b.x;
});

export const perpendicular = tgpu.fn(
  [d.vec2f],
  d.vec2f,
)((vector) => {
  "use gpu";
  return d.vec2f(-vector.y, vector.x);
});

export const normalizeOrZero = tgpu.fn(
  [d.vec2f],
  d.vec2f,
)((vector) => {
  "use gpu";
  const length = std.length(vector);
  if (length === 0) {
    return d.vec2f(0, 0);
  }
  return std.div(vector, length);
});
