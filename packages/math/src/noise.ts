import { d, std, tgpu } from "typegpu";

/** Screen-space ordered noise in [0, 1). Jimenez 2014. */
export const interleavedGradientNoise = tgpu.fn(
  [d.vec2f],
  d.f32,
)((point) => {
  "use gpu";

  return std.fract(52.9829189 * std.fract(0.06711056 * point.x + 0.00583715 * point.y));
});

/** One 8-bit step of dither, moved every frame so banding does not sit still. */
export const ditherOffset = tgpu.fn(
  [d.vec2f, d.f32],
  d.f32,
)((frag, time) => {
  "use gpu";
  const step = std.floor(time * 24) % 64;
  const shifted = std.add(frag, std.mul(d.vec2f(5.588238, 5.588238), step));

  return (interleavedGradientNoise(shifted) - 0.5) / 255;
});
