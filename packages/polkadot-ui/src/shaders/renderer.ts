import type { RenderFlag, SampledFlag, TgpuRoot, TgpuTexture, TgpuUniform } from "typegpu";

import {
  SCENE_FORMAT,
  type SceneBinding,
  type SurfaceFrame,
  type SurfaceShader,
  frame,
  sceneLayout,
} from "./surface.ts";

export type SurfaceSize = Readonly<{ height: number; width: number }>;

type Scene = Readonly<{
  binding: SceneBinding;
  height: number;
  texture: TgpuTexture<{ format: GPUTextureFormat; size: [number, number] }> &
    RenderFlag &
    SampledFlag;
  width: number;
}>;

export type SurfaceRenderer = Readonly<{
  /** Paints one frame onto the canvas, all stages in one submission. */
  draw: (view: GPUCanvasContext, size: SurfaceSize) => void;
  /** Frees the scenes. A later draw allocates them again. */
  destroy: () => void;
}>;

/** Slot 0 holds the source's scene; 1 and 2 alternate between effects. */
const SLOTS = 3;

/**
 * Builds every stage of a shader once and paints them in order each frame: the source into a
 * scene, each effect from the scene before it into the next, the last onto the canvas.
 */
export function createSurfaceRenderer({
  format,
  frameUniform,
  root,
  shader,
}: Readonly<{
  format: GPUTextureFormat;
  frameUniform: TgpuUniform<typeof SurfaceFrame>;
  root: TgpuRoot;
  shader: SurfaceShader;
}>): SurfaceRenderer {
  const configured = root.with(frame, frameUniform);
  const last = shader.effects.length - 1;
  const source = shader.source.build({
    configured,
    format: last < 0 ? format : SCENE_FORMAT,
    root,
  });
  const effects = shader.effects.map((effect, index) =>
    effect.build({ configured, format: index === last ? format : SCENE_FORMAT, root }),
  );
  const sampler = root.createSampler({
    addressModeU: "clamp-to-edge",
    addressModeV: "clamp-to-edge",
    magFilter: "linear",
    minFilter: "linear",
  });
  const scenes: (Scene | null)[] = Array.from({ length: SLOTS }, () => null);

  const sceneAt = (slot: number, width: number, height: number): Scene => {
    const held = scenes[slot];
    if (held !== null && held !== undefined && held.width === width && held.height === height) {
      return held;
    }
    held?.texture.destroy();
    const texture = root
      .createTexture({ format: SCENE_FORMAT, size: [width, height] })
      .$usage("sampled", "render");
    const scene: Scene = {
      binding: root.createBindGroup(sceneLayout, { scene: texture, sceneSampler: sampler }),
      height,
      texture,
      width,
    };
    scenes[slot] = scene;

    return scene;
  };

  return {
    destroy: () => {
      scenes.forEach((scene, slot) => {
        scene?.texture.destroy();
        scenes[slot] = null;
      });
    },
    draw: (view, size) => {
      const encoder = root["~unstable"].createCommandEncoder();

      if (last < 0) {
        const pass = encoder.beginRenderPass({ colorAttachments: { view } });
        source.draw(pass);
        pass.end();
        encoder.submit();
        return;
      }

      const scale = shader.source.renderScale;
      const painted = sceneAt(
        0,
        Math.max(1, Math.round(size.width * scale)),
        Math.max(1, Math.round(size.height * scale)),
      );
      const first = encoder.beginRenderPass({ colorAttachments: { view: painted.texture } });
      source.draw(first);
      first.end();

      effects.forEach((effect, index) => {
        const reads =
          index === 0 ? painted : sceneAt(1 + ((index - 1) % 2), size.width, size.height);
        const target =
          index === last ? view : sceneAt(1 + (index % 2), size.width, size.height).texture;
        const pass = encoder.beginRenderPass({ colorAttachments: { view: target } });
        effect.draw(pass, reads.binding);
        pass.end();
      });

      encoder.submit();
    },
  };
}
