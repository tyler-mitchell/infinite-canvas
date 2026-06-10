"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber/webgpu";
import { useCallback, useEffect, useLayoutEffect, useMemo } from "react";
import type * as THREE from "three";

import { getInfiniteCanvasContextualCommands } from "./commands";
import { DEFAULT_INFINITE_CANVAS_CHROME, DEFAULT_INFINITE_CANVAS_THEME } from "./constants";
import {
  InfiniteCanvasDiagnosticsWebGpuLayer,
  type InfiniteCanvasDiagnosticsPolicy,
} from "./diagnostics";
import { EMPTY_INFINITE_CANVAS_DROP } from "./drop-interaction";
import { getVisibleWorldRect } from "./geometry";
import {
  getInfiniteCanvasViewportScreenRect,
  getVisibleInfiniteCanvasWindowProxies,
} from "./scene-layer-geometry";
import { resolveInfiniteCanvasSpatialTarget } from "./spatial-target";
import { useInfiniteCanvasActions, useInfiniteCanvasState, useInfiniteCanvasStore } from "./store";
import { getInfiniteCanvasWindowProxies, getInfiniteCanvasWindowProxy } from "./window-proxy";
import type {
  InfiniteCanvasChromeMetrics,
  InfiniteCanvasDropInteraction,
  InfiniteCanvasDropPayload,
  InfiniteCanvasPoint,
  InfiniteCanvasSceneLayer,
  InfiniteCanvasSceneLayerFrameloop,
  InfiniteCanvasSceneLayerPlacement,
  InfiniteCanvasSceneLayerRenderContext,
  InfiniteCanvasSceneLayerSpace,
  InfiniteCanvasSpatialTargetResolver,
  InfiniteCanvasState,
  InfiniteCanvasTheme,
} from "./types";

const FRAME_CANVAS_RESIZE = {
  debounce: {
    resize: 0,
    scroll: 0,
  },
} as const;

const SCENE_UNDERLAY_Z_INDEX = 0;
const SCENE_CAMERA_Z = 10;
const SCENE_BOOT_INVALIDATION_DELAYS_MS = [0, 16, 80, 240, 600, 1200, 2000] as const;

function getSceneLayerPlacement<Kind extends string, Payload>(
  layer: InfiniteCanvasSceneLayer<Kind, Payload>,
) {
  return layer.placement ?? "underlay";
}

function getSceneLayerSpace<Kind extends string, Payload>(
  layer: InfiniteCanvasSceneLayer<Kind, Payload>,
) {
  return layer.space ?? "world";
}

function getSceneLayers<Kind extends string, Payload>(
  layers: readonly InfiniteCanvasSceneLayer<Kind, Payload>[],
  placement: InfiniteCanvasSceneLayerPlacement,
  space: InfiniteCanvasSceneLayerSpace,
) {
  return layers.filter(
    (layer) => getSceneLayerPlacement(layer) === placement && getSceneLayerSpace(layer) === space,
  );
}

function getSceneSurfaceFrameloop<Kind extends string, Payload>(
  sceneLayers: readonly InfiniteCanvasSceneLayer<Kind, Payload>[],
): InfiniteCanvasSceneLayerFrameloop {
  return sceneLayers.some((layer) => layer.frameloop === "always") ? "always" : "demand";
}

function getSceneCameraPosition<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  space: InfiniteCanvasSceneLayerSpace,
) {
  return (
    space === "screen"
      ? [state.viewport.width / 2, -state.viewport.height / 2, SCENE_CAMERA_Z]
      : [state.camera.center.x, -state.camera.center.y, SCENE_CAMERA_Z]
  ) satisfies [number, number, number];
}

function getSceneCameraProps<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  space: InfiniteCanvasSceneLayerSpace,
) {
  return {
    bottom: -state.viewport.height / 2,
    far: 1000,
    left: -state.viewport.width / 2,
    near: -1000,
    position: getSceneCameraPosition(state, space),
    right: state.viewport.width / 2,
    top: state.viewport.height / 2,
    zoom: space === "screen" ? 1 : state.camera.zoom,
  } satisfies {
    bottom: number;
    far: number;
    left: number;
    near: number;
    position: readonly [number, number, number];
    right: number;
    top: number;
    zoom: number;
  };
}

function InfiniteCanvasWebGpuSurface<Kind extends string, Payload = InfiniteCanvasDropPayload>({
  chrome = DEFAULT_INFINITE_CANVAS_CHROME,
  devicePixelRatio = 1,
  diagnostics,
  dropInteraction = EMPTY_INFINITE_CANVAS_DROP,
  sceneLayers = [],
  space = "world",
  spatialTargetResolvers = [],
  theme = DEFAULT_INFINITE_CANVAS_THEME,
  zIndex = SCENE_UNDERLAY_Z_INDEX,
}: Readonly<{
  chrome?: InfiniteCanvasChromeMetrics;
  devicePixelRatio?: number;
  diagnostics: InfiniteCanvasDiagnosticsPolicy;
  dropInteraction?: InfiniteCanvasDropInteraction<Payload, Kind>;
  sceneLayers?: readonly InfiniteCanvasSceneLayer<Kind, Payload>[];
  space?: InfiniteCanvasSceneLayerSpace;
  spatialTargetResolvers?: readonly InfiniteCanvasSpatialTargetResolver<Kind>[];
  theme?: InfiniteCanvasTheme;
  zIndex?: number;
}>) {
  const state = useInfiniteCanvasState<Kind>();
  const store = useInfiniteCanvasStore<Kind>();
  const actions = useInfiniteCanvasActions<Kind>();
  const getState = useCallback(() => store.state$.peek() as InfiniteCanvasState<Kind>, [store]);
  const getWindowProxy = useCallback(
    (windowId: string) => {
      const latestState = store.state$.peek() as InfiniteCanvasState<Kind>;
      const window = latestState.windows.find((candidate) => candidate.id === windowId);

      return window === undefined || window.mode === "minimized"
        ? null
        : getInfiniteCanvasWindowProxy(latestState, window, chrome, devicePixelRatio);
    },
    [chrome, devicePixelRatio, store],
  );
  const resolveSpatialTarget = useCallback(
    (viewportPoint: InfiniteCanvasPoint) =>
      resolveInfiniteCanvasSpatialTarget({
        chrome,
        resolvers: spatialTargetResolvers,
        state: store.state$.peek() as InfiniteCanvasState<Kind>,
        viewportPoint,
      }),
    [chrome, spatialTargetResolvers, store],
  );
  const windowProxies = useMemo(
    () => getInfiniteCanvasWindowProxies(state, chrome, devicePixelRatio),
    [
      chrome,
      devicePixelRatio,
      state.activeWindowId,
      state.camera,
      state.selection,
      state.viewport,
      state.windows,
    ],
  );
  const visibleWorldRect = useMemo(
    () => getVisibleWorldRect(state.camera, state.viewport),
    [state.camera, state.viewport],
  );
  const visibleScreenRect = useMemo(
    () => getInfiniteCanvasViewportScreenRect(state.viewport),
    [state.viewport],
  );
  const visibleRect = useMemo(
    () => (space === "screen" ? visibleScreenRect : visibleWorldRect),
    [space, visibleScreenRect, visibleWorldRect],
  );
  const visibleWindows = useMemo(
    () => getVisibleInfiniteCanvasWindowProxies(windowProxies, visibleRect, space),
    [space, visibleRect, windowProxies],
  );
  const contextualCommands = useMemo(() => getInfiniteCanvasContextualCommands(state), [state]);
  const cameraProps = useMemo(
    () => getSceneCameraProps(state, space),
    [space, state.camera, state.viewport],
  );
  const sceneLayerContext = useMemo(
    () =>
      ({
        actions,
        camera: state.camera,
        chrome,
        contextualCommands,
        devicePixelRatio,
        drop: dropInteraction,
        getState,
        getWindowProxy,
        getWindowSceneModel: getWindowProxy,
        resolveSpatialTarget,
        space,
        state,
        theme,
        visibleRect,
        visibleScreenRect,
        visibleWindows,
        visibleWorldRect,
        viewport: state.viewport,
        windows: windowProxies,
      }) satisfies InfiniteCanvasSceneLayerRenderContext<Kind, Payload>,
    [
      actions,
      chrome,
      contextualCommands,
      devicePixelRatio,
      dropInteraction,
      getState,
      getWindowProxy,
      resolveSpatialTarget,
      space,
      state,
      state.activeWindowId,
      state.camera,
      state.interaction,
      state.selection,
      state.snapPreview,
      state.viewport,
      state.windows,
      theme,
      visibleRect,
      visibleScreenRect,
      visibleWindows,
      visibleWorldRect,
      windowProxies,
    ],
  );

  return (
    <div
      style={{
        inset: 0,
        pointerEvents: "none",
        position: "absolute",
        zIndex,
      }}
    >
      <Canvas
        camera={cameraProps}
        dpr={[1, 2]}
        frameloop={getSceneSurfaceFrameloop(sceneLayers)}
        orthographic
        resize={FRAME_CANVAS_RESIZE}
        style={{
          background: "transparent",
          height: "100%",
          pointerEvents: "none",
          width: "100%",
        }}
      >
        <WebGpuGuard />
        <InfiniteCanvasSceneBootInvalidator />
        <InfiniteCanvasSceneStateInvalidator
          activeWindowId={state.activeWindowId}
          camera={state.camera}
          dropInteraction={dropInteraction}
          interaction={state.interaction}
          selection={state.selection}
          snapPreview={state.snapPreview}
          viewport={state.viewport}
          windows={state.windows}
        />
        <InfiniteCanvasCameraBridge space={space} />
        {sceneLayers.map((layer) => (
          <InfiniteCanvasSceneLayerHost context={sceneLayerContext} key={layer.id} layer={layer} />
        ))}
        <InfiniteCanvasDiagnosticsWebGpuLayer policy={diagnostics} />
      </Canvas>
    </div>
  );
}

function InfiniteCanvasSceneLayerHost<Kind extends string, Payload = InfiniteCanvasDropPayload>({
  context,
  layer,
}: Readonly<{
  context: InfiniteCanvasSceneLayerRenderContext<Kind, Payload>;
  layer: InfiniteCanvasSceneLayer<Kind, Payload>;
}>) {
  return layer.render(context);
}

function WebGpuGuard() {
  const webGPUSupported = useThree((state) => state.webGPUSupported);

  if (webGPUSupported === false) {
    throw new Error("InfiniteCanvas requires the @react-three/fiber WebGPU backend.");
  }

  return null;
}

function InfiniteCanvasSceneBootInvalidator() {
  const invalidate = useThree((threeState) => threeState.invalidate);
  // Re-arm the boot schedule when the renderer instance lands. Demand frames
  // requested while the WebGPU backend is still initializing asynchronously
  // are dropped, so a wall-clock-only schedule can finish before the renderer
  // can paint, leaving mounted scene-layer content invisible until the next
  // state-driven invalidation.
  const gl = useThree((threeState) => threeState.gl);

  useEffect(() => {
    const timeoutIds = SCENE_BOOT_INVALIDATION_DELAYS_MS.map((delay) =>
      window.setTimeout(invalidate, delay),
    );

    return () => {
      timeoutIds.forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
    };
  }, [gl, invalidate]);

  return null;
}

function InfiniteCanvasSceneStateInvalidator<Kind extends string>({
  activeWindowId,
  camera,
  dropInteraction,
  interaction,
  selection,
  snapPreview,
  viewport,
  windows,
}: Readonly<{
  activeWindowId: InfiniteCanvasState<Kind>["activeWindowId"];
  camera: InfiniteCanvasState<Kind>["camera"];
  dropInteraction: InfiniteCanvasDropInteraction;
  interaction: InfiniteCanvasState<Kind>["interaction"];
  selection: InfiniteCanvasState<Kind>["selection"];
  snapPreview: InfiniteCanvasState<Kind>["snapPreview"];
  viewport: InfiniteCanvasState<Kind>["viewport"];
  windows: InfiniteCanvasState<Kind>["windows"];
}>) {
  const invalidate = useThree((threeState) => threeState.invalidate);

  useLayoutEffect(() => {
    invalidate();
  }, [
    activeWindowId,
    camera,
    dropInteraction,
    interaction,
    invalidate,
    selection,
    snapPreview,
    viewport,
    windows,
  ]);

  return null;
}

function InfiniteCanvasCameraBridge({
  space,
}: Readonly<{
  space: InfiniteCanvasSceneLayerSpace;
}>) {
  const state = useInfiniteCanvasState();
  const store = useInfiniteCanvasStore();
  const camera = useThree((threeState) => threeState.camera);
  const invalidate = useThree((threeState) => threeState.invalidate);

  useFrame(() => {
    syncInfiniteCanvasSceneCamera(camera, store.state$.peek() as InfiniteCanvasState, space);
  });

  useLayoutEffect(() => {
    syncInfiniteCanvasSceneCamera(camera, state, space);
    invalidate();
  }, [camera, invalidate, space, state.camera, state.viewport]);

  return null;
}

function syncInfiniteCanvasSceneCamera(
  camera: THREE.Camera,
  state: InfiniteCanvasState,
  space: InfiniteCanvasSceneLayerSpace,
) {
  if (!isWritableOrthographicCamera(camera)) {
    return;
  }

  camera.left = -state.viewport.width / 2;
  camera.right = state.viewport.width / 2;
  camera.top = state.viewport.height / 2;
  camera.bottom = -state.viewport.height / 2;
  camera.near = -1000;
  camera.far = 1000;
  camera.zoom = space === "screen" ? 1 : state.camera.zoom;
  camera.position.set(...getSceneCameraPosition(state, space));
  camera.rotation.set(0, 0, 0);
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();
}

function isWritableOrthographicCamera(camera: unknown): camera is THREE.OrthographicCamera {
  return (
    typeof camera === "object" &&
    camera !== null &&
    "left" in camera &&
    "right" in camera &&
    "top" in camera &&
    "bottom" in camera
  );
}

export { InfiniteCanvasWebGpuSurface, SCENE_UNDERLAY_Z_INDEX, getSceneLayers };
