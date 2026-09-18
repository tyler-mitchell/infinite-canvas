import { d, std, tgpu } from "typegpu";
import { Rect } from "./rect";

export const Transform = d.struct({ xAxis: d.vec2f, yAxis: d.vec2f, origin: d.vec2f });
export type Transform = d.Infer<typeof Transform>;

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

export const translationTransform = tgpu.fn(
  [d.vec2f],
  Transform,
)((by) => {
  "use gpu";
  return Transform({ xAxis: d.vec2f(1, 0), yAxis: d.vec2f(0, 1), origin: by });
});

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

export const transformDirection = tgpu.fn(
  [Transform, d.vec2f],
  d.vec2f,
)((transform, direction) => {
  "use gpu";
  return std.add(std.mul(direction.x, transform.xAxis), std.mul(direction.y, transform.yAxis));
});

export const transformPoint = tgpu.fn(
  [Transform, d.vec2f],
  d.vec2f,
)((transform, point) => {
  "use gpu";
  return std.add(transformDirection(transform, point), transform.origin);
});

export const composeTransforms = tgpu.fn(
  [Transform, Transform],
  Transform,
)((outer, inner) => {
  "use gpu";
  return Transform({
    xAxis: transformDirection(outer, inner.xAxis),
    yAxis: transformDirection(outer, inner.yAxis),
    origin: transformPoint(outer, inner.origin),
  });
});

export const transformDeterminant = tgpu.fn(
  [Transform],
  d.f32,
)((transform) => {
  "use gpu";
  return transform.xAxis.x * transform.yAxis.y - transform.yAxis.x * transform.xAxis.y;
});

export const invertTransform = tgpu.fn(
  [Transform],
  Transform,
)((transform) => {
  "use gpu";
  const determinant = transformDeterminant(transform);
  if (determinant === 0) {
    return identityTransform();
  }
  const scale = 1 / determinant;
  const xAxis = d.vec2f(transform.yAxis.y * scale, -transform.xAxis.y * scale);
  const yAxis = d.vec2f(-transform.yAxis.x * scale, transform.xAxis.x * scale);
  return Transform({
    xAxis,
    yAxis,
    origin: std.neg(
      std.add(std.mul(transform.origin.x, xAxis), std.mul(transform.origin.y, yAxis)),
    ),
  });
});

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
