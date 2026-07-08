"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

import { InfiniteCanvasHud } from "./canvas-hud";
import {
  InfiniteCanvasMarqueeOverlay,
  InfiniteCanvasSelectionBoundsOverlay,
  InfiniteCanvasSnapOverlay,
} from "./canvas-overlays";
import { INFINITE_CANVAS_SLOTS } from "./data-attributes";
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
  resolveInfiniteCanvasDiagnosticsPolicy,
  type InfiniteCanvasDiagnosticsPolicy,
  type InfiniteCanvasDiagnosticsPolicyInput,
} from "./diagnostics";
import { getWheelZoomFactor } from "./geometry";
import {
  EMPTY_INFINITE_CANVAS_DROP,
  createInfiniteCanvasDropInteraction,
  isPointInsideInfiniteCanvasViewport,
} from "./drop-interaction";
import { InfiniteCanvasGridBackdrop } from "./grid-backdrop";
import {
  DEFAULT_INFINITE_CANVAS_ICONS,
  InfiniteCanvasIconsContext,
  type InfiniteCanvasIcons,
} from "./icons";
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
import { isWindowSelected } from "./selection";
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
  resolveInfiniteCanvasRasterizationPolicy,
  type InfiniteCanvasRasterizationPolicyInput,
} from "./rasterization-layer";
import { SCENE_UNDERLAY_Z_INDEX, getSceneLayers } from "./scene-surface";
import type { InfiniteCanvasSceneSurface } from "./scene-surface";
import { InfiniteCanvasWindowFrame } from "./window-frame";
import type {
  InfiniteCanvasChromeMetrics,
  InfiniteCanvasCommands,
  InfiniteCanvasDragStartInput,
  InfiniteCanvasDropPayload,
  InfiniteCanvasDropInteraction,
  InfiniteCanvasDropPolicy,
  InfiniteCanvasDropValidationInput,
  InfiniteCanvasHudPolicyInput,
  InfiniteCanvasInteraction,
  InfiniteCanvasInputPolicy,
  InfiniteCanvasMarqueeMode,
  InfiniteCanvasOverlayRenderContext,
  InfiniteCanvasPoint,
  InfiniteCanvasPointerMode,
  InfiniteCanvasSceneLayer,
  InfiniteCanvasSelectionTarget,
  InfiniteCanvasSnapPolicy,
  InfiniteCanvasSpatialTarget,
  InfiniteCanvasSpatialTargetResolver,
  InfiniteCanvasStackBands,
  InfiniteCanvasState,
  InfiniteCanvasTheme,
  InfiniteCanvasWindow,
  InfiniteCanvasWindowRegistry,
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
  hud?: InfiniteCanvasHudPolicyInput;
  icons?: InfiniteCanvasIcons;
  initialState: InfiniteCanvasState<Kind>;
  inputPolicy?: InfiniteCanvasInputPolicy;
  rasterization?: InfiniteCanvasRasterizationPolicyInput | boolean;
  renderOverlay?: (context: InfiniteCanvasOverlayRenderContext<Kind, Payload>) => ReactNode;
  sceneLayers?: readonly InfiniteCanvasSceneLayer<Kind, Payload>[];
  /**
   * The component that paints `sceneLayers`. Pass
   * `InfiniteCanvasWebGpuSurface` from `@infinite-canvas/react/scene`; without
   * it, scene layers are inert and `three` never enters your bundle.
   */
  sceneSurface?: InfiniteCanvasSceneSurface<Kind, Payload>;
  snapPolicy?: InfiniteCanvasSnapPolicy;
  spatialTargetResolvers?: readonly InfiniteCanvasSpatialTargetResolver<Kind>[];
  storageKey?: string;
  subtitle?: string;
  theme?: Partial<InfiniteCanvasTheme>;
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
  hud?: InfiniteCanvasHudPolicyInput;
  icons?: InfiniteCanvasIcons;
  inputPolicy: InfiniteCanvasInputPolicy;
  renderOverlay?: (context: InfiniteCanvasOverlayRenderContext<Kind, Payload>) => ReactNode;
  sceneLayers: readonly InfiniteCanvasSceneLayer<Kind, Payload>[];
  sceneSurface?: InfiniteCanvasSceneSurface<Kind, Payload>;
  subtitle: string;
  spatialTargetResolvers: readonly InfiniteCanvasSpatialTargetResolver<Kind>[];
  theme?: Partial<InfiniteCanvasTheme>;
  title: string;
  windowDefinitions: InfiniteCanvasWindowRegistry<Kind>;
  zoomPolicy: InfiniteCanvasZoomPolicy;
}>;

const SCENE_SCREEN_UNDERLAY_Z_INDEX = 1;
const WINDOW_LAYER_Z_INDEX = 10;
const SCENE_OVERLAY_Z_INDEX = DEFAULT_INFINITE_CANVAS_STACK_BANDS.overlay - 10;
const SCENE_SCREEN_OVERLAY_Z_INDEX = DEFAULT_INFINITE_CANVAS_STACK_BANDS.overlay - 9;

/** Theme field → `--icx-*` custom property, mirroring theme.css's bridged token block. */
const INFINITE_CANVAS_THEME_VARIABLES: Readonly<Record<keyof InfiniteCanvasTheme, string>> = {
  activeAccent: "--icx-active-accent",
  activeBorder: "--icx-active-border",
  background: "--icx-background",
  bodyBackground: "--icx-body-background",
  gridMajor: "--icx-grid-major",
  gridMinor: "--icx-grid-minor",
  headerActive: "--icx-header-active",
  headerIdle: "--icx-header-idle",
  idleBorder: "--icx-idle-border",
  selectionBorder: "--icx-selection-border",
  selectionBounds: "--icx-selection-bounds",
};

/**
 * Inline `--icx-*` overrides for exactly the theme keys the consumer
 * provided. The default look stays in theme.css, so no vars are emitted
 * when the theme prop is omitted.
 */
function getInfiniteCanvasThemeVariables(
  theme: Partial<InfiniteCanvasTheme> | undefined,
): CSSProperties | undefined {
  if (theme === undefined) {
    return undefined;
  }

  const variables: Record<string, string> = {};

  for (const field of Object.keys(
    INFINITE_CANVAS_THEME_VARIABLES,
  ) as (keyof InfiniteCanvasTheme)[]) {
    const value = theme[field];

    if (value !== undefined) {
      variables[INFINITE_CANVAS_THEME_VARIABLES[field]] = value;
    }
  }

  return variables;
}

/**
 * Scene layers without a `sceneSurface` render nothing, and nothing about that
 * is obvious from the outside — the windows still work, the layers just never
 * appear. Pure so it can be tested without a renderer.
 */
function getInfiniteCanvasMissingSceneSurfaceWarning(
  sceneLayerCount: number,
  frustumDiagnostics: boolean,
  hasSceneSurface: boolean,
): string | null {
  if (hasSceneSurface) {
    return null;
  }

  if (sceneLayerCount > 0) {
    return (
      "[infinite-canvas] `sceneLayers` were provided without a `sceneSurface`, so they will " +
      "not render. Pass `sceneSurface={InfiniteCanvasWebGpuSurface}` from " +
      "`@infinite-canvas/react/scene`, and install the `three` and `@react-three/fiber` peers."
    );
  }

  if (frustumDiagnostics) {
    return (
      "[infinite-canvas] `diagnostics.frustum` needs a `sceneSurface` to run its probes. Pass " +
      "`sceneSurface={InfiniteCanvasWebGpuSurface}` from `@infinite-canvas/react/scene`."
    );
  }

  return null;
}

/** Say it once, in development, rather than letting it read as a bug in the layer. */
function useInfiniteCanvasSceneSurfaceWarning(
  sceneLayerCount: number,
  frustumDiagnostics: boolean,
  sceneSurface: unknown,
) {
  useEffect(() => {
    if (process.env.NODE_ENV === "production") {
      return;
    }

    const warning = getInfiniteCanvasMissingSceneSurfaceWarning(
      sceneLayerCount,
      frustumDiagnostics,
      sceneSurface !== undefined,
    );

    if (warning !== null) {
      console.warn(warning);
    }
  }, [frustumDiagnostics, sceneLayerCount, sceneSurface]);
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
  hud,
  icons,
  initialState,
  inputPolicy = DEFAULT_INFINITE_CANVAS_INPUT_POLICY,
  rasterization,
  renderOverlay,
  sceneLayers = [],
  sceneSurface,
  snapPolicy,
  spatialTargetResolvers = [],
  storageKey,
  subtitle = "Composable WebGPU surface, DOM body seam, pure window model.",
  theme,
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
            hud={hud}
            icons={icons}
            inputPolicy={inputPolicy}
            renderOverlay={renderOverlay}
            sceneLayers={sceneLayers}
            sceneSurface={sceneSurface}
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
  hud,
  icons,
  inputPolicy,
  renderOverlay,
  sceneLayers,
  sceneSurface: SceneSurface,
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
  // Full theme object for the consumers that still need JS color values
  // (scene layer context, WebGPU surface, host-chrome); DOM styling reads
  // the `--icx-*` tokens from theme.css instead.
  const resolvedTheme = useMemo<InfiniteCanvasTheme>(
    () => ({ ...DEFAULT_INFINITE_CANVAS_THEME, ...theme }),
    [theme],
  );
  const themeVariables = useMemo(() => getInfiniteCanvasThemeVariables(theme), [theme]);
  const resolvedIcons = useMemo(() => ({ ...DEFAULT_INFINITE_CANVAS_ICONS, ...icons }), [icons]);
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
  useInfiniteCanvasSceneSurfaceWarning(sceneLayers.length, diagnostics.frustum, SceneSurface);
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
    // Mount-scoped, not gated on drag status: startDrag writes
    // dropInteractionRef synchronously, so pointer events arriving in the
    // same frame (before React commits the state) must already be heard.
    // The handlers no-op unless the ref says a drag is active.
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
    dropPolicy,
    releaseDropPointerCapture,
    store,
  ]);

  return (
    <InfiniteCanvasIconsContext.Provider value={resolvedIcons}>
      <section
        aria-label={title}
        className={className}
        data-infinite-canvas-viewport="true"
        data-interaction={interaction?.kind}
        data-pointer-mode={pointerMode}
        data-slot={INFINITE_CANVAS_SLOTS.viewport}
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
          ...themeVariables,
          cursor,
          display: "flex",
          flex: "1 1 0%",
          height: "100%",
          minHeight: 0,
          minWidth: 0,
          overflow: "hidden",
          position: "relative",
          touchAction: "none",
          userSelect: interaction === null ? undefined : "none",
          width: "100%",
        }}
      >
        <div
          data-infinite-canvas-command-scope="surface"
          ref={commandSurfaceRef}
          style={{
            height: 1,
            opacity: 0,
            outline: "none",
            pointerEvents: "none",
            position: "absolute",
            width: 1,
          }}
          tabIndex={-1}
        />
        <InfiniteCanvasGridBackdrop />
        {SceneSurface === undefined ||
        (underlayWorldSceneLayers.length === 0 && !diagnostics.frustum) ? null : (
          <SceneSurface
            chrome={chrome}
            devicePixelRatio={devicePixelRatio}
            diagnostics={diagnostics}
            dropInteraction={dropInteraction}
            sceneLayers={underlayWorldSceneLayers}
            space="world"
            spatialTargetResolvers={spatialTargetResolvers}
            theme={resolvedTheme}
            zIndex={SCENE_UNDERLAY_Z_INDEX}
          />
        )}
        {SceneSurface === undefined || underlayScreenSceneLayers.length === 0 ? null : (
          <SceneSurface
            chrome={chrome}
            devicePixelRatio={devicePixelRatio}
            diagnostics={DEFAULT_INFINITE_CANVAS_DIAGNOSTICS}
            dropInteraction={dropInteraction}
            sceneLayers={underlayScreenSceneLayers}
            space="screen"
            spatialTargetResolvers={spatialTargetResolvers}
            theme={resolvedTheme}
            zIndex={SCENE_SCREEN_UNDERLAY_Z_INDEX}
          />
        )}
        <InfiniteCanvasWindowLayer
          chrome={chrome}
          devicePixelRatio={devicePixelRatio}
          stackBands={DEFAULT_INFINITE_CANVAS_STACK_BANDS}
          theme={resolvedTheme}
          windowDefinitions={windowDefinitions}
          zIndex={WINDOW_LAYER_Z_INDEX}
        />
        {SceneSurface === undefined || overlayWorldSceneLayers.length === 0 ? null : (
          <SceneSurface
            chrome={chrome}
            devicePixelRatio={devicePixelRatio}
            diagnostics={DEFAULT_INFINITE_CANVAS_DIAGNOSTICS}
            dropInteraction={dropInteraction}
            sceneLayers={overlayWorldSceneLayers}
            space="world"
            spatialTargetResolvers={spatialTargetResolvers}
            theme={resolvedTheme}
            zIndex={SCENE_OVERLAY_Z_INDEX}
          />
        )}
        {SceneSurface === undefined || overlayScreenSceneLayers.length === 0 ? null : (
          <SceneSurface
            chrome={chrome}
            devicePixelRatio={devicePixelRatio}
            diagnostics={DEFAULT_INFINITE_CANVAS_DIAGNOSTICS}
            dropInteraction={dropInteraction}
            sceneLayers={overlayScreenSceneLayers}
            space="screen"
            spatialTargetResolvers={spatialTargetResolvers}
            theme={resolvedTheme}
            zIndex={SCENE_SCREEN_OVERLAY_Z_INDEX}
          />
        )}
        <InfiniteCanvasSelectionBoundsOverlay devicePixelRatio={devicePixelRatio} />
        <InfiniteCanvasSnapOverlay devicePixelRatio={devicePixelRatio} />
        <InfiniteCanvasMarqueeOverlay />
        {renderOverlay?.(overlayContext)}
        <InfiniteCanvasHud
          onPointerModeChange={setPointerModeOverride}
          pointerMode={pointerMode}
          policy={hud}
          subtitle={subtitle}
          title={title}
          zoomPolicy={zoomPolicy}
        />
        <InfiniteCanvasRasterSchedulerGate paused={interaction !== null} />
        <InfiniteCanvasDiagnosticsOverlay policy={diagnostics} />
        <InfiniteCanvasRasterHud />
      </section>
    </InfiniteCanvasIconsContext.Provider>
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
    <div style={{ inset: 0, pointerEvents: "none", position: "absolute", zIndex }}>
      {visibleWindows.map((window) => (
        <InfiniteCanvasWindowFrame
          camera={state.camera}
          chrome={chrome}
          devicePixelRatio={devicePixelRatio}
          isActive={state.activeWindowId === window.id}
          isSelected={isWindowSelected(state, window.id)}
          key={window.id}
          stackBands={stackBands}
          theme={theme}
          viewport={state.viewport}
          window={window}
          windowDefinitions={windowDefinitions}
        />
      ))}
    </div>
  );
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

const InfiniteCanvas = {
  Desktop: InfiniteCanvasDesktop,
  Hud: InfiniteCanvasHud,
  Provider: InfiniteCanvasProvider,
  Viewport: InfiniteCanvasViewport,
  WindowLayer: InfiniteCanvasWindowLayer,
} as const;

export {
  InfiniteCanvas,
  InfiniteCanvasDesktop,
  getInfiniteCanvasMissingSceneSurfaceWarning,
  InfiniteCanvasHud,
  InfiniteCanvasViewport,
  InfiniteCanvasWindowLayer,
};

export type { InfiniteCanvasDesktopProps, InfiniteCanvasViewportProps };
