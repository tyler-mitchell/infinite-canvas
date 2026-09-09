"use client";

import {
  useConfigureContext,
  useFrame,
  useMutable,
  useReadonly,
  useRoot,
  useRootWithStatus,
  useUniform,
} from "@typegpu/react";
import { memo, useMemo, type Ref } from "react";
import { common, d } from "typegpu";

import { DEFAULT_INFINITE_CANVAS_CHROME, DEFAULT_INFINITE_CANVAS_THEME } from "../../constants";
import { EMPTY_INFINITE_CANVAS_DROP } from "../../drop-interaction";
import { getVisibleWorldRect } from "../../geometry";
import {
  getInfiniteCanvasViewportScreenRect,
  getVisibleInfiniteCanvasWindowProxies,
} from "../../scene-layer-geometry";
import { SCENE_UNDERLAY_Z_INDEX } from "../../scene-surface";
import type { InfiniteCanvasSceneSurfaceProps } from "../../scene-surface";
import { resolveInfiniteCanvasSpatialTarget } from "../../spatial-target";
import { findWindow } from "../../stacking";
import { useInfiniteCanvasActions, useInfiniteCanvasStore } from "../../store";
import type {
  InfiniteCanvasDropPayload,
  InfiniteCanvasSceneLayerPlacement,
  InfiniteCanvasSceneLayerRenderContext,
  InfiniteCanvasSceneLayerSpace,
  InfiniteCanvasState,
} from "../../types";
import { getInfiniteCanvasWindowProxies, getInfiniteCanvasWindowProxy } from "../../window-proxy";
import type { CompositorBuiltPass, CompositorTarget, InfiniteCanvasScenePass } from "../pass";
import { DEFAULT_INFINITE_CANVAS_COMPOSITOR, type InfiniteCanvasCompositorPolicy } from "../policy";
import { createInfiniteCanvasAreaLightPass } from "../passes/area-light";
import { createInfiniteCanvasConnectionsPass } from "../passes/connections";
import { createInfiniteCanvasContactShadowPass } from "../passes/contact-shadow";
import { createInfiniteCanvasFocusFieldPass } from "../passes/focus-field";
import { createInfiniteCanvasGridPass } from "../passes/grid";
import { createInfiniteCanvasParticleFieldPass } from "../passes/particle-field";
import { createInfiniteCanvasProximityPass } from "../passes/proximity";
import { CompositorCamera, camera } from "./camera";
import { WindowInstances, getWindowInstanceColumns, instanceCount, instances } from "./instances";
import { WorldClock, bodies, clock, getWorldWorkgroups, settleWorld, targets } from "./world";

/** Transparent, premultiplied. The DOM plane shows through what no pass paints. */
const CLEAR_VALUE = [0, 0, 0, 0] as const;

/** Longest step the world may simulate in one frame. A hidden tab returns with a large gap. */
const MAX_STEP_SECONDS = 1 / 20;

/** One shared empty list for list defaults. A new array per render would rebuild every pipeline. */
const EMPTY_LIST: readonly never[] = [];

/** The passes the policy enables for the underlay. Consumer passes follow these. */
function getFrameworkPasses<Kind extends string, Payload>(
  placement: InfiniteCanvasSceneLayerPlacement,
  policy: InfiniteCanvasCompositorPolicy,
): readonly InfiniteCanvasScenePass<Kind, Payload>[] {
  if (placement !== "underlay") {
    return [];
  }

  return [
    // The grid is the floor of the medium, so it paints before anything on it.
    ...(policy.grid === false ? [] : [createInfiniteCanvasGridPass<Kind, Payload>(policy.grid)]),
    ...(policy.areaLight === false
      ? []
      : [createInfiniteCanvasAreaLightPass<Kind, Payload>(policy.areaLight)]),
    ...(policy.contactShadow === false
      ? []
      : [createInfiniteCanvasContactShadowPass<Kind, Payload>(policy.contactShadow)]),
    // After the shadows, so an edge reads as lying on the medium rather than under it.
    ...(policy.connections === false
      ? []
      : [createInfiniteCanvasConnectionsPass<Kind, Payload>(policy.connections)]),
    ...(policy.particleField === false
      ? []
      : [createInfiniteCanvasParticleFieldPass<Kind, Payload>(policy.particleField)]),
    ...(policy.focusField === false
      ? []
      : [createInfiniteCanvasFocusFieldPass<Kind, Payload>(policy.focusField)]),
    ...(policy.proximity === false
      ? []
      : [createInfiniteCanvasProximityPass<Kind, Payload>(policy.proximity)]),
  ];
}

/**
 * The first draw of a frame clears the canvas and every later draw keeps what
 * is there. Each draw submits its own render pass, as TypeGPU's pipeline
 * documentation shows for several pipelines on one canvas.
 */
function createFrameTarget(view: GPUCanvasContext): CompositorTarget {
  const claimed = { any: false };

  return () => {
    const attachment = claimed.any
      ? ({ loadOp: "load", storeOp: "store", view } as const)
      : ({ clearValue: CLEAR_VALUE, loadOp: "clear", storeOp: "store", view } as const);

    claimed.any = true;

    return attachment;
  };
}

function getCameraValue(
  state: InfiniteCanvasState,
  space: InfiniteCanvasSceneLayerSpace,
  devicePixelRatio: number,
) {
  return {
    center:
      space === "screen" ? d.vec2f(0, 0) : d.vec2f(state.camera.center.x, state.camera.center.y),
    devicePixelRatio,
    viewport: d.vec2f(state.viewport.width, state.viewport.height),
    zoom: space === "screen" ? 1 : state.camera.zoom,
  };
}

type BuiltEntry<Kind extends string, Payload> = Readonly<{
  pass: CompositorBuiltPass<Kind, Payload>;
  space: InfiniteCanvasSceneLayerSpace;
}>;

function CompositorSurface<Kind extends string, Payload = InfiniteCanvasDropPayload>(
  props: InfiniteCanvasSceneSurfaceProps<Kind, Payload>,
) {
  return useRootWithStatus().status === "fulfilled" ? <CompositorCanvas {...props} /> : null;
}

/**
 * Paints every scene pass of one placement onto one canvas. The global
 * @typegpu/react root is shared by both placements. Without WebGPU nothing
 * mounts and the DOM plane stands.
 *
 * Memoized because the window plane re-renders on every store change, while
 * this surface reads the store in its frame callback and needs no render of
 * its own. A render re-attaches the canvas ref, which makes
 * `useConfigureContext` observe the canvas again; a new observation writes
 * `canvas.width`, and that resets the canvas and drops its swap chain. During
 * a drag that blanked most frames.
 */
const InfiniteCanvasCompositorSurface = memo(CompositorSurface) as typeof CompositorSurface;

function CompositorCanvas<Kind extends string, Payload = InfiniteCanvasDropPayload>({
  chrome = DEFAULT_INFINITE_CANVAS_CHROME,
  compositor = DEFAULT_INFINITE_CANVAS_COMPOSITOR,
  devicePixelRatio = 1,
  dropInteraction = EMPTY_INFINITE_CANVAS_DROP,
  placement,
  sceneLayers = EMPTY_LIST,
  spatialTargetResolvers = EMPTY_LIST,
  theme = DEFAULT_INFINITE_CANVAS_THEME,
  zIndex = SCENE_UNDERLAY_Z_INDEX,
}: InfiniteCanvasSceneSurfaceProps<Kind, Payload>) {
  const root = useRoot();
  const store = useInfiniteCanvasStore<Kind>();
  const actions = useInfiniteCanvasActions<Kind>();
  const worldCamera = useUniform(CompositorCamera);
  const screenCamera = useUniform(CompositorCamera);
  // The document's ask for this frame. Nothing draws from it directly.
  const targetStore = useReadonly(WindowInstances);
  // What the world is. The settle step writes it; every pass reads it.
  const bodyStore = useMutable(WindowInstances);
  const worldClock = useUniform(WorldClock, { initial: { dt: 0 } });
  const instanceCountUniform = useUniform(d.u32, { initial: 0 });
  const { ctxRef, ref } = useConfigureContext({ alphaMode: "premultiplied" });

  // Pipelines are built once per policy, as @typegpu/react requires.
  const built = useMemo<readonly BuiltEntry<Kind, Payload>[]>(() => {
    const format = navigator.gpu.getPreferredCanvasFormat();
    // Passes bind `instances` to the world, so they draw where a window IS.
    const configuredRoots = {
      screen: root
        .with(camera, screenCamera)
        .with(instances, bodyStore.buffer.as("readonly"))
        .with(instanceCount, instanceCountUniform),
      world: root
        .with(camera, worldCamera)
        .with(instances, bodyStore.buffer.as("readonly"))
        .with(instanceCount, instanceCountUniform),
    };
    const layers = [...getFrameworkPasses<Kind, Payload>(placement, compositor), ...sceneLayers];

    // World layers paint before screen layers; each group keeps its declared order.
    return [
      ...layers.filter((layer) => (layer.space ?? "world") === "world"),
      ...layers.filter((layer) => (layer.space ?? "world") === "screen"),
    ].map((layer) => {
      const space = layer.space ?? "world";

      return {
        pass: layer.build({
          configured: configuredRoots[space],
          format,
          root,
          signals$: store.signals$,
        }),
        space,
      };
    });
  }, [
    bodyStore,
    compositor,
    instanceCountUniform,
    placement,
    root,
    sceneLayers,
    screenCamera,
    store,
    worldCamera,
  ]);

  /** Advances the world toward the document. It runs before any pass. */
  const settle = useMemo(
    () =>
      root
        .with(instanceCount, instanceCountUniform)
        .with(clock, worldClock)
        .with(targets, targetStore)
        .with(bodies, bodyStore)
        .createComputePipeline({ compute: settleWorld }),
    [bodyStore, instanceCountUniform, root, targetStore, worldClock],
  );

  useFrame(({ deltaSeconds, elapsedSeconds }) => {
    const view = ctxRef.current;

    if (view === null) {
      return;
    }

    const state = store.state$.peek() as InfiniteCanvasState<Kind>;
    const windows = getInfiniteCanvasWindowProxies(state, chrome, devicePixelRatio);
    const columns = getWindowInstanceColumns(windows);

    worldCamera.write(getCameraValue(state, "world", devicePixelRatio));
    screenCamera.write(getCameraValue(state, "screen", devicePixelRatio));
    instanceCountUniform.write(columns.count);

    if (columns.count > 0) {
      common.writeSoA(targetStore.buffer, {
        rect: columns.rect,
        state: columns.state,
        tint: columns.tint,
      });
      // Cap the step so a hidden tab does not snap the world on return.
      worldClock.write({ dt: Math.min(deltaSeconds, MAX_STEP_SECONDS) });
      settle.dispatchWorkgroups(getWorldWorkgroups(columns.count));
    }

    const visibleWorldRect = getVisibleWorldRect(state.camera, state.viewport);
    const worldContext: InfiniteCanvasSceneLayerRenderContext<Kind, Payload> = {
      actions,
      camera: state.camera,
      chrome,
      devicePixelRatio,
      drop: dropInteraction as InfiniteCanvasSceneLayerRenderContext<Kind, Payload>["drop"],
      getState: () => store.state$.peek() as InfiniteCanvasState<Kind>,
      getWindowProxy: (windowId) => {
        const window = findWindow(state, windowId);

        return window === null || window.mode === "minimized"
          ? null
          : getInfiniteCanvasWindowProxy(state, window, chrome, devicePixelRatio);
      },
      resolveSpatialTarget: (viewportPoint) =>
        resolveInfiniteCanvasSpatialTarget({
          chrome,
          resolvers: spatialTargetResolvers,
          state,
          viewportPoint,
        }),
      space: "world",
      state,
      theme,
      visibleScreenRect: getInfiniteCanvasViewportScreenRect(state.viewport),
      visibleWindows: getVisibleInfiniteCanvasWindowProxies(windows, visibleWorldRect, "world"),
      visibleWorldRect,
      viewport: state.viewport,
      windows,
    };
    const timing = { deltaSeconds, elapsedSeconds, instanceCount: columns.count };
    const frames = {
      screen: { ...timing, context: { ...worldContext, space: "screen" as const } },
      world: { ...timing, context: worldContext },
    };
    // Only a draw gets the canvas, so compute and readback cannot paint.
    const target = createFrameTarget(view);
    const drawFrames = {
      screen: { ...frames.screen, target },
      world: { ...frames.world, target },
    };

    // Compute submits itself and lands before the draws that read it.
    built.forEach(({ pass, space }) => pass.compute?.(frames[space]));
    built.forEach(({ pass, space }) => pass.record?.(drawFrames[space]));
    built.forEach(({ pass, space }) => pass.readback?.(frames[space]));
  });

  return (
    <div style={{ inset: 0, pointerEvents: "none", position: "absolute", zIndex }}>
      <canvas
        ref={ref as Ref<HTMLCanvasElement>}
        style={{ display: "block", height: "100%", width: "100%" }}
      />
    </div>
  );
}

export { InfiniteCanvasCompositorSurface };
