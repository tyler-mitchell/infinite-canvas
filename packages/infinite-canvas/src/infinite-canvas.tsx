"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber/webgpu";
import {
  Frame,
  LocateFixed,
  Maximize2,
  Minimize2,
  Minus,
  MousePointer2,
  Move,
  Pin,
  Plus,
  RotateCcw,
  ScanSearch,
  X,
} from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import * as THREE from "three";

import {
  DEFAULT_INFINITE_CANVAS_CHROME,
  DEFAULT_INFINITE_CANVAS_INPUT_POLICY,
  DEFAULT_INFINITE_CANVAS_STACK_BANDS,
  DEFAULT_INFINITE_CANVAS_THEME,
  resolveInfiniteCanvasZoomPolicy,
} from "./constants";
import {
  DEFAULT_INFINITE_CANVAS_DIAGNOSTICS,
  InfiniteCanvasDiagnosticsOverlay,
  InfiniteCanvasDiagnosticsProvider,
  InfiniteCanvasDiagnosticsWebGpuLayer,
  resolveInfiniteCanvasDiagnosticsPolicy,
  type InfiniteCanvasDiagnosticsPolicy,
  type InfiniteCanvasDiagnosticsPolicyInput,
} from "./diagnostics";
import {
  getAdaptiveGridSpacing,
  getConstrainedZoom,
  getRectFromPoints,
  getVisibleWorldRect,
  getWheelZoomFactor,
  projectWorldRectToScreen,
  snapScreenValueToDevicePixel,
  worldPointToScreenPoint,
} from "./geometry";
import {
  EMPTY_INFINITE_CANVAS_DROP,
  createInfiniteCanvasDropInteraction,
  isPointInsideInfiniteCanvasViewport,
} from "./drop-interaction";
import { getInteractionCursor } from "./interaction";
import {
  getInfiniteCanvasIdleCursor,
  getInfiniteCanvasInteractionCursor,
  getInfiniteCanvasPointerMode,
  withInfiniteCanvasPointerMode,
} from "./input-policy";
import { focusInfiniteCanvasCommandSurface, registerInfiniteCanvasHotkeys } from "./keyboard";
import { getInfiniteCanvasContextualCommands } from "./commands";
import type { InfiniteCanvasHotkeyBinding } from "./commands";
import {
  capturePointer,
  clearNativeTextSelection,
  getClientPoint,
  getElementViewport,
  getViewportPoint,
  isPrimaryButton,
  releasePointer,
} from "./runtime";
import { getInfiniteCanvasWindowProxies, getInfiniteCanvasWindowProxy } from "./window-proxy";
import {
  getInfiniteCanvasViewportScreenRect,
  getVisibleInfiniteCanvasWindowProxies,
} from "./scene-layer-geometry";
import { getSelectedWindowBounds, isWindowSelected } from "./selection";
import { getWindowStackValue } from "./stacking";
import {
  getInfiniteCanvasSelectableTargetFromSpatialTarget,
  resolveInfiniteCanvasSpatialTarget,
} from "./spatial-target";
import {
  assertInfiniteCanvasStateMatchesWindowRegistry,
  getUnknownInfiniteCanvasWindowKinds,
  isRegisteredInfiniteCanvasWindow,
  normalizeInfiniteCanvasStateForWindowRegistry,
  recoverInfiniteCanvasStateForWindowRegistry,
} from "./registry";
import {
  InfiniteCanvasProvider,
  useInfiniteCanvasActions,
  useInfiniteCanvasSelector,
  useInfiniteCanvasState,
  useInfiniteCanvasStore,
} from "./store";
import {
  InfiniteCanvasRasterHud,
  InfiniteCanvasRasterSchedulerGate,
  InfiniteCanvasRasterizationProvider,
  InfiniteCanvasWindowBody,
  resolveInfiniteCanvasRasterizationPolicy,
  type InfiniteCanvasRasterizationPolicyInput,
} from "./rasterization-layer";
import type {
  InfiniteCanvasChromeMetrics,
  InfiniteCanvasCommands,
  InfiniteCanvasDragStartInput,
  InfiniteCanvasDropPayload,
  InfiniteCanvasDropInteraction,
  InfiniteCanvasDropPolicy,
  InfiniteCanvasDropValidationInput,
  InfiniteCanvasInteraction,
  InfiniteCanvasInputPolicy,
  InfiniteCanvasMarqueeMode,
  InfiniteCanvasOverlayRenderContext,
  InfiniteCanvasPoint,
  InfiniteCanvasPointerMode,
  InfiniteCanvasResizeHandle,
  InfiniteCanvasSceneLayer,
  InfiniteCanvasSceneLayerFrameloop,
  InfiniteCanvasSceneLayerRenderContext,
  InfiniteCanvasSceneLayerPlacement,
  InfiniteCanvasSceneLayerSpace,
  InfiniteCanvasSelectionTarget,
  InfiniteCanvasSnapGuide,
  InfiniteCanvasSnapPolicy,
  InfiniteCanvasSpatialTarget,
  InfiniteCanvasSpatialTargetResolver,
  InfiniteCanvasStackBands,
  InfiniteCanvasState,
  InfiniteCanvasTheme,
  InfiniteCanvasWindow,
  InfiniteCanvasWindowBodyPointerBehavior,
  InfiniteCanvasWindowDefinition,
  InfiniteCanvasWindowFrameActiveCornersProps,
  InfiniteCanvasWindowFrameBodyProps,
  InfiniteCanvasWindowFrameControlsProps,
  InfiniteCanvasWindowFrameHeaderProps,
  InfiniteCanvasWindowFrameRenderContext,
  InfiniteCanvasWindowFrameSlots,
  InfiniteCanvasWindowFrameSurfaceProps,
  InfiniteCanvasWindowFrameTitleProps,
  InfiniteCanvasWindowRegistry,
  InfiniteCanvasWindowTextSelection,
  InfiniteCanvasZoomPolicy,
  InfiniteCanvasZoomPolicyInput,
} from "./types";

type InfiniteCanvasDesktopProps<
  Kind extends string,
  Payload = InfiniteCanvasDropPayload,
> = Readonly<{
  chrome?: InfiniteCanvasChromeMetrics;
  className?: string;
  diagnostics?: InfiniteCanvasDiagnosticsPolicyInput;
  documentKey?: string;
  dropPolicy?: InfiniteCanvasDropPolicy<Kind, Payload>;
  hotkeyBindings?: readonly InfiniteCanvasHotkeyBinding[];
  initialState: InfiniteCanvasState<Kind>;
  inputPolicy?: InfiniteCanvasInputPolicy;
  rasterization?: InfiniteCanvasRasterizationPolicyInput | boolean;
  renderOverlay?: (context: InfiniteCanvasOverlayRenderContext<Kind, Payload>) => ReactNode;
  sceneLayers?: readonly InfiniteCanvasSceneLayer<Kind, Payload>[];
  snapPolicy?: InfiniteCanvasSnapPolicy;
  spatialTargetResolvers?: readonly InfiniteCanvasSpatialTargetResolver<Kind>[];
  storageKey?: string;
  subtitle?: string;
  theme?: InfiniteCanvasTheme;
  title?: string;
  windowDefinitions: InfiniteCanvasWindowRegistry<Kind>;
  zoomPolicy?: InfiniteCanvasZoomPolicyInput;
}>;

type InfiniteCanvasViewportProps<
  Kind extends string,
  Payload = InfiniteCanvasDropPayload,
> = Readonly<{
  chrome: InfiniteCanvasChromeMetrics;
  className?: string;
  diagnostics: InfiniteCanvasDiagnosticsPolicy;
  dropPolicy?: InfiniteCanvasDropPolicy<Kind, Payload>;
  hotkeyBindings?: readonly InfiniteCanvasHotkeyBinding[];
  inputPolicy: InfiniteCanvasInputPolicy;
  renderOverlay?: (context: InfiniteCanvasOverlayRenderContext<Kind, Payload>) => ReactNode;
  sceneLayers: readonly InfiniteCanvasSceneLayer<Kind, Payload>[];
  subtitle: string;
  spatialTargetResolvers: readonly InfiniteCanvasSpatialTargetResolver<Kind>[];
  theme: InfiniteCanvasTheme;
  title: string;
  windowDefinitions: InfiniteCanvasWindowRegistry<Kind>;
  zoomPolicy: InfiniteCanvasZoomPolicy;
}>;

const FRAME_CANVAS_RESIZE = {
  debounce: {
    resize: 0,
    scroll: 0,
  },
} as const;

const SCENE_UNDERLAY_Z_INDEX = 0;
const SCENE_SCREEN_UNDERLAY_Z_INDEX = 1;
const WINDOW_LAYER_Z_INDEX = 10;
const SCENE_OVERLAY_Z_INDEX = DEFAULT_INFINITE_CANVAS_STACK_BANDS.overlay - 10;
const SCENE_SCREEN_OVERLAY_Z_INDEX = DEFAULT_INFINITE_CANVAS_STACK_BANDS.overlay - 9;
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

function getBrowserDevicePixelRatio() {
  return Math.max(window.devicePixelRatio || 1, 1);
}

function resolveInfiniteCanvasDragDropTarget<Kind extends string, Payload>({
  chrome,
  dropPolicy,
  payload,
  resolvers,
  state,
  viewportPoint,
}: Readonly<{
  chrome: InfiniteCanvasChromeMetrics;
  dropPolicy?: InfiniteCanvasDropPolicy<Kind, Payload>;
  payload: Payload;
  resolvers: readonly InfiniteCanvasSpatialTargetResolver<Kind>[];
  state: InfiniteCanvasState<Kind>;
  viewportPoint: InfiniteCanvasPoint;
}>): Readonly<{
  target: InfiniteCanvasSpatialTarget<Kind> | null;
  validation: InfiniteCanvasDropValidationInput;
}> {
  if (!isPointInsideInfiniteCanvasViewport(state.viewport, viewportPoint)) {
    return {
      target: null,
      validation: true,
    };
  }

  const target = resolveInfiniteCanvasSpatialTarget({
    chrome,
    resolvers,
    state,
    viewportPoint,
  });

  return {
    target,
    validation:
      dropPolicy?.canDrop?.({
        payload,
        state,
        target,
        viewportPoint,
        worldPoint: target.worldPoint,
      }) ?? true,
  };
}

function useInfiniteCanvasDevicePixelRatio() {
  const [devicePixelRatio, setDevicePixelRatio] = useState(1);

  useEffect(() => {
    const updateDevicePixelRatio = () => {
      setDevicePixelRatio(getBrowserDevicePixelRatio());
    };

    updateDevicePixelRatio();
    window.addEventListener("resize", updateDevicePixelRatio);

    return () => {
      window.removeEventListener("resize", updateDevicePixelRatio);
    };
  }, []);

  return devicePixelRatio;
}

function InfiniteCanvasDesktop<Kind extends string, Payload = InfiniteCanvasDropPayload>({
  chrome = DEFAULT_INFINITE_CANVAS_CHROME,
  className,
  diagnostics,
  documentKey,
  dropPolicy,
  hotkeyBindings,
  initialState,
  inputPolicy = DEFAULT_INFINITE_CANVAS_INPUT_POLICY,
  rasterization,
  renderOverlay,
  sceneLayers = [],
  snapPolicy,
  spatialTargetResolvers = [],
  storageKey,
  subtitle = "Composable WebGPU surface, DOM body seam, pure window model.",
  theme = DEFAULT_INFINITE_CANVAS_THEME,
  title = "Infinite Canvas Framework",
  windowDefinitions,
  zoomPolicy,
}: InfiniteCanvasDesktopProps<Kind, Payload>) {
  const resolvedZoomPolicy = useMemo(
    () => resolveInfiniteCanvasZoomPolicy(zoomPolicy),
    [zoomPolicy],
  );
  const resolvedRasterizationPolicy = useMemo(
    () => resolveInfiniteCanvasRasterizationPolicy(rasterization),
    [rasterization],
  );
  const resolvedDiagnosticsPolicy = useMemo(
    () => resolveInfiniteCanvasDiagnosticsPolicy(diagnostics),
    [diagnostics],
  );
  const validatedInitialState = useMemo(
    () => assertInfiniteCanvasStateMatchesWindowRegistry(initialState, windowDefinitions),
    [initialState, windowDefinitions],
  );
  const validateStateForRegistry = useMemo(
    () => (state: InfiniteCanvasState<Kind>) =>
      normalizeInfiniteCanvasStateForWindowRegistry(state, windowDefinitions),
    [windowDefinitions],
  );

  return (
    <InfiniteCanvasProvider
      documentKey={documentKey}
      initialState={validatedInitialState}
      key={documentKey}
      snapPolicy={snapPolicy}
      stateValidator={validateStateForRegistry}
      storageKey={storageKey}
      zoomPolicy={resolvedZoomPolicy}
    >
      <InfiniteCanvasDiagnosticsProvider policy={resolvedDiagnosticsPolicy}>
        <InfiniteCanvasRasterizationProvider policy={resolvedRasterizationPolicy}>
          <InfiniteCanvasViewport
            chrome={chrome}
            className={className}
            diagnostics={resolvedDiagnosticsPolicy}
            dropPolicy={dropPolicy}
            hotkeyBindings={hotkeyBindings}
            inputPolicy={inputPolicy}
            renderOverlay={renderOverlay}
            sceneLayers={sceneLayers}
            subtitle={subtitle}
            spatialTargetResolvers={spatialTargetResolvers}
            theme={theme}
            title={title}
            windowDefinitions={windowDefinitions}
            zoomPolicy={resolvedZoomPolicy}
          />
        </InfiniteCanvasRasterizationProvider>
      </InfiniteCanvasDiagnosticsProvider>
    </InfiniteCanvasProvider>
  );
}

function InfiniteCanvasViewport<Kind extends string, Payload = InfiniteCanvasDropPayload>({
  chrome,
  className,
  diagnostics,
  dropPolicy,
  hotkeyBindings,
  inputPolicy,
  renderOverlay,
  sceneLayers,
  subtitle,
  spatialTargetResolvers,
  theme,
  title,
  windowDefinitions,
  zoomPolicy,
}: InfiniteCanvasViewportProps<Kind, Payload>) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const commandSurfaceRef = useRef<HTMLDivElement | null>(null);
  const spacePanRef = useRef(false);
  const dragCaptureTargetRef = useRef<HTMLElement | null>(null);
  const configuredPointerMode = getInfiniteCanvasPointerMode(inputPolicy);
  const [pointerModeOverride, setPointerModeOverride] = useState<InfiniteCanvasPointerMode | null>(
    null,
  );
  const [dropInteraction, setDropInteraction] = useState<
    InfiniteCanvasDropInteraction<Payload, Kind>
  >(EMPTY_INFINITE_CANVAS_DROP);
  const dropInteractionRef = useRef<InfiniteCanvasDropInteraction<Payload, Kind>>(dropInteraction);
  const store = useInfiniteCanvasStore<Kind>();
  const actions = useInfiniteCanvasActions<Kind>();
  const state = useInfiniteCanvasState<Kind>();
  const interaction = useInfiniteCanvasSelector<Kind, InfiniteCanvasInteraction>(
    (state) => state.interaction,
  );
  const pointerMode = pointerModeOverride ?? configuredPointerMode;
  const getState = () => store.state$.peek() as InfiniteCanvasState<Kind>;
  const activeInputPolicy = useMemo(
    () =>
      pointerModeOverride === null
        ? inputPolicy
        : withInfiniteCanvasPointerMode(inputPolicy, pointerModeOverride),
    [inputPolicy, pointerModeOverride],
  );
  const cursor = getCanvasCursor(interaction, pointerMode, activeInputPolicy);
  const devicePixelRatio = useInfiniteCanvasDevicePixelRatio();
  const underlayWorldSceneLayers = useMemo(
    () => getSceneLayers(sceneLayers, "underlay", "world"),
    [sceneLayers],
  );
  const underlayScreenSceneLayers = useMemo(
    () => getSceneLayers(sceneLayers, "underlay", "screen"),
    [sceneLayers],
  );
  const overlayWorldSceneLayers = useMemo(
    () => getSceneLayers(sceneLayers, "overlay", "world"),
    [sceneLayers],
  );
  const overlayScreenSceneLayers = useMemo(
    () => getSceneLayers(sceneLayers, "overlay", "screen"),
    [sceneLayers],
  );
  const releaseDropPointerCapture = useCallback((pointerId: number) => {
    const target = dragCaptureTargetRef.current;

    if (target !== null) {
      releasePointer(target, pointerId);
    }

    dragCaptureTargetRef.current = null;
  }, []);
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
  const contextualCommands = useMemo(() => getInfiniteCanvasContextualCommands(state), [state]);
  const createDropInteractionFromPointer = useCallback(
    (
      current: Extract<InfiniteCanvasDropInteraction<Payload, Kind>, { status: "dragging" }>,
      event: Pick<PointerEvent, "clientX" | "clientY">,
    ) => {
      const node = rootRef.current;
      const latestState = store.state$.peek() as InfiniteCanvasState<Kind>;
      const clientPoint = getClientPoint(event);
      const viewportPoint =
        node === null ? current.viewportPoint : getViewportPoint(node, clientPoint);
      const dropTarget = resolveInfiniteCanvasDragDropTarget({
        chrome,
        dropPolicy,
        payload: current.payload,
        resolvers: spatialTargetResolvers,
        state: latestState,
        viewportPoint,
      });

      return node === null
        ? current
        : createInfiniteCanvasDropInteraction<Payload, Kind>({
            camera: latestState.camera,
            clientPoint,
            id: current.id,
            originClientPoint: current.originClientPoint,
            payload: current.payload,
            pointerId: current.pointerId,
            target: dropTarget.target,
            validation: dropTarget.validation,
            viewport: latestState.viewport,
            viewportPoint,
          });
    },
    [chrome, dropPolicy, spatialTargetResolvers, store],
  );
  const cancelDropDrag = useCallback(() => {
    const current = dropInteractionRef.current;

    if (current.status === "dragging") {
      releaseDropPointerCapture(current.pointerId);
    }

    dropInteractionRef.current = EMPTY_INFINITE_CANVAS_DROP;
    setDropInteraction(EMPTY_INFINITE_CANVAS_DROP);
  }, [releaseDropPointerCapture]);
  const startDropDrag = useCallback(
    ({ event, id, payload }: InfiniteCanvasDragStartInput<Payload>) => {
      const node = rootRef.current;

      if (node === null || !isPrimaryButton(event)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      clearNativeTextSelection();
      focusInfiniteCanvasCommandSurface(commandSurfaceRef.current);
      capturePointer(event.currentTarget, event.pointerId);
      dragCaptureTargetRef.current = event.currentTarget;

      const latestState = store.state$.peek() as InfiniteCanvasState<Kind>;
      const clientPoint = getClientPoint(event);
      const viewportPoint = getViewportPoint(node, clientPoint);
      const dropTarget = resolveInfiniteCanvasDragDropTarget({
        chrome,
        dropPolicy,
        payload,
        resolvers: spatialTargetResolvers,
        state: latestState,
        viewportPoint,
      });
      const nextDropInteraction = createInfiniteCanvasDropInteraction<Payload, Kind>({
        camera: latestState.camera,
        clientPoint,
        id,
        originClientPoint: clientPoint,
        payload,
        pointerId: event.pointerId,
        target: dropTarget.target,
        validation: dropTarget.validation,
        viewport: latestState.viewport,
        viewportPoint,
      });

      dropInteractionRef.current = nextDropInteraction;
      setDropInteraction(nextDropInteraction);
    },
    [chrome, dropPolicy, spatialTargetResolvers, store],
  );
  const overlayContext = useMemo(
    () =>
      ({
        actions,
        cancelDrag: cancelDropDrag,
        contextualCommands,
        drag: dropInteraction,
        resolveSpatialTarget,
        startDrag: startDropDrag,
        state,
      }) satisfies InfiniteCanvasOverlayRenderContext<Kind, Payload>,
    [
      actions,
      cancelDropDrag,
      contextualCommands,
      dropInteraction,
      resolveSpatialTarget,
      startDropDrag,
      state,
    ],
  );

  useEffect(() => {
    dropInteractionRef.current = dropInteraction;
  }, [dropInteraction]);

  useEffect(() => {
    setPointerModeOverride(null);
  }, [inputPolicy.emptyCanvasDrag]);

  useEffect(() => {
    const state = store.state$.peek() as InfiniteCanvasState<string>;

    if (getUnknownInfiniteCanvasWindowKinds(state, windowDefinitions).length === 0) {
      return;
    }

    actions.hydrate(recoverInfiniteCanvasStateForWindowRegistry(state, windowDefinitions));
  }, [actions, store, windowDefinitions]);

  useEffect(() => {
    const node = rootRef.current;

    if (node === null) {
      return;
    }

    const updateViewport = () => {
      actions.setViewport(getElementViewport(node));
    };
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(updateViewport);

    updateViewport();
    observer?.observe(node);

    return () => {
      observer?.disconnect();
    };
  }, [actions]);

  useEffect(() => {
    const node = commandSurfaceRef.current;

    return node === null
      ? undefined
      : registerInfiniteCanvasHotkeys({
          executeCommand: actions.executeCommand,
          getState: () => store.state$.peek() as InfiniteCanvasState<Kind>,
          bindings: hotkeyBindings,
          target: node,
        });
  }, [actions, hotkeyBindings, store]);

  useEffect(() => {
    const node = rootRef.current;

    if (node === null) {
      return;
    }

    const handleWheel = (event: WheelEvent) => {
      const state = store.state$.peek() as InfiniteCanvasState<Kind>;
      const isZoomGesture = event.ctrlKey || event.metaKey;
      const isCanvasTarget = isCanvasWheelTarget(event.target, node);

      if (
        state.viewport.width <= 0 ||
        state.viewport.height <= 0 ||
        (!isZoomGesture && !isCanvasTarget) ||
        (isZoomGesture && !isViewportEventTarget(event.target, node))
      ) {
        return;
      }

      event.preventDefault();

      if (!isZoomGesture) {
        actions.panBy({
          delta: getWheelScreenDelta(event, state.viewport),
        });

        return;
      }

      actions.zoomAt({
        anchor: getViewportPoint(node, getClientPoint(event)),
        zoom:
          state.camera.zoom *
          getWheelZoomFactor(getWheelScreenDelta(event, state.viewport).y, zoomPolicy),
      });
    };

    node.addEventListener("wheel", handleWheel, {
      capture: true,
      passive: false,
    });

    return () => {
      node.removeEventListener("wheel", handleWheel, {
        capture: true,
      });
    };
  }, [actions, store, zoomPolicy]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isSpacePanKeyEvent(event, commandSurfaceRef.current)) {
        return;
      }

      event.preventDefault();
      spacePanRef.current = true;
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space" || event.key === " ") {
        spacePanRef.current = false;
      }
    };
    const handleBlur = () => {
      spacePanRef.current = false;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);

  useEffect(() => {
    const node = rootRef.current;

    if (node === null || interaction === null) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerId !== interaction.pointerId) {
        return;
      }

      actions.stepInteraction({
        pointerId: event.pointerId,
        point: getViewportPoint(node, getClientPoint(event)),
      });
    };
    const finishInteraction = (pointerId: number) => {
      releasePointer(node, pointerId);
      actions.finishInteraction(pointerId);
    };
    const handlePointerUp = (event: PointerEvent) => {
      if (event.pointerId === interaction.pointerId) {
        finishInteraction(event.pointerId);
      }
    };
    const handleBlur = () => {
      finishInteraction(interaction.pointerId);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, [actions, interaction]);

  useEffect(() => {
    if (dropInteraction.status !== "dragging") {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const current = dropInteractionRef.current;

      if (current.status !== "dragging" || event.pointerId !== current.pointerId) {
        return;
      }

      setDropInteraction(createDropInteractionFromPointer(current, event));
    };
    const finishDropDrag = (event: PointerEvent) => {
      const current = dropInteractionRef.current;

      if (current.status !== "dragging" || event.pointerId !== current.pointerId) {
        return;
      }

      const finalDropInteraction = createDropInteractionFromPointer(current, event);

      if (
        finalDropInteraction.status === "dragging" &&
        finalDropInteraction.dropTarget.status === "valid"
      ) {
        const latestState = store.state$.peek() as InfiniteCanvasState<Kind>;

        dropPolicy?.onDrop?.({
          actions,
          dropTarget: finalDropInteraction.dropTarget,
          payload: finalDropInteraction.payload,
          state: latestState,
          target: finalDropInteraction.dropTarget.target,
          viewportPoint: finalDropInteraction.viewportPoint,
          worldPoint: finalDropInteraction.worldPoint,
        });
      }

      releaseDropPointerCapture(event.pointerId);
      dropInteractionRef.current = EMPTY_INFINITE_CANVAS_DROP;
      setDropInteraction(EMPTY_INFINITE_CANVAS_DROP);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        cancelDropDrag();
      }
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", finishDropDrag);
    window.addEventListener("pointercancel", cancelDropDrag);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("blur", cancelDropDrag);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", finishDropDrag);
      window.removeEventListener("pointercancel", cancelDropDrag);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("blur", cancelDropDrag);
    };
  }, [
    actions,
    cancelDropDrag,
    chrome,
    createDropInteractionFromPointer,
    dropInteraction.status,
    dropPolicy,
    releaseDropPointerCapture,
    store,
  ]);

  return (
    <section
      aria-label={title}
      className={[
        "relative flex h-full min-h-0 min-w-0 w-full flex-1 overflow-hidden bg-[#050607] text-white shadow-[0_36px_120px_-64px_rgba(0,0,0,0.92)]",
        "outline-none focus:outline-none focus-visible:outline-none",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      data-infinite-canvas-viewport="true"
      onLostPointerCapture={(event) => {
        actions.finishInteraction(event.pointerId);
      }}
      onPointerCancel={(event) => {
        actions.finishInteraction(event.pointerId);
      }}
      onPointerDown={(event) => {
        if (!isCanvasPointerGesture(event)) {
          return;
        }

        const point = getViewportPoint(event.currentTarget, getClientPoint(event));

        if (!isCanvasPanGesture(event, spacePanRef.current)) {
          const selectableTarget = getInfiniteCanvasSelectableTargetFromSpatialTarget(
            resolveSpatialTarget(point),
          );

          if (selectableTarget !== null) {
            event.preventDefault();
            event.stopPropagation();
            clearNativeTextSelection();
            focusInfiniteCanvasCommandSurface(commandSurfaceRef.current);
            applyModifiedPointerTargetSelection(actions, event, selectableTarget);

            return;
          }
        }

        const selectionExists = getState().selection.windowIds.length > 0;
        const emptyCanvasDragIntent = getEmptyCanvasDragIntent(
          activeInputPolicy,
          event,
          spacePanRef.current,
          selectionExists,
        );

        if (!isCanvasPanTarget(event.target, event.currentTarget, emptyCanvasDragIntent)) {
          return;
        }

        event.preventDefault();
        clearNativeTextSelection();
        focusInfiniteCanvasCommandSurface(commandSurfaceRef.current);
        capturePointer(event.currentTarget, event.pointerId);

        if (emptyCanvasDragIntent === "pan") {
          actions.startPan({
            clearSelection: shouldClearSelectionOnPanStart(event, spacePanRef.current),
            pointerId: event.pointerId,
            point,
          });
        } else {
          actions.startMarquee({
            mode: getMarqueeMode(event),
            pointerId: event.pointerId,
            point,
          });
        }
      }}
      onPointerMove={(event) => {
        actions.stepInteraction({
          pointerId: event.pointerId,
          point: getViewportPoint(event.currentTarget, getClientPoint(event)),
        });
      }}
      onPointerUp={(event) => {
        releasePointer(event.currentTarget, event.pointerId);
        actions.finishInteraction(event.pointerId);
      }}
      ref={rootRef}
      style={{
        cursor,
        touchAction: "none",
        userSelect: interaction === null ? undefined : "none",
      }}
    >
      <div
        className="pointer-events-none absolute h-px w-px opacity-0 outline-none"
        data-infinite-canvas-command-scope="surface"
        ref={commandSurfaceRef}
        tabIndex={-1}
      />
      <InfiniteCanvasGridBackdrop theme={theme} />
      <InfiniteCanvasWebGpuSurface
        chrome={chrome}
        devicePixelRatio={devicePixelRatio}
        diagnostics={diagnostics}
        dropInteraction={dropInteraction}
        sceneLayers={underlayWorldSceneLayers}
        space="world"
        spatialTargetResolvers={spatialTargetResolvers}
        theme={theme}
        zIndex={SCENE_UNDERLAY_Z_INDEX}
      />
      {underlayScreenSceneLayers.length === 0 ? null : (
        <InfiniteCanvasWebGpuSurface
          chrome={chrome}
          devicePixelRatio={devicePixelRatio}
          diagnostics={DEFAULT_INFINITE_CANVAS_DIAGNOSTICS}
          dropInteraction={dropInteraction}
          sceneLayers={underlayScreenSceneLayers}
          space="screen"
          spatialTargetResolvers={spatialTargetResolvers}
          theme={theme}
          zIndex={SCENE_SCREEN_UNDERLAY_Z_INDEX}
        />
      )}
      <InfiniteCanvasWindowLayer
        chrome={chrome}
        devicePixelRatio={devicePixelRatio}
        stackBands={DEFAULT_INFINITE_CANVAS_STACK_BANDS}
        theme={theme}
        windowDefinitions={windowDefinitions}
        zIndex={WINDOW_LAYER_Z_INDEX}
      />
      {overlayWorldSceneLayers.length === 0 ? null : (
        <InfiniteCanvasWebGpuSurface
          chrome={chrome}
          devicePixelRatio={devicePixelRatio}
          diagnostics={DEFAULT_INFINITE_CANVAS_DIAGNOSTICS}
          dropInteraction={dropInteraction}
          sceneLayers={overlayWorldSceneLayers}
          space="world"
          spatialTargetResolvers={spatialTargetResolvers}
          theme={theme}
          zIndex={SCENE_OVERLAY_Z_INDEX}
        />
      )}
      {overlayScreenSceneLayers.length === 0 ? null : (
        <InfiniteCanvasWebGpuSurface
          chrome={chrome}
          devicePixelRatio={devicePixelRatio}
          diagnostics={DEFAULT_INFINITE_CANVAS_DIAGNOSTICS}
          dropInteraction={dropInteraction}
          sceneLayers={overlayScreenSceneLayers}
          space="screen"
          spatialTargetResolvers={spatialTargetResolvers}
          theme={theme}
          zIndex={SCENE_SCREEN_OVERLAY_Z_INDEX}
        />
      )}
      <InfiniteCanvasSelectionBoundsOverlay devicePixelRatio={devicePixelRatio} theme={theme} />
      <InfiniteCanvasSnapOverlay devicePixelRatio={devicePixelRatio} />
      <InfiniteCanvasMarqueeOverlay />
      {renderOverlay?.(overlayContext)}
      <InfiniteCanvasHud
        onPointerModeChange={setPointerModeOverride}
        pointerMode={pointerMode}
        subtitle={subtitle}
        title={title}
        zoomPolicy={zoomPolicy}
      />
      <InfiniteCanvasRasterSchedulerGate paused={interaction !== null} />
      <InfiniteCanvasDiagnosticsOverlay policy={diagnostics} />
      <InfiniteCanvasRasterHud />
    </section>
  );
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
    <div className="pointer-events-none absolute inset-0" style={{ zIndex }}>
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

  useEffect(() => {
    const timeoutIds = SCENE_BOOT_INVALIDATION_DELAYS_MS.map((delay) =>
      window.setTimeout(invalidate, delay),
    );

    return () => {
      timeoutIds.forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
    };
  }, [invalidate]);

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

function InfiniteCanvasGridBackdrop({
  theme,
}: Readonly<{
  theme: InfiniteCanvasTheme;
}>) {
  const state = useInfiniteCanvasState();
  const gridStyle = useMemo(() => {
    if (state.viewport.width <= 0 || state.viewport.height <= 0) {
      return {
        background: theme.background,
      } satisfies CSSProperties;
    }

    const minorSpacing = getAdaptiveGridSpacing(state.camera.zoom) * state.camera.zoom;
    const majorSpacing = minorSpacing * 4;
    const origin = worldPointToScreenPoint(state.camera, state.viewport, {
      x: 0,
      y: 0,
    });

    return {
      backgroundColor: theme.background,
      backgroundImage: [
        `linear-gradient(to right, ${theme.gridMajor} 1px, transparent 1px)`,
        `linear-gradient(to bottom, ${theme.gridMajor} 1px, transparent 1px)`,
        `linear-gradient(to right, ${theme.gridMinor} 1px, transparent 1px)`,
        `linear-gradient(to bottom, ${theme.gridMinor} 1px, transparent 1px)`,
      ].join(","),
      backgroundPosition: [
        `${origin.x}px ${origin.y}px`,
        `${origin.x}px ${origin.y}px`,
        `${origin.x}px ${origin.y}px`,
        `${origin.x}px ${origin.y}px`,
      ].join(","),
      backgroundSize: [
        `${majorSpacing}px ${majorSpacing}px`,
        `${majorSpacing}px ${majorSpacing}px`,
        `${minorSpacing}px ${minorSpacing}px`,
        `${minorSpacing}px ${minorSpacing}px`,
      ].join(","),
    } satisfies CSSProperties;
  }, [state.camera, state.viewport, theme]);

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={gridStyle} />
  );
}

function InfiniteCanvasWindowLayer<Kind extends string>({
  chrome,
  devicePixelRatio,
  stackBands,
  theme,
  windowDefinitions,
  zIndex = WINDOW_LAYER_Z_INDEX,
}: Readonly<{
  chrome: InfiniteCanvasChromeMetrics;
  devicePixelRatio: number;
  stackBands: InfiniteCanvasStackBands;
  theme: InfiniteCanvasTheme;
  windowDefinitions: InfiniteCanvasWindowRegistry<Kind>;
  zIndex?: number;
}>) {
  const state = useInfiniteCanvasState<Kind>();
  // Keep DOM order stable during focus changes; z-index owns visual stacking.
  const visibleWindows = useMemo(
    () =>
      state.windows.filter(
        (window): window is InfiniteCanvasWindow<Kind> =>
          window.mode !== "minimized" &&
          isRegisteredInfiniteCanvasWindow(windowDefinitions, window),
      ),
    [state.windows, windowDefinitions],
  );

  return (
    <div className="pointer-events-none absolute inset-0" style={{ zIndex }}>
      {visibleWindows.map((window) => (
        <InfiniteCanvasWindowFrame
          chrome={chrome}
          devicePixelRatio={devicePixelRatio}
          isActive={state.activeWindowId === window.id}
          isSelected={isWindowSelected(state, window.id)}
          key={window.id}
          stackBands={stackBands}
          state={state}
          theme={theme}
          window={window}
          windowDefinitions={windowDefinitions}
        />
      ))}
    </div>
  );
}

type InfiniteCanvasWindowFrameRuntimeContextValue<Kind extends string> = Readonly<{
  actions: InfiniteCanvasCommands<Kind>;
  bodyPointerBehavior: InfiniteCanvasWindowBodyPointerBehavior;
  chrome: InfiniteCanvasChromeMetrics;
  definition: InfiniteCanvasWindowDefinition<Kind>;
  isActive: boolean;
  isSelected: boolean;
  state: InfiniteCanvasState<Kind>;
  textSelection: InfiniteCanvasWindowTextSelection;
  theme: InfiniteCanvasTheme;
  window: InfiniteCanvasWindow<Kind>;
}>;

const InfiniteCanvasWindowFrameRuntimeContext = createContext<unknown>(null);

const DEFAULT_INFINITE_CANVAS_WINDOW_FRAME_SLOTS = {
  ActiveCorners: InfiniteCanvasWindowFrameActiveCornersSlot,
  Body: InfiniteCanvasWindowFrameBodySlot,
  Controls: InfiniteCanvasWindowFrameControlsSlot,
  Header: InfiniteCanvasWindowFrameHeaderSlot,
  Surface: InfiniteCanvasWindowFrameSurfaceSlot,
  Title: InfiniteCanvasWindowFrameTitleSlot,
} satisfies InfiniteCanvasWindowFrameSlots;

function useInfiniteCanvasWindowFrameRuntimeContext<Kind extends string = string>() {
  const context = useContext(InfiniteCanvasWindowFrameRuntimeContext);

  if (context === null) {
    throw new Error("Infinite canvas frame slots must render inside a window frame.");
  }

  return context as InfiniteCanvasWindowFrameRuntimeContextValue<Kind>;
}

function InfiniteCanvasWindowFrameTitleSlot({
  children,
  className,
  style,
}: InfiniteCanvasWindowFrameTitleProps) {
  const { window } = useInfiniteCanvasWindowFrameRuntimeContext();

  return (
    <div
      className={mergeClassNames(
        "min-w-0 truncate text-[10px] font-medium uppercase text-white/58",
        className,
      )}
      style={style}
    >
      {children === undefined ? window.title : children}
    </div>
  );
}

function InfiniteCanvasWindowFrameControlsSlot({
  className,
  style,
}: InfiniteCanvasWindowFrameControlsProps) {
  const { actions, window } = useInfiniteCanvasWindowFrameRuntimeContext();

  return (
    <div className={mergeClassNames("flex shrink-0 items-center gap-1", className)} style={style}>
      <button
        aria-label={window.isPinned ? "Unpin window" : "Pin window"}
        className="flex h-6 w-6 items-center justify-center border border-white/8 bg-white/[0.03] text-white/46 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
        onClick={(event) => {
          event.stopPropagation();
          actions.togglePinned(window.id);
        }}
        onPointerDown={(event) => {
          event.stopPropagation();
        }}
        style={{
          cursor: "pointer",
        }}
        type="button"
      >
        <Pin
          className={window.isPinned ? "rotate-45 text-[#b7f4ff]" : "rotate-45"}
          size={12}
          strokeWidth={1.8}
        />
      </button>
      <button
        aria-label="Minimize window"
        className="flex h-6 w-6 items-center justify-center border border-white/8 bg-white/[0.03] text-white/46 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
        onClick={(event) => {
          event.stopPropagation();
          actions.minimizeWindow(window.id);
        }}
        onPointerDown={(event) => {
          event.stopPropagation();
        }}
        style={{
          cursor: "pointer",
        }}
        type="button"
      >
        <Minimize2 size={12} strokeWidth={1.8} />
      </button>
      <button
        aria-label={window.mode === "maximized" ? "Restore window" : "Maximize window"}
        className="flex h-6 w-6 items-center justify-center border border-white/8 bg-white/[0.03] text-white/46 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
        onClick={(event) => {
          event.stopPropagation();
          if (window.mode === "maximized") {
            actions.restoreWindow(window.id);
          } else {
            actions.maximizeWindow(window.id);
          }
        }}
        onPointerDown={(event) => {
          event.stopPropagation();
        }}
        style={{
          cursor: "pointer",
        }}
        type="button"
      >
        <Maximize2 size={12} strokeWidth={1.8} />
      </button>
      <button
        aria-label="Close window"
        className="flex h-6 w-6 items-center justify-center border border-white/8 bg-white/[0.03] text-white/46 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
        onClick={(event) => {
          event.stopPropagation();
          actions.closeWindow(window.id);
        }}
        onPointerDown={(event) => {
          event.stopPropagation();
        }}
        style={{
          cursor: "pointer",
        }}
        type="button"
      >
        <X size={12} strokeWidth={1.8} />
      </button>
    </div>
  );
}

function InfiniteCanvasWindowFrameHeaderSlot({
  children,
  className,
  style,
}: InfiniteCanvasWindowFrameHeaderProps) {
  const { actions, chrome, isActive, theme, window } = useInfiniteCanvasWindowFrameRuntimeContext();

  return (
    <header
      className={mergeClassNames(
        "absolute left-0 right-0 top-0 flex items-center justify-between gap-3 px-3",
        className,
      )}
      data-infinite-canvas-control="true"
      onLostPointerCapture={(event) => {
        actions.finishInteraction(event.pointerId);
      }}
      onPointerCancel={(event) => {
        actions.finishInteraction(event.pointerId);
      }}
      onPointerDown={(event) => {
        if (!isPrimaryButton(event)) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        clearNativeTextSelection();
        focusEventCommandSurface(event);

        if (applyModifiedPointerSelection(actions, event, window.id)) {
          return;
        }

        capturePointer(event.currentTarget, event.pointerId);
        actions.startMove({
          pointerId: event.pointerId,
          point: getEventViewportPoint(event),
          windowId: window.id,
        });
      }}
      onPointerMove={(event) => {
        actions.stepInteraction({
          pointerId: event.pointerId,
          point: getEventViewportPoint(event),
        });
      }}
      onPointerUp={(event) => {
        releasePointer(event.currentTarget, event.pointerId);
        actions.finishInteraction(event.pointerId);
      }}
      style={{
        background: isActive ? theme.headerActive : theme.headerIdle,
        borderBottomColor: isActive ? theme.activeAccent : theme.idleBorder,
        borderBottomStyle: "solid",
        borderBottomWidth: `${chrome.headerAccentHeight}px`,
        cursor: "grab",
        height: `${chrome.headerHeight}px`,
        pointerEvents: "auto",
        ...style,
      }}
    >
      {children === undefined ? (
        <>
          <InfiniteCanvasWindowFrameTitleSlot />
          <InfiniteCanvasWindowFrameControlsSlot />
        </>
      ) : (
        children
      )}
    </header>
  );
}

function InfiniteCanvasWindowFrameBodySlot({
  children,
  className,
  style,
}: InfiniteCanvasWindowFrameBodyProps) {
  const {
    actions,
    bodyPointerBehavior,
    chrome,
    definition,
    isActive,
    isSelected,
    state,
    textSelection,
    window,
  } = useInfiniteCanvasWindowFrameRuntimeContext();

  return (
    <section
      className={mergeClassNames("absolute inset-x-0 bottom-0 pointer-events-auto", className)}
      data-infinite-canvas-body="true"
      data-infinite-canvas-body-pan={bodyPointerBehavior === "canvas-pan" ? "true" : undefined}
      data-infinite-canvas-native-scroll={
        definition.wheelBehavior === "native-scroll" ? "true" : undefined
      }
      data-infinite-canvas-native-text-selection={textSelection === "native" ? "true" : undefined}
      onPointerDownCapture={(event) => {
        if (!isPrimaryButton(event)) {
          return;
        }

        if (textSelection === "none") {
          clearNativeTextSelection();
        }

        if (event.shiftKey || event.metaKey || event.ctrlKey) {
          event.preventDefault();
        }

        if (applyModifiedPointerSelection(actions, event, window.id)) {
          event.stopPropagation();
        } else {
          actions.focusWindow(window.id);
        }
      }}
      style={{
        overflowY: definition.overflowY ?? "auto",
        top: `${chrome.headerHeight}px`,
        userSelect: textSelection === "native" ? undefined : "none",
        ...style,
      }}
    >
      {children === undefined ? (
        <InfiniteCanvasWindowBody
          actions={actions}
          chrome={chrome}
          definition={definition}
          isActive={isActive}
          isSelected={isSelected}
          state={state}
          textSelection={textSelection}
          window={window}
        />
      ) : (
        children
      )}
    </section>
  );
}

function InfiniteCanvasWindowFrameActiveCornersSlot({
  className,
  style,
}: InfiniteCanvasWindowFrameActiveCornersProps) {
  const { chrome, isActive } = useInfiniteCanvasWindowFrameRuntimeContext();

  return isActive ? (
    <div aria-hidden="true" className={className} style={style}>
      <ActiveWindowCorners chrome={chrome} />
    </div>
  ) : null;
}

function InfiniteCanvasWindowFrameSurfaceSlot({
  children,
  className,
  style,
}: InfiniteCanvasWindowFrameSurfaceProps) {
  const { chrome, isActive, isSelected, theme } = useInfiniteCanvasWindowFrameRuntimeContext();

  return (
    <div
      className={mergeClassNames(
        "pointer-events-auto absolute inset-0 overflow-hidden border bg-[#07080b]",
        className,
      )}
      style={{
        background: theme.bodyBackground,
        borderColor: isActive
          ? theme.activeBorder
          : isSelected
            ? theme.selectionBorder
            : theme.idleBorder,
        borderWidth: `${chrome.borderWidth}px`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function InfiniteCanvasWindowFrame<Kind extends string>({
  chrome,
  devicePixelRatio,
  isActive,
  isSelected,
  stackBands,
  state,
  theme,
  window,
  windowDefinitions,
}: Readonly<{
  chrome: InfiniteCanvasChromeMetrics;
  devicePixelRatio: number;
  isActive: boolean;
  isSelected: boolean;
  stackBands: InfiniteCanvasStackBands;
  state: InfiniteCanvasState<Kind>;
  theme: InfiniteCanvasTheme;
  window: InfiniteCanvasWindow<Kind>;
  windowDefinitions: InfiniteCanvasWindowRegistry<Kind>;
}>) {
  const actions = useInfiniteCanvasActions<Kind>();
  const definition = windowDefinitions[window.kind];
  const frameChrome = definition.frameChrome ?? "dom";
  const isHostLocalChrome = frameChrome === "host" || frameChrome === "scene";
  const textSelection = definition.textSelection ?? "none";
  const bodyPointerBehavior = definition.bodyPointerBehavior ?? "native";
  const screenTransform = projectWorldRectToScreen(
    state.camera,
    state.viewport,
    window.rect,
    devicePixelRatio,
  ).screenTransform;
  const resizeHandles = useMemo(
    () => getResizeHandleDescriptors(chrome.resizeHandleSize / state.camera.zoom),
    [chrome.resizeHandleSize, state.camera.zoom],
  );
  const articleStyle: CSSProperties = {
    contain: "layout paint style",
    height: `${screenTransform.height}px`,
    left: "0px",
    top: "0px",
    transform: `translate(${screenTransform.x}px, ${screenTransform.y}px) scale(${screenTransform.scale})`,
    transformOrigin: "top left",
    width: `${screenTransform.width}px`,
    zIndex: getWindowStackValue(window, stackBands),
  };
  const FrameTitle = DEFAULT_INFINITE_CANVAS_WINDOW_FRAME_SLOTS.Title;
  const FrameControls = DEFAULT_INFINITE_CANVAS_WINDOW_FRAME_SLOTS.Controls;
  const FrameHeader = DEFAULT_INFINITE_CANVAS_WINDOW_FRAME_SLOTS.Header;
  const FrameBody = DEFAULT_INFINITE_CANVAS_WINDOW_FRAME_SLOTS.Body;
  const FrameActiveCorners = DEFAULT_INFINITE_CANVAS_WINDOW_FRAME_SLOTS.ActiveCorners;
  const FrameSurface = DEFAULT_INFINITE_CANVAS_WINDOW_FRAME_SLOTS.Surface;
  const renderDefaultFrame = (): ReactNode =>
    isHostLocalChrome ? (
      <FrameSurface className="shadow-[0_20px_80px_-56px_rgba(183,244,255,0.55)]">
        <InfiniteCanvasWindowHostChrome
          chrome={chrome}
          isActive={isActive}
          isSelected={isSelected}
          theme={theme}
        />
        <FrameHeader
          style={{
            background: "transparent",
            borderBottomColor: "transparent",
            borderBottomWidth: 0,
            zIndex: 3,
          }}
        >
          <>
            <FrameTitle />
            <FrameControls className="[&>button]:border-white/10 [&>button]:bg-white/[0.035] [&>button]:text-white/48 [&>button:hover]:border-white/18 [&>button:hover]:bg-white/[0.075]" />
          </>
        </FrameHeader>
        <FrameBody
          style={{
            background: "transparent",
            bottom: `${chrome.borderWidth}px`,
            left: `${chrome.borderWidth}px`,
            right: `${chrome.borderWidth}px`,
            top: `${chrome.headerHeight}px`,
            zIndex: 2,
          }}
        />
        <FrameActiveCorners style={{ zIndex: 4 }} />
      </FrameSurface>
    ) : (
      <FrameSurface>
        <FrameHeader />
        <FrameBody />
        <FrameActiveCorners />
      </FrameSurface>
    );
  const frameRuntimeContext = {
    actions,
    bodyPointerBehavior,
    chrome,
    definition,
    isActive,
    isSelected,
    state,
    textSelection,
    theme,
    window,
  } satisfies InfiniteCanvasWindowFrameRuntimeContextValue<Kind>;
  const frameContext = {
    actions,
    chrome,
    frame: {
      ActiveCorners: FrameActiveCorners,
      Body: FrameBody,
      Controls: FrameControls,
      Header: FrameHeader,
      Surface: FrameSurface,
      Title: FrameTitle,
    },
    isActive,
    isSelected,
    renderDefaultFrame,
    state,
    theme,
    window,
  } satisfies InfiniteCanvasWindowFrameRenderContext<Kind>;
  const frameNode = definition.renderFrame?.(frameContext) ?? renderDefaultFrame();

  return (
    <InfiniteCanvasWindowFrameRuntimeContext.Provider value={frameRuntimeContext}>
      <article
        aria-label={window.title}
        aria-selected={isSelected}
        className="absolute pointer-events-none"
        data-infinite-canvas-window-id={window.id}
        role="group"
        style={articleStyle}
      >
        {frameNode}
        {resizeHandles.map((handle) => (
          <div
            className="absolute pointer-events-auto"
            data-infinite-canvas-control="true"
            key={`${window.id}-${handle.handle}`}
            onLostPointerCapture={(event) => {
              actions.finishInteraction(event.pointerId);
            }}
            onPointerCancel={(event) => {
              actions.finishInteraction(event.pointerId);
            }}
            onPointerDown={(event) => {
              if (!isPrimaryButton(event)) {
                return;
              }

              event.preventDefault();
              event.stopPropagation();
              clearNativeTextSelection();
              capturePointer(event.currentTarget, event.pointerId);
              actions.startResize({
                handle: handle.handle,
                pointerId: event.pointerId,
                point: getEventViewportPoint(event),
                windowId: window.id,
              });
            }}
            onPointerMove={(event) => {
              actions.stepInteraction({
                pointerId: event.pointerId,
                point: getEventViewportPoint(event),
              });
            }}
            onPointerUp={(event) => {
              releasePointer(event.currentTarget, event.pointerId);
              actions.finishInteraction(event.pointerId);
            }}
            style={{
              ...handle.style,
              cursor: handle.cursor,
              zIndex: 4,
            }}
          />
        ))}
      </article>
    </InfiniteCanvasWindowFrameRuntimeContext.Provider>
  );
}

function InfiniteCanvasWindowHostChrome({
  chrome,
  isActive,
  isSelected,
  theme,
}: Readonly<{
  chrome: InfiniteCanvasChromeMetrics;
  isActive: boolean;
  isSelected: boolean;
  theme: InfiniteCanvasTheme;
}>) {
  const tone = getHostChromeTone(theme, isActive, isSelected);

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0">
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.018), rgba(255,255,255,0) 34%), #06080b",
        }}
      />
      <div
        className="absolute inset-x-0 top-0"
        style={{
          background: tone.header,
          height: `${chrome.headerHeight}px`,
        }}
      />
      <div
        className="absolute inset-x-0"
        style={{
          background: tone.accent,
          height: `${chrome.headerAccentHeight}px`,
          opacity: tone.accentOpacity,
          top: `${Math.max(chrome.headerHeight - chrome.headerAccentHeight, 0)}px`,
        }}
      />
      <div
        className="absolute inset-0 border"
        style={{
          borderColor: tone.border,
          borderWidth: `${chrome.borderWidth}px`,
          boxShadow: tone.shadow,
        }}
      />
      <div
        className="absolute inset-[1px] border"
        style={{
          borderColor: tone.innerBorder,
        }}
      />
    </div>
  );
}

function getHostChromeTone(theme: InfiniteCanvasTheme, isActive: boolean, isSelected: boolean) {
  if (isActive) {
    return {
      accent: theme.activeAccent,
      accentOpacity: 0.9,
      border: theme.activeBorder,
      header: theme.headerActive,
      innerBorder: "rgba(255, 255, 255, 0.14)",
      shadow: "0 0 0 1px rgba(215, 251, 255, 0.1), 0 18px 60px -44px rgba(183, 244, 255, 0.7)",
    };
  }

  if (isSelected) {
    return {
      accent: theme.selectionBorder,
      accentOpacity: 0.58,
      border: theme.selectionBorder,
      header: theme.headerIdle,
      innerBorder: "rgba(190, 244, 255, 0.08)",
      shadow: "0 0 0 1px rgba(148, 224, 236, 0.08), 0 18px 54px -48px rgba(148, 224, 236, 0.5)",
    };
  }

  return {
    accent: theme.idleBorder,
    accentOpacity: 0.78,
    border: "rgba(119, 151, 161, 0.56)",
    header: theme.headerIdle,
    innerBorder: "rgba(255, 255, 255, 0.045)",
    shadow: "0 14px 48px -44px rgba(160, 210, 220, 0.45)",
  };
}

function InfiniteCanvasSelectionBoundsOverlay({
  devicePixelRatio,
  theme,
}: Readonly<{
  devicePixelRatio: number;
  theme: InfiniteCanvasTheme;
}>) {
  const state = useInfiniteCanvasState();
  const bounds = getSelectedWindowBounds(state);

  if (
    bounds === null ||
    state.selection.windowIds.length < 2 ||
    state.interaction?.kind === "resize"
  ) {
    return null;
  }

  const rect = projectWorldRectToScreen(
    state.camera,
    state.viewport,
    bounds,
    devicePixelRatio,
  ).screenRect;

  return (
    <div className="pointer-events-none absolute inset-0 z-[999999996]">
      <div
        className="absolute border"
        data-infinite-canvas-selection-bounds="true"
        style={{
          borderColor: theme.selectionBounds,
          boxSizing: "border-box",
          borderStyle: "dashed",
          height: `${rect.height}px`,
          transform: `translate3d(${rect.left}px, ${rect.top}px, 0)`,
          width: `${rect.width}px`,
        }}
      />
    </div>
  );
}

function ActiveWindowCorners({
  chrome,
}: Readonly<{
  chrome: InfiniteCanvasChromeMetrics;
}>) {
  const cornerStyle = {
    height: `${chrome.cornerSize}px`,
    pointerEvents: "none",
    width: `${chrome.cornerSize}px`,
  } satisfies CSSProperties;

  return (
    <>
      <div
        aria-hidden="true"
        className="absolute border-l border-t border-white/25"
        style={{
          ...cornerStyle,
          left: "5px",
          top: "5px",
        }}
      />
      <div
        aria-hidden="true"
        className="absolute border-r border-t border-white/25"
        style={{
          ...cornerStyle,
          right: "5px",
          top: "5px",
        }}
      />
      <div
        aria-hidden="true"
        className="absolute border-b border-l border-white/25"
        style={{
          ...cornerStyle,
          bottom: "5px",
          left: "5px",
        }}
      />
      <div
        aria-hidden="true"
        className="absolute border-b border-r border-white/25"
        style={{
          ...cornerStyle,
          bottom: "5px",
          right: "5px",
        }}
      />
    </>
  );
}

function InfiniteCanvasSnapOverlay({
  devicePixelRatio,
}: Readonly<{
  devicePixelRatio: number;
}>) {
  const state = useInfiniteCanvasState();
  const preview = state.snapPreview;
  const isActiveSnapInteraction =
    state.interaction?.kind === "move" || state.interaction?.kind === "resize";

  if (preview === null || !isActiveSnapInteraction) {
    return null;
  }

  const previewProjection = projectWorldRectToScreen(
    state.camera,
    state.viewport,
    preview.rect,
    devicePixelRatio,
  );
  const previewTransform = previewProjection.screenTransform;
  const previewScreenRect = previewProjection.screenRect;
  const visibleGuides = preview.guides.filter((guide) => guide.from === "window");

  return (
    <div className="pointer-events-none absolute inset-0 z-[999999998]">
      <div
        className="absolute border border-[#b7f4ff]/45 bg-[#b7f4ff]/[0.035]"
        style={{
          boxSizing: "border-box",
          height: `${previewTransform.height}px`,
          transform: `translate3d(${previewTransform.x}px, ${previewTransform.y}px, 0) scale(${previewTransform.scale})`,
          transformOrigin: "top left",
          width: `${previewTransform.width}px`,
        }}
      />
      {visibleGuides.map((guide) => (
        <div
          className="absolute"
          key={guide.id}
          style={getSnapGuideStyle(state, guide, previewScreenRect, devicePixelRatio)}
        />
      ))}
    </div>
  );
}

function getSnapGuideStyle(
  state: InfiniteCanvasState,
  guide: InfiniteCanvasSnapGuide,
  previewScreenRect: ReturnType<typeof projectWorldRectToScreen>["screenRect"],
  devicePixelRatio: number,
): CSSProperties {
  const position = snapScreenValueToDevicePixel(
    (guide.position - (guide.axis === "x" ? state.camera.center.x : state.camera.center.y)) *
      state.camera.zoom +
      (guide.axis === "x" ? state.viewport.width : state.viewport.height) / 2,
    devicePixelRatio,
  );
  const guideColor = "rgba(183,244,255,0.55)";
  const guideInsetPx = 18;

  if (guide.axis === "x") {
    return {
      backgroundImage: `repeating-linear-gradient(to bottom, ${guideColor} 0 4px, transparent 4px 8px)`,
      height: `${previewScreenRect.height + guideInsetPx * 2}px`,
      left: `${position}px`,
      opacity: 0.72,
      top: `${previewScreenRect.top - guideInsetPx}px`,
      width: "1px",
    };
  }

  return {
    backgroundImage: `repeating-linear-gradient(to right, ${guideColor} 0 4px, transparent 4px 8px)`,
    height: "1px",
    left: `${previewScreenRect.left - guideInsetPx}px`,
    opacity: 0.72,
    top: `${position}px`,
    width: `${previewScreenRect.width + guideInsetPx * 2}px`,
  };
}

function InfiniteCanvasMarqueeOverlay() {
  const state = useInfiniteCanvasState();
  const interaction = state.interaction;

  if (interaction?.kind !== "marquee") {
    return null;
  }

  const rect = getRectFromPoints(interaction.originPointer, interaction.currentPointer);

  if (rect.width < 2 && rect.height < 2) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-[999999997]">
      <div
        className="absolute border border-[#b7f4ff]/80 bg-[#b7f4ff]/10 shadow-[inset_0_0_0_1px_rgba(183,244,255,0.16)]"
        data-infinite-canvas-marquee="true"
        style={{
          height: `${rect.height}px`,
          transform: `translate3d(${rect.x}px, ${rect.y}px, 0)`,
          width: `${rect.width}px`,
        }}
      />
    </div>
  );
}

function InfiniteCanvasHud({
  onPointerModeChange,
  pointerMode = "marquee",
  subtitle,
  title,
  zoomPolicy,
}: Readonly<{
  onPointerModeChange?: (pointerMode: InfiniteCanvasPointerMode) => void;
  pointerMode?: InfiniteCanvasPointerMode;
  subtitle: string;
  title: string;
  zoomPolicy: InfiniteCanvasZoomPolicy;
}>) {
  const state = useInfiniteCanvasState();
  const actions = useInfiniteCanvasActions();
  const activeWindow = state.windows.find((window) => window.id === state.activeWindowId);
  const minimizedWindows = state.windows.filter((window) => window.mode === "minimized");

  return (
    <div
      className="pointer-events-none absolute inset-0"
      style={{ zIndex: DEFAULT_INFINITE_CANVAS_STACK_BANDS.overlay }}
    >
      <div aria-live="polite" className="sr-only">
        Active window {activeWindow?.title ?? "none"}.
      </div>
      <div className="absolute left-4 top-4 max-w-[min(28rem,calc(100%-2rem))] border border-white/10 bg-black/45 px-4 py-3 text-[11px] text-white/56 backdrop-blur-sm">
        <div className="font-medium uppercase text-white/72">{title}</div>
        <div className="mt-2 text-white/38">{subtitle}</div>
      </div>
      <div className="absolute bottom-4 left-4 flex max-w-[calc(100%-2rem)] flex-wrap items-center gap-2">
        {minimizedWindows.map((window) => (
          <button
            className="pointer-events-auto border border-white/10 bg-[#0c1016]/92 px-3 py-2 text-[11px] font-medium uppercase text-white/58 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
            key={window.id}
            onClick={() => {
              actions.restoreWindow(window.id);
            }}
            type="button"
          >
            {window.title}
          </button>
        ))}
      </div>
      <div className="absolute bottom-4 right-4 flex max-w-[calc(100%-2rem)] flex-wrap items-center justify-end gap-2">
        {onPointerModeChange === undefined ? null : (
          <InfiniteCanvasPointerModeControls
            onModeChange={onPointerModeChange}
            pointerMode={pointerMode}
          />
        )}
        <InfiniteCanvasCameraNavigationControls />
        <InfiniteCanvasZoomControls zoomPolicy={zoomPolicy} />
        <button
          aria-label="Reset desktop"
          className="pointer-events-auto flex h-10 w-10 items-center justify-center border border-white/10 bg-[#0c1016]/92 text-white/68 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
          onClick={() => {
            actions.reset();
          }}
          type="button"
        >
          <RotateCcw size={14} strokeWidth={1.8} />
        </button>
      </div>
    </div>
  );
}

function InfiniteCanvasCameraNavigationControls() {
  const state = useInfiniteCanvasState();
  const actions = useInfiniteCanvasActions();
  const activeWindow = state.windows.find(
    (window) => window.id === state.activeWindowId && window.mode !== "minimized",
  );
  const visibleWindowExists = state.windows.some((window) => window.mode !== "minimized");
  const selectionExists = state.selection.windowIds.length > 0;

  return (
    <div
      aria-label="Camera navigation"
      className="pointer-events-auto flex items-center overflow-hidden border border-white/10 bg-[#0c1016]/92 backdrop-blur-sm"
      data-infinite-canvas-control="true"
      role="group"
    >
      <button
        aria-label="Center active window"
        className="flex h-10 w-10 items-center justify-center border-r border-white/8 text-white/68 transition hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:text-white/20"
        disabled={activeWindow === undefined}
        onClick={() => {
          if (activeWindow === undefined) {
            return;
          }

          actions.navigateView({
            target: {
              type: "window",
              windowId: activeWindow.id,
            },
          });
        }}
        title="Center active window"
        type="button"
      >
        <LocateFixed size={14} strokeWidth={1.8} />
      </button>
      <button
        aria-label="Fit selection"
        className="flex h-10 w-10 items-center justify-center border-r border-white/8 text-white/68 transition hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:text-white/20"
        disabled={!selectionExists}
        onClick={() => {
          actions.navigateView({
            behavior: {
              type: "fit",
            },
            target: {
              type: "selection",
            },
          });
        }}
        title="Fit selection"
        type="button"
      >
        <Frame size={14} strokeWidth={1.8} />
      </button>
      <button
        aria-label="Fit all visible windows"
        className="flex h-10 w-10 items-center justify-center text-white/68 transition hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:text-white/20"
        disabled={!visibleWindowExists}
        onClick={() => {
          actions.navigateView({
            behavior: {
              type: "fit",
            },
            target: {
              type: "visibleWindows",
            },
          });
        }}
        title="Fit all visible windows"
        type="button"
      >
        <ScanSearch size={14} strokeWidth={1.8} />
      </button>
    </div>
  );
}

function InfiniteCanvasPointerModeControls({
  onModeChange,
  pointerMode,
}: Readonly<{
  onModeChange: (pointerMode: InfiniteCanvasPointerMode) => void;
  pointerMode: InfiniteCanvasPointerMode;
}>) {
  return (
    <div
      aria-label="Canvas interaction mode"
      className="pointer-events-auto flex items-center overflow-hidden border border-white/10 bg-[#0c1016]/92 backdrop-blur-sm"
      data-infinite-canvas-control="true"
      role="group"
    >
      <button
        aria-label="Use marquee selection mode"
        aria-pressed={pointerMode === "marquee"}
        className={getPointerModeButtonClassName(pointerMode === "marquee", "border-r")}
        onClick={() => {
          onModeChange("marquee");
        }}
        title="Marquee selection"
        type="button"
      >
        <MousePointer2 size={14} strokeWidth={1.8} />
      </button>
      <button
        aria-label="Use pan mode"
        aria-pressed={pointerMode === "pan"}
        className={getPointerModeButtonClassName(pointerMode === "pan")}
        onClick={() => {
          onModeChange("pan");
        }}
        title="Pan canvas"
        type="button"
      >
        <Move size={14} strokeWidth={1.8} />
      </button>
    </div>
  );
}

function getPointerModeButtonClassName(isActive: boolean, divider = "") {
  return [
    "flex h-10 w-10 items-center justify-center border-white/8 transition hover:bg-white/[0.08] hover:text-white",
    divider,
    isActive ? "bg-[#142126] text-[#d7fbff]" : "bg-transparent text-white/58 hover:text-white",
  ]
    .filter(Boolean)
    .join(" ");
}

function InfiniteCanvasZoomControls({
  zoomPolicy,
}: Readonly<{
  zoomPolicy: InfiniteCanvasZoomPolicy;
}>) {
  const state = useInfiniteCanvasState();
  const actions = useInfiniteCanvasActions();
  const minZoom = getConstrainedZoom(0, zoomPolicy);
  const zoomPercent = Math.round(state.camera.zoom * 100);
  const centerAnchor = {
    x: state.viewport.width / 2,
    y: state.viewport.height / 2,
  };

  return (
    <div className="pointer-events-auto flex items-center overflow-hidden border border-white/10 bg-[#0c1016]/92 backdrop-blur-sm">
      <button
        aria-label="Zoom out"
        className="flex h-10 w-10 items-center justify-center border-r border-white/8 text-white/68 transition hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:text-white/20"
        disabled={state.camera.zoom <= minZoom}
        onClick={() => {
          actions.zoomAt({
            anchor: centerAnchor,
            zoom: state.camera.zoom / zoomPolicy.step,
          });
        }}
        type="button"
      >
        <Minus size={14} strokeWidth={1.8} />
      </button>
      <button
        aria-label="Reset zoom to 100 percent"
        className="min-w-[86px] px-3 py-2 text-[11px] font-medium uppercase text-white/58 transition hover:bg-white/[0.08] hover:text-white"
        onClick={() => {
          actions.zoomAt({
            anchor: centerAnchor,
            zoom: zoomPolicy.defaultZoom,
          });
        }}
        type="button"
      >
        {zoomPercent}%
      </button>
      <button
        aria-label="Zoom in"
        className="flex h-10 w-10 items-center justify-center border-l border-white/8 text-white/68 transition hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:text-white/20"
        disabled={state.camera.zoom >= zoomPolicy.maxZoom}
        onClick={() => {
          actions.zoomAt({
            anchor: centerAnchor,
            zoom: state.camera.zoom * zoomPolicy.step,
          });
        }}
        type="button"
      >
        <Plus size={14} strokeWidth={1.8} />
      </button>
    </div>
  );
}

function mergeClassNames(...classNames: readonly (string | undefined)[]) {
  return classNames
    .filter((className) => className !== undefined && className.length > 0)
    .join(" ");
}

function getEventViewportPoint(event: ReactPointerEvent<HTMLElement>): InfiniteCanvasPoint {
  const viewport = event.currentTarget.closest<HTMLElement>(
    "[data-infinite-canvas-viewport='true']",
  );

  return viewport === null
    ? getClientPoint(event)
    : getViewportPoint(viewport, getClientPoint(event));
}

function focusEventCommandSurface(event: ReactPointerEvent<HTMLElement>) {
  const viewport = event.currentTarget.closest<HTMLElement>(
    "[data-infinite-canvas-viewport='true']",
  );

  focusInfiniteCanvasCommandSurface(getCommandSurfaceElement(viewport));
}

function getCommandSurfaceElement(viewport: HTMLElement | null) {
  return (
    viewport?.querySelector<HTMLElement>("[data-infinite-canvas-command-scope='surface']") ?? null
  );
}

function applyModifiedPointerSelection<Kind extends string>(
  actions: InfiniteCanvasCommands<Kind>,
  event: ReactPointerEvent<HTMLElement>,
  windowId: string,
) {
  if (event.shiftKey) {
    event.preventDefault();
    actions.dispatch({
      type: "selection.add",
      windowIds: [windowId],
    });

    return true;
  }

  if (event.metaKey || event.ctrlKey) {
    event.preventDefault();
    actions.toggleWindowSelection(windowId);

    return true;
  }

  return false;
}

function applyModifiedPointerTargetSelection<Kind extends string>(
  actions: InfiniteCanvasCommands<Kind>,
  event: ReactPointerEvent<HTMLElement>,
  target: InfiniteCanvasSelectionTarget,
) {
  if (event.shiftKey) {
    actions.dispatch({
      targets: [target],
      type: "selection.targets.add",
    });

    return;
  }

  if (event.metaKey || event.ctrlKey) {
    actions.toggleTargetSelection(target);

    return;
  }

  actions.selectTarget(target);
}

function isCanvasPanTarget(
  target: EventTarget | null,
  viewport: HTMLElement,
  dragIntent: "marquee" | "pan",
) {
  if (!(target instanceof Element) || !viewport.contains(target)) {
    return target === viewport;
  }

  const interactiveTarget = target.closest(
    [
      "[data-infinite-canvas-control='true']",
      "a",
      "button",
      "input",
      "select",
      "textarea",
      "[contenteditable='true']",
      "[contenteditable='']",
    ].join(","),
  );

  if (interactiveTarget !== null) {
    return false;
  }

  const bodyTarget = target.closest("[data-infinite-canvas-body='true']");

  if (bodyTarget === null) {
    return true;
  }

  return (
    dragIntent === "pan" && bodyTarget.getAttribute("data-infinite-canvas-body-pan") === "true"
  );
}

function isCanvasWheelTarget(target: EventTarget | null, viewport: HTMLElement) {
  if (!isViewportEventTarget(target, viewport)) {
    return false;
  }

  return (
    target instanceof Element &&
    target.closest(
      [
        "input",
        "select",
        "textarea",
        "[contenteditable='true']",
        "[data-infinite-canvas-native-scroll='true']",
      ].join(","),
    ) === null
  );
}

function isViewportEventTarget(target: EventTarget | null, viewport: HTMLElement) {
  return target instanceof Element ? viewport.contains(target) : target === viewport;
}

function getWheelScreenDelta(
  event: Pick<WheelEvent, "deltaMode" | "deltaX" | "deltaY">,
  viewport: InfiniteCanvasState["viewport"],
): InfiniteCanvasPoint {
  switch (event.deltaMode) {
    case WheelEvent.DOM_DELTA_LINE:
      return {
        x: event.deltaX * 16,
        y: event.deltaY * 16,
      };
    case WheelEvent.DOM_DELTA_PAGE:
      return {
        x: event.deltaX * viewport.width,
        y: event.deltaY * viewport.height,
      };
    default:
      return {
        x: event.deltaX,
        y: event.deltaY,
      };
  }
}

function isCanvasPointerGesture(event: Pick<PointerEvent, "button" | "isPrimary">) {
  return event.isPrimary && (event.button === 0 || event.button === 1);
}

function getCanvasCursor(
  interaction: InfiniteCanvasInteraction,
  pointerMode: InfiniteCanvasPointerMode,
  inputPolicy: InfiniteCanvasInputPolicy,
): CSSProperties["cursor"] {
  if (interaction === null) {
    return getInfiniteCanvasIdleCursor(inputPolicy, pointerMode);
  }

  if (interaction.kind === "resize") {
    return getInteractionCursor(interaction);
  }

  return getInfiniteCanvasInteractionCursor(inputPolicy, interaction.kind);
}

function isCanvasPanGesture(
  event: Pick<PointerEvent, "altKey" | "button">,
  isSpacePanActive: boolean,
) {
  return event.button === 1 || event.altKey || isSpacePanActive;
}

function shouldClearSelectionOnPanStart(
  event: Pick<PointerEvent, "altKey" | "button">,
  isSpacePanActive: boolean,
) {
  return !isCanvasPanGesture(event, isSpacePanActive);
}

function getEmptyCanvasDragIntent(
  inputPolicy: InfiniteCanvasInputPolicy,
  event: Pick<PointerEvent, "altKey" | "button">,
  isSpacePanActive: boolean,
  selectionExists: boolean,
) {
  if (isCanvasPanGesture(event, isSpacePanActive)) {
    return "pan" as const;
  }

  if (inputPolicy.emptyCanvasDrag === "pan") {
    return "pan" as const;
  }

  if (inputPolicy.emptyCanvasDrag === "marqueeWhenSelectionExists" && !selectionExists) {
    return "pan" as const;
  }

  return "marquee" as const;
}

function getMarqueeMode(
  event: Pick<PointerEvent, "ctrlKey" | "metaKey" | "shiftKey">,
): InfiniteCanvasMarqueeMode {
  if (event.metaKey || event.ctrlKey) {
    return "toggle";
  }

  return event.shiftKey ? "add" : "replace";
}

function isSpacePanKeyEvent(event: KeyboardEvent, commandSurface: HTMLElement | null) {
  return (
    (event.code === "Space" || event.key === " ") &&
    event.target === commandSurface &&
    !event.defaultPrevented &&
    !event.repeat &&
    !event.isComposing
  );
}

function getResizeHandleDescriptors(size: number): readonly Readonly<{
  cursor: CSSProperties["cursor"];
  handle: InfiniteCanvasResizeHandle;
  style: CSSProperties;
}>[] {
  const halfSize = size / 2;

  return [
    {
      cursor: "ns-resize",
      handle: "north",
      style: {
        height: `${size}px`,
        left: `${size}px`,
        right: `${size}px`,
        top: `${-halfSize}px`,
      },
    },
    {
      cursor: "ns-resize",
      handle: "south",
      style: {
        bottom: `${-halfSize}px`,
        height: `${size}px`,
        left: `${size}px`,
        right: `${size}px`,
      },
    },
    {
      cursor: "ew-resize",
      handle: "east",
      style: {
        bottom: `${size}px`,
        right: `${-halfSize}px`,
        top: `${size}px`,
        width: `${size}px`,
      },
    },
    {
      cursor: "ew-resize",
      handle: "west",
      style: {
        bottom: `${size}px`,
        left: `${-halfSize}px`,
        top: `${size}px`,
        width: `${size}px`,
      },
    },
    {
      cursor: "nwse-resize",
      handle: "north-west",
      style: {
        height: `${size}px`,
        left: `${-halfSize}px`,
        top: `${-halfSize}px`,
        width: `${size}px`,
      },
    },
    {
      cursor: "nesw-resize",
      handle: "north-east",
      style: {
        height: `${size}px`,
        right: `${-halfSize}px`,
        top: `${-halfSize}px`,
        width: `${size}px`,
      },
    },
    {
      cursor: "nesw-resize",
      handle: "south-west",
      style: {
        bottom: `${-halfSize}px`,
        height: `${size}px`,
        left: `${-halfSize}px`,
        width: `${size}px`,
      },
    },
    {
      cursor: "nwse-resize",
      handle: "south-east",
      style: {
        bottom: `${-halfSize}px`,
        height: `${size}px`,
        right: `${-halfSize}px`,
        width: `${size}px`,
      },
    },
  ];
}

const InfiniteCanvas = {
  Desktop: InfiniteCanvasDesktop,
  Hud: InfiniteCanvasHud,
  Provider: InfiniteCanvasProvider,
  Viewport: InfiniteCanvasViewport,
  WebGpuSurface: InfiniteCanvasWebGpuSurface,
  WindowLayer: InfiniteCanvasWindowLayer,
} as const;

export {
  InfiniteCanvas,
  InfiniteCanvasDesktop,
  InfiniteCanvasHud,
  InfiniteCanvasViewport,
  InfiniteCanvasWebGpuSurface,
  InfiniteCanvasWindowLayer,
};

export type { InfiniteCanvasDesktopProps, InfiniteCanvasViewportProps };
