import { randf } from "@typegpu/noise";
import { common, d, std, tgpu } from "typegpu";

import { ditherOffset } from "../noise.ts";
import { frame, sceneLayout, type SurfaceBuildContext, type SurfaceEffect } from "../surface.ts";

/** Every constant the glints are tuned by. Values are inlined into the shader when it is built. */
export type GlintOptions = Readonly<{
  /** Cell size multiplier; larger spreads the glints out. */
  scale: number;
  /** Which cells twinkle. Any number. */
  seed: number;
  /** Brightness of every glint, 0 to 1. */
  strength: number;
}>;

export const DEFAULT_GLINT_OPTIONS: GlintOptions = {
  scale: 1.07589865,
  seed: 0.745793998,
  strength: 0.909213006,
};

const TAU = Math.PI * 2;
const LUMA = d.vec3f(0.2126, 0.7152, 0.0722);

/** Ink is what the scene added to its ground, so a glint can read how bright the scene is. */
const toInk = tgpu.fn(
  [d.vec3f],
  d.vec3f,
)((color) => {
  "use gpu";
  const u = frame.$;

  return std.mix(std.sub(color, u.ground), std.sub(u.lightGround, color), u.lightMode);
});

const fromInk = tgpu.fn(
  [d.vec3f],
  d.vec3f,
)((ink) => {
  "use gpu";
  const u = frame.$;

  return std.mix(std.add(u.ground, ink), std.sub(u.lightGround, ink), u.lightMode);
});

const sceneInk = tgpu.fn(
  [d.vec2f],
  d.vec3f,
)((uv) => {
  "use gpu";
  const clamped = std.clamp(uv, d.vec2f(0, 0), d.vec2f(1, 1));

  return toInk(std.textureSample(sceneLayout.$.scene, sceneLayout.$.sceneSampler, clamped).xyz);
});

/** Twinkling glints on the bright parts of the scene: two grids of cells, one point each. */
export function createGlintFragment(options: GlintOptions) {
  return tgpu.fragmentFn({
    in: { position: d.builtin.position, uv: d.vec2f },
    out: d.vec4f,
  })((input) => {
    "use gpu";
    const u = frame.$;
    const frag = input.position.xy;
    const ink = sceneInk(std.div(frag, u.resolution));
    let glow = d.vec3f(0, 0, 0);

    for (const layer of tgpu.unroll(std.range(2))) {
      const size = (30 - 10 * layer) * u.pixelRatio * options.scale;
      const cell = std.floor(std.div(frag, size));
      randf.seed3(d.vec3f(cell, layer * 31 + options.seed * 97));
      const h = d.vec3f(randf.sample(), randf.sample(), randf.sample());
      const point = std.mul(std.add(std.add(cell, d.vec2f(0.2, 0.2)), std.mul(h.xy, 0.6)), size);
      const at = sceneInk(std.div(point, u.resolution));

      const peak = std.max(at.x, std.max(at.y, at.z));
      const presence = std.smoothstep(
        0.1,
        0.45,
        std.mix(std.dot(at, LUMA), peak * 1.4, u.lightMode),
      );
      let twinkle = std.max(std.sin(u.time * (0.8 + h.z * 1.2) + h.x * TAU), 0);
      twinkle = twinkle * twinkle;
      twinkle = twinkle * twinkle;
      twinkle = twinkle * twinkle;
      const o = std.div(std.sub(frag, point), u.pixelRatio);
      const core = std.exp(-std.dot(o, o) * 0.9);
      const rays =
        std.exp(-std.abs(o.x) * 1.6 - std.abs(o.y) * 0.45) +
        std.exp(-std.abs(o.y) * 1.6 - std.abs(o.x) * 0.45);
      const glint = (core + 0.25 * rays) * twinkle * presence * (0.35 + 0.65 * std.step(0.45, h.z));

      const pale = std.mix(
        std.mul(std.div(at, std.max(std.dot(at, LUMA), 0.001)), 0.6),
        d.vec3f(1, 1, 1),
        0.55,
      );
      const vivid = std.add(
        std.mul(std.div(at, std.max(peak, 0.001)), 0.75),
        d.vec3f(0.25, 0.25, 0.25),
      );
      const tint = std.mix(pale, vivid, u.lightMode);
      glow = std.add(glow, std.mul(tint, glint * 0.9 * options.strength));
    }

    const laid = fromInk(std.clamp(std.add(ink, glow), d.vec3f(0, 0, 0), d.vec3f(1, 1, 1)));
    const dither = ditherOffset(frag, u.time);
    const dithered = std.add(laid, d.vec3f(dither, dither, dither));

    return d.vec4f(std.clamp(dithered, d.vec3f(0, 0, 0), d.vec3f(1, 1, 1)), 1);
  });
}

/** The glints as a backdrop effect. */
export function createGlintEffect(options: GlintOptions = DEFAULT_GLINT_OPTIONS): SurfaceEffect {
  const fragment = createGlintFragment(options);

  return {
    build: ({ configured, format }: SurfaceBuildContext) => {
      const pipeline = configured.createRenderPipeline({
        fragment,
        targets: { format },
        vertex: common.fullScreenTriangle,
      });

      return { draw: (pass, scene) => pipeline.with(scene).with(pass).draw(3) };
    },
  };
}
