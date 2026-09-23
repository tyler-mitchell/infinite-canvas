import type { TgpuFragmentFn, TgpuVertexFn } from "typegpu";
import { d, std, tgpu } from "typegpu";

/** Uniforms shared by the source and effect passes. */
export const SurfaceFrame = d.struct({
  /** Device pixels of the canvas. */
  resolution: d.vec2f,
  /** Elapsed animation time in seconds. */
  time: d.f32,
  /** Device pixels per CSS pixel, after the host's cap. */
  pixelRatio: d.f32,
  /** 0 lays ink on `ground`, 1 lays it on `lightGround`. */
  lightMode: d.f32,
  /** sRGB, 0 to 1. */
  ground: d.vec3f,
  /** sRGB, 0 to 1. */
  lightGround: d.vec3f,
  /** sRGB, 0 to 1. The colour a shader tints with. */
  accent: d.vec3f,
});

/** The frame as a shader reads it. The host binds its uniform; the default lets WGSL resolve. */
export const frame = tgpu.accessor(SurfaceFrame, {
  resolution: d.vec2f(1, 1),
  time: 0,
  pixelRatio: 1,
  lightMode: 0,
  ground: d.vec3f(0, 0, 0),
  lightGround: d.vec3f(1, 1, 1),
  accent: d.vec3f(0, 0.9, 0.66),
});

/** The scene an effect reads: whatever the stage before it painted. */
export const sceneLayout = tgpu.bindGroupLayout({
  scene: { texture: d.texture2d(d.f32) },
  sceneSampler: { sampler: "filtering" },
});

export type SurfaceEffect = (uv: d.v2f) => d.v4f;

export const sampleScene = tgpu.fn([d.vec2f], d.vec4f)((uv) => {
  "use gpu";
  return std.textureSample(sceneLayout.$.scene, sceneLayout.$.sceneSampler, uv);
});

/** Format of every scene a stage paints for the next one to read. */
export const SCENE_FORMAT: GPUTextureFormat = "rgba8unorm";

type Fragment = TgpuFragmentFn<{ uv: typeof d.vec2f }, typeof d.vec4f> |
  ((input: TgpuFragmentFn.AutoIn<{ uv: d.v2f }>) => d.v4f);

/** One source pass and an optional composed effect pass. */
export type SurfaceShader = Readonly<{
  effect?: SurfaceEffect;
  source: Fragment;
  geometry?: {
    vertex: TgpuVertexFn<
      { vertexIndex: typeof d.builtin.vertexIndex },
      { position: typeof d.builtin.position; uv: typeof d.vec2f }
    >;
    vertexCount: number;
  };
  renderScale: number;
}>;
