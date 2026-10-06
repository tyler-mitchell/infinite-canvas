import { useMediaQuery } from "@base-ui/react/unstable-use-media-query";
import { pixelSize } from "@hyphened/math/cpu";
import { CatchBoundary } from "@tanstack/react-router";
import { hexToRgb } from "@typegpu/color";
import { ClientOnly, useConfigureContext, useFrame, useRoot, useUniform } from "@typegpu/react";
import { motion, usePageInView } from "motion/react";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { common, d, type TgpuFragmentFn } from "typegpu";
import {
  frame as surfaceFrame,
  sampleScene,
  sceneLayout,
  SCENE_FORMAT,
  SurfaceFrame,
  type SurfaceShader,
} from "../shaders/surface.ts";

export type ShaderSurfaceProps = {
  shader: SurfaceShader["source"];
  geometry?: SurfaceShader["geometry"];
  effect?: SurfaceShader["effect"];
  accent?: string;
  paused?: boolean;
  className?: string;
  resolution?: { width: number; height: number };
  renderScale?: number;
};

export function ShaderSurface(props: ShaderSurfaceProps) {
  const resetKey = useMemo(
    () => [props.shader, props.effect, props.accent],
    [props.shader, props.effect, props.accent],
  );
  return (
    <ClientOnly>
      <CatchBoundary
        getResetKey={() => resetKey}
        errorComponent={() => null}
        onCatch={(error) =>
          console.warn("Shader surface unavailable; content remains visible.", error)
        }
      >
        <Suspense fallback={null}>
          <ShaderCanvas {...props} />
        </Suspense>
      </CatchBoundary>
    </ClientOnly>
  );
}

function ShaderCanvas({
  shader,
  geometry,
  effect,
  accent = "#00e6a8",
  paused = false,
  className,
  resolution,
  renderScale = 1,
}: ShaderSurfaceProps) {
  const root = useRoot();
  const uniform = useUniform(SurfaceFrame);
  const effectUniform = useUniform(SurfaceFrame);
  const color = useMemo(() => hexToRgb(accent), [accent]);
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)", { noSsr: true });
  const pageVisible = usePageInView();
  const held = paused || reducedMotion;
  const [dimensions, setDimensions] = useState({ width: 1, height: 1 });
  const sampler = useMemo(
    () =>
      root.createSampler({
        minFilter: "linear",
        magFilter: "linear",
      }),
    [root],
  );
  const pipeline = useMemo(
    () =>
      root.with(surfaceFrame, uniform).createRenderPipeline({
        vertex: geometry?.vertex ?? common.fullScreenTriangle,
        fragment: shader,
        targets: { format: SCENE_FORMAT },
        depthStencil: geometry
          ? {
              format: "depth24plus",
              depthWriteEnabled: true,
              depthCompare: "less",
            }
          : undefined,
      }),
    [root, uniform, shader, geometry],
  );
  const sample = effect ?? sampleScene;
  const effectPipeline = useMemo(
    () =>
      effect === undefined && renderScale === 1
        ? undefined
        : root.with(surfaceFrame, effectUniform).createRenderPipeline({
            vertex: common.fullScreenTriangle,
            targets: { format: SCENE_FORMAT },
            fragment: ({ uv }: TgpuFragmentFn.AutoIn<{ uv: d.v2f }>) => {
              "use gpu";
              return sample(uv);
            },
          }),
    [root, effectUniform, effect, sample, renderScale],
  );
  const frame = useRef({
    visible: false,
    time: 0,
    dirty: true,
    draw: null as (() => void) | null,
  });
  const { ref, ctxRef } = useConfigureContext({
    format: SCENE_FORMAT,
    alphaMode: "premultiplied",
    autoResize: resolution === undefined,
  });

  useEffect(() => {
    const context = ctxRef.current;
    if (!context) return;
    const state = frame.current;
    const frameSize = pixelSize({
      ...dimensions,
      pixelRatio: globalThis.devicePixelRatio,
      scale: effectPipeline ? renderScale : 1,
    });
    const size = [frameSize.width, frameSize.height] as [number, number];
    const scene = effectPipeline
      ? root.createTexture({ size, format: SCENE_FORMAT }).$usage("render", "sampled")
      : undefined;
    const depth = geometry
      ? root.createTexture({ size, format: "depth24plus" }).$usage("render")
      : undefined;
    const colored = pipeline.withColorAttachment({
      view: scene ?? context,
      clearValue: [0, 0, 0, 0],
    });
    const render = depth
      ? colored.withDepthStencilAttachment({ view: depth, depthClearValue: 1 })
      : colored;
    const postprocess =
      effectPipeline && scene
        ? effectPipeline
            .with(root.createBindGroup(sceneLayout, { scene, sceneSampler: sampler }))
            .withColorAttachment({ view: context })
        : undefined;
    const values = {
      resolution: d.vec2f(frameSize.width, frameSize.height),
      time: state.time,
      pixelRatio: frameSize.pixelRatio,
      lightMode: 0,
      ground: d.vec3f(0, 0, 0),
      lightGround: d.vec3f(1, 1, 1),
      accent: color,
    };
    const effectValues = {
      ...values,
      resolution: d.vec2f(dimensions.width, dimensions.height),
      pixelRatio: globalThis.devicePixelRatio,
    };
    state.dirty = true;
    state.draw = () => {
      const encoder = root["~unstable"].createCommandEncoder();
      values.time = state.time;
      uniform.write(values);
      render.with(encoder).draw(geometry?.vertexCount ?? 3);
      if (postprocess) {
        effectValues.time = state.time;
        effectUniform.write(effectValues);
        postprocess.with(encoder).draw(3);
      }
      encoder.submit();
    };
    return () => {
      state.draw = null;
      scene?.destroy();
      depth?.destroy();
    };
  }, [
    root,
    uniform,
    effectUniform,
    ctxRef,
    dimensions,
    renderScale,
    geometry,
    pipeline,
    effectPipeline,
    sampler,
    color,
  ]);

  useFrame(({ deltaSeconds }) => {
    const context = ctxRef.current;
    const state = frame.current;
    if (!context || !state.visible || !pageVisible) return;
    const { width, height } = context.canvas;
    if (!width || !height) return;
    if (width !== dimensions.width || height !== dimensions.height) {
      setDimensions({ width, height });
      return;
    }
    if (!state.draw || (held && !state.dirty)) return;
    state.time += held ? 0 : deltaSeconds;
    state.draw();
    state.dirty = false;
  });

  return (
    <motion.canvas
      ref={ref}
      className={className}
      aria-hidden="true"
      width={resolution?.width}
      height={resolution?.height}
      onViewportEnter={() => {
        frame.current.visible = true;
      }}
      onViewportLeave={() => {
        frame.current.visible = false;
      }}
    />
  );
}
