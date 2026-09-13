import type {
  TgpuBindGroup,
  TgpuBindGroupLayout,
  TgpuRenderPass,
  TgpuRoot,
  WithBinding,
} from "typegpu";
import { d, tgpu } from "typegpu";

/**
 * The contract every backdrop shader is written against. A shader is a source that paints a
 * whole surface and effects that each read the scene painted so far and paint the next one.
 */

/** What the host writes for every stage of a backdrop. */
export const SurfaceFrame = d.struct({
  /** Device pixels of the canvas. */
  resolution: d.vec2f,
  /** Seconds the backdrop has been animating. */
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

export type SceneBinding =
  typeof sceneLayout extends TgpuBindGroupLayout<infer Entries> ? TgpuBindGroup<Entries> : never;

/** Format of every scene a stage paints for the next one to read. */
export const SCENE_FORMAT: GPUTextureFormat = "rgba8unorm";

/** Handed to a stage once. It creates its pipeline from this and nothing else. */
export type SurfaceBuildContext = Readonly<{
  /** The root with `frame` bound. Pipelines come from here so `frame.$` reads the host's uniform. */
  configured: WithBinding;
  /** Colour format of the target this stage paints. */
  format: GPUTextureFormat;
  root: TgpuRoot;
}>;

/** Paints a whole surface from nothing. */
export type SurfaceSource = Readonly<{
  build: (context: SurfaceBuildContext) => Readonly<{ draw: (pass: TgpuRenderPass) => void }>;
  /**
   * Resolution the source paints at, as a fraction of the canvas. A smooth source at 0.5 costs a
   * quarter of the fragments and is sampled back up by the effect after it.
   */
  renderScale: number;
}>;

/** Reads the scene painted so far and paints the next one. */
export type SurfaceEffect = Readonly<{
  build: (
    context: SurfaceBuildContext,
  ) => Readonly<{ draw: (pass: TgpuRenderPass, scene: SceneBinding) => void }>;
}>;

/** A backdrop: one source, then effects in order. The last stage paints the canvas. */
export type SurfaceShader = Readonly<{
  effects: readonly SurfaceEffect[];
  source: SurfaceSource;
}>;
