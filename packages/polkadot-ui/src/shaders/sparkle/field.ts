import { linearRgbToOklab, oklabToLinearRgb, srgbToLinear } from "@typegpu/color";
import { common, d, std, tgpu } from "typegpu";

import { ditherOffset } from "../noise.ts";
import { frame, type SurfaceBuildContext, type SurfaceSource } from "../surface.ts";

/** Every constant the field is tuned by. Values are inlined into the shader when it is built. */
export type FieldOptions = Readonly<{
  /** How much the glow widens and brightens as it breathes, 0 to 1. */
  breathAmount: number;
  /** Breaths per second, roughly. */
  breathRate: number;
  /** Where the folds converge, in a frame one unit tall centred on the surface. */
  centre: readonly [number, number];
  /** Multiplier on the accent's chroma; under 1 greys the tint. */
  chromaScale: number;
  /** How fast the tint cycles from one fold to the next. */
  colorCycle: number;
  /** Strength of a second glow beside the first, 0 for none. */
  echo: number;
  /** Where the second glow sits, along the glow's own axis. */
  echoShift: number;
  /** How quickly the field fades from its centre. */
  falloff: number;
  /** 1 or -1. */
  flowDirection: number;
  /** How fast the warp moves. */
  flowSpeed: number;
  /** Radians each fold turns the frame. */
  foldAngle: number;
  /** How much each fold shears the frame. */
  foldShear: number;
  /** How much each fold shrinks the frame; under 1 draws the glow inward. */
  foldShrink: number;
  /** Stretch of each glow along the two axes. */
  glowAspect: readonly [number, number];
  /** Where the glow sits in the folded frame. */
  glowOffset: readonly [number, number];
  /** Area of each glow. */
  glowSize: number;
  /** How rounded a glow's core is; larger is softer. */
  glowSoftness: number;
  /** How far the hue drifts from the accent's across the folds, as a turn. */
  hueSpread: number;
  /** How much distance from the centre shifts the hue. */
  hueTravel: number;
  /** Folds drawn, 1 to 96. Cost is linear in this. */
  layers: number;
  /** How far below the accent's lightness the tint starts; it reaches the accent at its peak. */
  lightSwing: number;
  /** Starting point of the flow, in seconds. */
  phase: number;
  /** Resolution the field paints at, as a fraction of the canvas. */
  renderScale: number;
  /** Radians the whole field is turned. */
  tilt: number;
  /** How much the edges darken, 0 to 1. */
  vignette: number;
  /** How much the warp displaces along each axis. */
  warpAmplitude: readonly [number, number];
  /** How tightly the warp ripples along each axis. */
  warpFrequency: readonly [number, number];
  /** Scale of the frame; larger shows less of the field. */
  zoom: number;
}>;

export const DEFAULT_FIELD_OPTIONS: FieldOptions = {
  breathAmount: 0.0962559357,
  breathRate: 0.595078051,
  centre: [0.464567035, -0.324401766],
  chromaScale: 1,
  colorCycle: 0.209053785,
  echo: 0,
  echoShift: -0.180173397,
  falloff: 0.350757927,
  flowDirection: 1,
  flowSpeed: 0.45394969,
  foldAngle: 2.13885212,
  foldShear: 0.970414996,
  foldShrink: 0.948949039,
  glowAspect: [1.83683717, 0.214501679],
  glowOffset: [0.366644979, 0.0380144492],
  glowSize: 0.00120369147,
  glowSoftness: 0.00139297883,
  hueSpread: -0.0352383479,
  hueTravel: 2.48984957,
  layers: 78,
  lightSwing: 0.339610457,
  phase: 50.839138,
  renderScale: 0.5,
  tilt: -0.832615376,
  vignette: 0.0517712161,
  warpAmplitude: [0.132101595, 0.0319737531],
  warpFrequency: [0.362112433, 2.75261736],
  zoom: 1.16705167,
};

const MAX_LAYERS = 96;
const TAU = Math.PI * 2;

const finite = (value: number, fallback: number) => (Number.isFinite(value) ? value : fallback);

/** Keeps the two values the shader cannot take as given inside what it can run. */
export function settleFieldOptions(options: FieldOptions): FieldOptions {
  return {
    ...options,
    layers: Math.min(MAX_LAYERS, Math.max(1, Math.round(finite(options.layers, 1)))),
    renderScale: Math.min(1, Math.max(0.1, finite(options.renderScale, 1))),
  };
}

const oklchToLinear = tgpu.fn(
  [d.f32, d.f32, d.f32],
  d.vec3f,
)((lightness, chroma, hue) => {
  "use gpu";

  return oklabToLinearRgb(d.vec3f(lightness, chroma * std.cos(hue), chroma * std.sin(hue)));
});

/** ACES-style curve, then the per-channel gamma the palette was tuned against. */
const shape = tgpu.fn(
  [d.vec3f],
  d.vec3f,
)((color) => {
  "use gpu";
  const x = std.max(color, d.vec3f(0, 0, 0));
  const high = std.mul(x, std.add(std.mul(x, 2.51), d.vec3f(0.03, 0.03, 0.03)));
  const low = std.add(
    std.mul(x, std.add(std.mul(x, 2.43), d.vec3f(0.59, 0.59, 0.59))),
    d.vec3f(0.14, 0.14, 0.14),
  );
  const mapped = std.clamp(std.div(high, low), d.vec3f(0, 0, 0), d.vec3f(1, 1, 1));

  return std.pow(mapped, d.vec3f(0.85, 0.92, 0.98));
});

/** The field: folded, warped glows tinted around the frame's accent, laid on its ground. */
export function createFieldFragment(options: FieldOptions) {
  const tuned = settleFieldOptions(options);
  const hueSpread = tuned.hueSpread * TAU;
  const tiltCos = Math.cos(tuned.tilt);
  const tiltSin = Math.sin(tuned.tilt);
  const foldCos = Math.cos(tuned.foldAngle);
  const foldSin = Math.sin(tuned.foldAngle);

  return tgpu.fragmentFn({
    in: { position: d.builtin.position, uv: d.vec2f },
    out: d.vec4f,
  })((input) => {
    "use gpu";
    const u = frame.$;
    // The accent in OKLab, so the tint keeps its hue and chroma and only its lightness swings.
    const accent = linearRgbToOklab(srgbToLinear(u.accent));
    const accentHue = std.atan2(accent.z, accent.y);
    const accentChroma = std.length(d.vec2f(accent.y, accent.z)) * tuned.chromaScale;
    const aspect = u.resolution.x / u.resolution.y;
    // Centred, y up, one unit tall: the frame the constants were tuned in.
    const pos = d.vec2f((input.uv.x - 0.5) * aspect, 0.5 - input.uv.y);
    const t = u.time * tuned.flowSpeed * tuned.flowDirection + tuned.phase;
    const breath =
      (-std.sin(u.time * tuned.breathRate * 1.5) + std.sin(u.time * tuned.breathRate + 1)) * 0.25 +
      0.5;

    let p = std.mul(
      std.sub(pos, d.vec2f(tuned.centre[0], tuned.centre[1])),
      tuned.zoom - breath * tuned.breathAmount,
    );
    p = std.mul(d.mat2x2f(tiltCos, tiltSin, -tiltSin, tiltCos), p);
    const fold = d.mat2x2f(foldCos, foldSin, -tuned.foldShear, foldCos);
    let color = d.vec3f(0, 0, 0);

    for (let i = d.f32(1); i <= tuned.layers; i += 1) {
      p.x += -std.sin(p.y * tuned.warpFrequency[0] + t + i * 0.007) * tuned.warpAmplitude[0];
      p.y += -std.sin(p.x * tuned.warpFrequency[1] - t + i * 0.02) * tuned.warpAmplitude[1];
      p = std.mul(std.mul(fold, p), tuned.foldShrink);

      const q = std.sub(p, d.vec2f(tuned.glowOffset[0] + breath * 0.1, tuned.glowOffset[1]));
      const s = d.vec2f(q.x * tuned.glowAspect[0], q.y * tuned.glowAspect[1]);
      let glow = tuned.glowSize / (std.dot(s, s) + tuned.glowSoftness);
      if (tuned.echo > 0) {
        const e = d.vec2f((q.x - tuned.echoShift) * tuned.glowAspect[0], s.y);
        glow += (tuned.echo * tuned.glowSize) / (std.dot(e, e) + tuned.glowSoftness);
      }
      glow *= 0.25 + breath * 0.4;

      const r = std.length(p);
      const k = std.sin(i * tuned.colorCycle + t * 1.2 + r * tuned.hueTravel) * 0.5 + 0.5;
      const tint = std.clamp(
        oklchToLinear(
          accent.x + tuned.lightSwing * (k - 1),
          accentChroma * (0.75 + 0.35 * k),
          accentHue + hueSpread * k,
        ),
        d.vec3f(0, 0, 0),
        d.vec3f(1, 1, 1),
      );
      color = std.add(color, std.mul(tint, glow * std.exp2(-r * tuned.falloff)));
    }

    const edge = std.smoothstep(0.5, 1.6, std.length(pos));
    const lit = std.mul(shape(color), 1 - edge * tuned.vignette);
    const onDark = std.add(u.ground, std.mul(lit, std.sub(d.vec3f(1, 1, 1), u.ground)));
    const strength = std.max(lit.x, std.max(lit.y, lit.z));
    const onLight = std.add(std.mul(u.lightGround, 1 - strength), std.mul(lit, 0.96));
    const dither = ditherOffset(input.position.xy, u.time);
    const laid = std.add(std.mix(onDark, onLight, u.lightMode), d.vec3f(dither, dither, dither));

    return d.vec4f(std.clamp(laid, d.vec3f(0, 0, 0), d.vec3f(1, 1, 1)), 1);
  });
}

/** The field as a backdrop source. */
export function createFieldSource(options: FieldOptions = DEFAULT_FIELD_OPTIONS): SurfaceSource {
  const tuned = settleFieldOptions(options);
  const fragment = createFieldFragment(tuned);

  return {
    build: ({ configured, format }: SurfaceBuildContext) => {
      const pipeline = configured.createRenderPipeline({
        fragment,
        targets: { format },
        vertex: common.fullScreenTriangle,
      });

      return { draw: (pass) => pipeline.with(pass).draw(3) };
    },
    renderScale: tuned.renderScale,
  };
}
