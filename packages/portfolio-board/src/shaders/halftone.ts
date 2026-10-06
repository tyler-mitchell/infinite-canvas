import { d, std, tgpu } from "typegpu";
import { ditherOffset } from "@hyphened/math/gpu";
import { frame, sampleScene, type SurfaceEffect } from "./surface.ts";

export type HalftoneOptions = Readonly<{
  sample?: SurfaceEffect;
  scale?: number;
  strength?: number;
  seed?: number;
}>;

/** Dot-screen effect adapted from @jiang, OpenShaders: https://openshaders.com/@jiang */
export function halftone({
  sample = sampleScene,
  scale = 0.991827428,
  strength = 1.16464746,
  seed = 0.788444757,
}: HalftoneOptions = {}) {
  return tgpu.fn(
    [d.vec2f],
    d.vec4f,
  )((uv) => {
    "use gpu";
    const soft = sample(uv);
    if (strength <= 0) return d.vec4f(soft);
    const u = frame.$;
    const frag = std.mul(uv, u.resolution);
    const cell = std.max(3, scale * 3.6 * u.pixelRatio);
    const angle = 0.26 + seed * 0.3;
    const turn = d.mat2x2f(
      d.vec2f(std.cos(angle), -std.sin(angle)),
      d.vec2f(std.sin(angle), std.cos(angle)),
    );
    const rotated = std.mul(turn, frag);
    const centre = std.mul(std.add(std.floor(std.div(rotated, cell)), d.vec2f(0.5)), cell);
    const source = std.mul(std.transpose(turn), centre);
    const color = sample(std.clamp(std.div(source, u.resolution), d.vec2f(0), d.vec2f(1)));
    const ink = std.mix(
      std.sub(color.xyz, u.ground),
      std.sub(u.lightGround, color.xyz),
      u.lightMode,
    );
    const level = std.clamp(std.dot(ink, d.vec3f(0.2126, 0.7152, 0.0722)), 0, 1);
    const radius = cell * std.sqrt(std.pow(level, 0.9) / Math.PI);
    const distance = std.length(std.sub(rotated, centre));
    const aa = 0.7 * u.pixelRatio;
    const dot = 1 - std.smoothstep(radius - aa, radius + aa, distance);
    const dots = std.mul(ink, std.min(0.8 / std.max(level, 0.001), 2.2) * dot);
    const laid = std.mix(std.add(u.ground, dots), std.sub(u.lightGround, dots), u.lightMode);
    const presence = std.clamp(std.smoothstep(0.03, 0.16, level) * (0.3 + 0.14 * strength), 0, 1);
    const result = std.add(std.mix(soft.xyz, laid, presence), d.vec3f(ditherOffset(frag, u.time)));
    return d.vec4f(std.clamp(result, d.vec3f(0), d.vec3f(soft.w)), soft.w);
  });
}
