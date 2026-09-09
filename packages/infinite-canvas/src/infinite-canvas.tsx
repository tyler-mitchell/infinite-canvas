"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

import { InfiniteCanvasAnnouncer } from "./announcer";
import { InfiniteCanvasHud } from "./canvas-hud";
import {
  InfiniteCanvasDockPreviewOverlay,
  InfiniteCanvasDropSnapOverlay,
  InfiniteCanvasMarqueeOverlay,
  InfiniteCanvasRevealedChangeOverlay,
  InfiniteCanvasSelectionBoundsOverlay,
  InfiniteCanvasSnapOverlay,
} from "./canvas-overlays";
import { getInfiniteCanvasWindowFrameElementId, INFINITE_CANVAS_SLOTS } from "./data-attributes";
import { getInfiniteCanvasWorkspaceWindowIds } from "./workspace";
import type { InfiniteCanvasScenePass } from "./compositor/pass";
import {
  DEFAULT_INFINITE_CANVAS_COMPOSITOR,
  hasInfiniteCanvasOverlayPass,
  resolveInfiniteCanvasCompositorPolicy,
  type InfiniteCanvasCompositorPolicy,
  type InfiniteCanvasCompositorPolicyInput,
} from "./compositor/policy";
import { focusInfiniteCanvasContent } from "./focus-trap";
import {
  DEFAULT_INFINITE_CANVAS_INPUT_POLICY,
  DEFAULT_INFINITE_CANVAS_STACK_BANDS,
  DEFAULT_INFINITE_CANVAS_EDGE_PAN,
  DEFAULT_INFINITE_CANVAS_THEME,
  resolveInfiniteCanvasChromeMetrics,
  resolveInfiniteCanvasZoomPolicy,
  type InfiniteCanvasEdgePanPolicy,
} from "./constants";
import {
  DEFAULT_INFINITE_CANVAS_DIAGNOSTICS,
  InfiniteCanvasDiagnosticsOverlay,
  InfiniteCanvasDiagnosticsProvider,
  resolveInfiniteCanvasDiagnosticsPolicy,
  type InfiniteCanvasDiagnosticsPolicy,
  type InfiniteCanvasDiagnosticsPolicyInput,
} from "./diagnostics";
import {
  getInfiniteCanvasContentViewport,
  getInfiniteCanvasEdgePanVelocity,
  getWheelZoomFactor,
} from "./geometry";
import {
  EMPTY_INFINITE_CANVAS_DROP,
  createInfiniteCanvasDropInteraction,
  getInfiniteCanvasDropPlacement,
  isPointInsideInfiniteCanvasViewport,
} from "./drop-interaction";
import { getInfiniteCanvasNativeDropPayload } from "./native-drop";
import { InfiniteCanvasGridBackdrop } from "./grid-backdrop";
import { InfiniteCanvasGroupLayer } from "./group-layer";
import {
  getInfiniteCanvasGroupProjection,
  getInfiniteCanvasGroupTabLabel,
  type InfiniteCanvasGroupTabLabel,
} from "./group-state";
import type { InfiniteCanvasGroup, InfiniteCanvasGroupMetricsInput } from "./types";
import {
  DEFAULT_INFINITE_CANVAS_ICONS,
  InfiniteCanvasIconsContext,
  type InfiniteCanvasIcons,
} from "./icons";
import { getInteractionCursor } from "./interaction";
import { InfiniteCanvasDesktopPortalContext } from "./portal";
import {
  getInfiniteCanvasIdleCursor,
  getInfiniteCanvasInteractionCursor,
  getInfiniteCanvasPointerMode,
  withInfiniteCanvasPointerMode,
} from "./input-policy";
import { focusInfiniteCanvasCommandSurface, registerInfiniteCanvasHotkeys } from "./keyboard";
import type { InfiniteCanvasHotkeyAction } from "./keyboard";
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
import { SCENE_UNDERLAY_Z_INDEX } from "./scene-surface";
import type { InfiniteCanvasSceneSurface } from "./scene-surface";
import { InfiniteCanvasWindowFrame } from "./window-frame";
import type {
  InfiniteCanvasChromeMetrics,
  InfiniteCanvasCommands,
  InfiniteCanvasDragStartInput,
  InfiniteCanvasDropPayload,
  InfiniteCanvasDropInteraction,
  InfiniteCanvasDropPlacement,
  InfiniteCanvasDropPolicy,
  InfiniteCanvasDropValidationInput,
  InfiniteCanvasHudPolicyInput,
  InfiniteCanvasInteraction,
  InfiniteCanvasInputPolicy,
  InfiniteCanvasMarqueeMode,
  InfiniteCanvasOverlayReadContext,
  InfiniteCanvasOverlayRenderContext,
  InfiniteCanvasPoint,
  InfiniteCanvasPointerMode,
  InfiniteCanvasSelectionTarget,
  InfiniteCanvasSnapPolicy,
  InfiniteCanvasSpatialTarget,
  InfiniteCanvasSpatialTargetResolver,
  InfiniteCanvasStackBands,
  InfiniteCanvasState,
  InfiniteCanvasTheme,
  InfiniteCanvasWindow,
  InfiniteCanvasWindowRegistry,
  InfiniteCanvasChromeMetricsInput,
  InfiniteCanvasViewportInsetsInput,
  InfiniteCanvasViewportOccluder,
  InfiniteCanvasZoomPolicy,
  InfiniteCanvasZoomPolicyInput,
} from "./types";

type InfiniteCanvasDesktopProps<
  Kind extends string,
  Payload = InfiniteCanvasDropPayload,
> = Readonly<{
  chrome?: InfiniteCanvasChromeMetricsInput;
  className?: string;
  /** Which framework compositor passes run and how each is tuned. Needs `sceneSurface`. */
  compositor?: InfiniteCanvasCompositorPolicyInput;
  diagnostics?: InfiniteCanvasDiagnosticsPolicyInput;
  /**
   * Pans the canvas when a drag reaches a viewport edge. `false` holds the
   * camera still. Memoize this object: pointer handling restarts when its
   * identity changes, which stops a pan held at the edge.
   */
  edgePan?: InfiniteCanvasEdgePanPolicy | false;
  documentKey?: string;
  dropPolicy?: InfiniteCanvasDropPolicy<Kind, Payload>;
  /** Adds consumer actions to the keymap without replacing command bindings. */
  hotkeyActions?: readonly InfiniteCanvasHotkeyAction<Kind>[];
  hotkeyBindings?: readonly InfiniteCanvasHotkeyBinding[];
  hud?: InfiniteCanvasHudPolicyInput;
  icons?: InfiniteCanvasIcons;
  initialState: InfiniteCanvasState<Kind>;
  inputPolicy?: InfiniteCanvasInputPolicy;
  rasterization?: InfiniteCanvasRasterizationPolicyInput | boolean;
  /** Replaces the grid below windows with screen-space content. */
  renderBackdrop?: (context: InfiniteCanvasOverlayReadContext<Kind, Payload>) => ReactNode;
  /** World content below windows and above the backdrop. */
  renderUnderlay?: (context: InfiniteCanvasOverlayReadContext<Kind, Payload>) => ReactNode;
  renderOverlay?: (context: InfiniteCanvasOverlayRenderContext<Kind, Payload>) => ReactNode;
  /** Paints the framework's passes. Omit it to exclude scene dependencies from the bundle. */
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
  chrome?: InfiniteCanvasChromeMetricsInput;
  className?: string;
  compositor?: InfiniteCanvasCompositorPolicy;
  diagnostics?: InfiniteCanvasDiagnosticsPolicy;
  /**
   * Pans the canvas when a drag reaches a viewport edge. `false` holds the
   * camera still. Memoize this object: pointer handling restarts when its
   * identity changes, which stops a pan held at the edge.
   */
  edgePan?: InfiniteCanvasEdgePanPolicy | false;
  /** Screen-edge bands that chrome covers. Camera framing uses the remaining region. */
  viewportInsets?: InfiniteCanvasViewportInsetsInput;
  /** In-content screen rects that placement treats as occupied. Memoize this array. */
  viewportOccluders?: readonly InfiniteCanvasViewportOccluder[];
  dropPolicy?: InfiniteCanvasDropPolicy<Kind, Payload>;
  /** Group chrome metrics shared by layout and the reducer. */
  groupMetrics?: InfiniteCanvasGroupMetricsInput;
  /** Resolves a group label. Return `""` to hide one label. */
  groupLabel?: (
    context: Readonly<{ group: InfiniteCanvasGroup; windows: readonly InfiniteCanvasWindow[] }>,
  ) => string;
  /** Resolves tab and accordion labels. The default is the window title. */
  groupTabLabel?: InfiniteCanvasGroupTabLabel;
  /** Adds consumer actions without replacing canvas bindings. */
  hotkeyActions?: readonly InfiniteCanvasHotkeyAction<Kind>[];
  hotkeyBindings?: readonly InfiniteCanvasHotkeyBinding[];
  hud?: InfiniteCanvasHudPolicyInput;
  icons?: InfiniteCanvasIcons;
  inputPolicy?: InfiniteCanvasInputPolicy;
  /** Replaces the grid below windows with screen-space content. */
  renderBackdrop?: (context: InfiniteCanvasOverlayReadContext<Kind, Payload>) => ReactNode;
  /** World content below windows and above the backdrop. */
  renderUnderlay?: (context: InfiniteCanvasOverlayReadContext<Kind, Payload>) => ReactNode;
  renderOverlay?: (context: InfiniteCanvasOverlayRenderContext<Kind, Payload>) => ReactNode;
  sceneLayers?: readonly InfiniteCanvasScenePass<Kind, Payload>[];
  sceneSurface?: InfiniteCanvasSceneSurface<Kind, Payload>;
  /** Store used for move, resize, and drop snapping. */
  snapPolicy?: InfiniteCanvasSnapPolicy;
  subtitle?: string;
  spatialTargetResolvers?: readonly InfiniteCanvasSpatialTargetResolver<Kind>[];
  theme?: Partial<InfiniteCanvasTheme>;
  title?: string;
  windowDefinitions: InfiniteCanvasWindowRegistry<Kind>;
  zoomPolicy?: InfiniteCanvasZoomPolicy;
}>;

/**
 * One shared empty list for every absent list prop. A fresh `[]` per render
 * would rebuild the compositor's pipelines and invalidate every memo that
 * lists the prop as a dependency.
 */
const EMPTY_LIST: readonly never[] = [];

/** Longest step one edge-pan frame may apply. A stalled tab returns with a large gap. */
const MAX_EDGE_PAN_STEP_SECONDS = 1 / 20;

/** World content below windows. */
const UNDERLAY_Z_INDEX = 2;
const GROUP_LAYER_Z_INDEX = 5;
const PORTAL_ROOT_Z_INDEX = DEFAULT_INFINITE_CANVAS_STACK_BANDS.overlay + 1;
const WINDOW_LAYER_Z_INDEX = 10;
const SCENE_OVERLAY_Z_INDEX = DEFAULT_INFINITE_CANVAS_STACK_BANDS.overlay - 10;

/** Maps theme fields to matching CSS custom properties. */
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
  revealedChange: "--icx-revealed-change",
  selectionBorder: "--icx-selection-border",
  selectionBounds: "--icx-selection-bounds",
};

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

function getInfiniteCanvasMissingSceneSurfaceWarning(
  sceneLayerCount: number,
  hasSceneSurface: boolean,
): string | null {
  if (hasSceneSurface || sceneLayerCount === 0) {
    return null;
  }

  return (
    "[infinite-canvas] `sceneLayers` were provided without a `sceneSurface`, so they will " +
    "not render. Pass `sceneSurface={InfiniteCanvasCompositorSurface}` from " +
    "`@hyphened/infinite-canvas/scene`, and install the `typegpu` and `@typegpu/react` peers."
  );
}

// Keep NodeJS types out of public declaration files.
declare const process: Readonly<{ env: Readonly<{ NODE_ENV?: string }> }>;

function useInfiniteCanvasSceneSurfaceWarning(sceneLayerCount: number, sceneSurface: unknown) {
  useEffect(() => {
    if (process.env.NODE_ENV === "production") {
      return;
    }

    const warning = getInfiniteCanvasMissingSceneSurfaceWarning(
      sceneLayerCount,
      sceneSurface !== undefined,
    );

    if (warning !== null) {
      console.warn(warning);
    }
  }, [sceneLayerCount, sceneSurface]);
}

function getBrowserDevicePixelRatio() {
  return Math.max(window.devicePixelRatio || 1, 1);
}

function resolveInfiniteCanvasDragDropTarget<Kind extends string, Payload>({
  chrome,
  dropPolicy,
  payload,
  resolvers,
  snapPolicy,
  state,
  viewportPoint,
}: Readonly<{
  chrome: InfiniteCanvasChromeMetrics;
  dropPolicy?: InfiniteCanvasDropPolicy<Kind, Payload>;
  payload: Payload;
  resolvers: readonly InfiniteCanvasSpatialTargetResolver<Kind>[];
  snapPolicy?: InfiniteCanvasSnapPolicy;
  state: InfiniteCanvasState<Kind>;
  viewportPoint: InfiniteCanvasPoint;
}>): Readonly<{
  placement: InfiniteCanvasDropPlacement | null;
  target: InfiniteCanvasSpatialTarget<Kind> | null;
  validation: InfiniteCanvasDropValidationInput;
}> {
  if (!isPointInsideInfiniteCanvasViewport(state.viewport, viewportPoint)) {
    return {
      placement: null,
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
  const context = {
    payload,
    state,
    target,
    viewportPoint,
    worldPoint: target.worldPoint,
  };
  const placementInput = dropPolicy?.placement?.(context) ?? null;

  return {
    // Use the same snap result for the preview and the committed drop.
    placement:
      placementInput === null
        ? null
        : getInfiniteCanvasDropPlacement({
            anchor: placementInput.anchor,
            size: placementInput.size,
            snapPolicy,
            state,
            worldPoint: target.worldPoint,
          }),
    target,
    validation: dropPolicy?.canDrop?.(context) ?? true,
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
  // The viewport merges this partial value with its defaults.
  chrome,
  className,
  compositor,
  diagnostics,
  documentKey,
  dropPolicy,
  edgePan,
  hotkeyActions,
  hotkeyBindings,
  hud,
  icons,
  initialState,
  inputPolicy = DEFAULT_INFINITE_CANVAS_INPUT_POLICY,
  rasterization,
  renderBackdrop,
  renderOverlay,
  renderUnderlay,
  sceneSurface,
  snapPolicy,
  spatialTargetResolvers = EMPTY_LIST,
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
  const resolvedCompositorPolicy = useMemo(
    () => resolveInfiniteCanvasCompositorPolicy(compositor),
    [compositor],
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
            compositor={resolvedCompositorPolicy}
            diagnostics={resolvedDiagnosticsPolicy}
            dropPolicy={dropPolicy}
            edgePan={edgePan}
            hotkeyActions={hotkeyActions}
            hotkeyBindings={hotkeyBindings}
            hud={hud}
            snapPolicy={snapPolicy}
            icons={icons}
            inputPolicy={inputPolicy}
            renderBackdrop={renderBackdrop}
            renderUnderlay={renderUnderlay}
            renderOverlay={renderOverlay}
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

/** Reserved pointer id for native drags. Browser pointer ids are nonnegative. */
const NATIVE_DROP_POINTER_ID = -1;
const NATIVE_DROP_INTERACTION_ID = "__infinite-canvas-native-drop__";

function isEditableEventTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target.closest("[contenteditable='true'], input, textarea") !== null
  );
}

/** Mounts a canvas with default policies without `InfiniteCanvasDesktop`. */
function InfiniteCanvasViewport<Kind extends string, Payload = InfiniteCanvasDropPayload>({
  chrome: chromeInput,
  className,
  compositor = DEFAULT_INFINITE_CANVAS_COMPOSITOR,
  diagnostics = DEFAULT_INFINITE_CANVAS_DIAGNOSTICS,
  edgePan = DEFAULT_INFINITE_CANVAS_EDGE_PAN,
  dropPolicy,
  groupMetrics,
  groupLabel,
  groupTabLabel = getInfiniteCanvasGroupTabLabel,
  hotkeyActions,
  hotkeyBindings,
  hud,
  icons,
  inputPolicy = DEFAULT_INFINITE_CANVAS_INPUT_POLICY,
  renderBackdrop,
  renderOverlay,
  renderUnderlay,
  sceneLayers = EMPTY_LIST,
  sceneSurface: SceneSurface,
  snapPolicy,
  subtitle = "",
  spatialTargetResolvers = EMPTY_LIST,
  theme,
  title = "",
  viewportInsets,
  viewportOccluders,
  windowDefinitions,
  zoomPolicy = resolveInfiniteCanvasZoomPolicy(),
}: InfiniteCanvasViewportProps<Kind, Payload>) {
  const canvasInstanceId = useId();
  // One grid owner at a time. The compositor draws it in world space when it is
  // mounted and the policy keeps it; otherwise the CSS backdrop does.
  const hasCompositorGrid = SceneSurface !== undefined && compositor.grid !== false;
  // Depend on fields because consumers can pass a new inline object each render.
  const chrome = useMemo(
    () => resolveInfiniteCanvasChromeMetrics(chromeInput),
    [
      chromeInput?.borderWidth,
      chromeInput?.cornerSize,
      chromeInput?.groupLabelSize,
      chromeInput?.headerAccentHeight,
      chromeInput?.headerHeight,
      chromeInput?.resizeHandleSize,
    ],
  );
  const rootRef = useRef<HTMLDivElement | null>(null);
  const commandSurfaceRef = useRef<HTMLDivElement | null>(null);
  const spacePanRef = useRef(false);
  const dragCaptureTargetRef = useRef<HTMLElement | null>(null);
  /** Last pointer position for paste placement. */
  const pastePointRef = useRef<InfiniteCanvasPoint | null>(null);
  const configuredPointerMode = getInfiniteCanvasPointerMode(inputPolicy);
  const [pointerModeOverride, setPointerModeOverride] = useState<InfiniteCanvasPointerMode | null>(
    null,
  );
  const [desktopPortalRoot, setDesktopPortalRoot] = useState<HTMLDivElement | null>(null);
  const [dropInteraction, setDropInteraction] = useState<
    InfiniteCanvasDropInteraction<Payload, Kind>
  >(EMPTY_INFINITE_CANVAS_DROP);
  const dropInteractionRef = useRef<InfiniteCanvasDropInteraction<Payload, Kind>>(dropInteraction);
  const store = useInfiniteCanvasStore<Kind>();
  const actions = useInfiniteCanvasActions<Kind>();
  const state = useInfiniteCanvasState<Kind>();

  // Set the resolver during render so HUD bounds are correct on first paint.
  store.setSpatialTargetResolvers(spatialTargetResolvers);
  const interaction = useInfiniteCanvasSelector<Kind, InfiniteCanvasInteraction>(
    (state) => state.interaction,
  );
  const pointerMode = pointerModeOverride ?? configuredPointerMode;
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
  // Keep cursor state local so pointer moves do not create store mutations.
  const [isOverSelectableTarget, setIsOverSelectableTarget] = useState(false);
  const cursor = getCanvasCursor(
    interaction,
    pointerMode,
    activeInputPolicy,
    isOverSelectableTarget,
  );
  const devicePixelRatio = useInfiniteCanvasDevicePixelRatio();
  useInfiniteCanvasSceneSurfaceWarning(sceneLayers.length, SceneSurface);
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
        snapPolicy,
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
            placement: dropTarget.placement,
            pointerId: current.pointerId,
            target: dropTarget.target,
            validation: dropTarget.validation,
            viewport: latestState.viewport,
            viewportPoint,
          });
    },
    [chrome, dropPolicy, snapPolicy, spatialTargetResolvers, store],
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
  // Read native drag data on each event because browsers expose files only at drop.
  const createDropInteractionFromNativeDrag = useCallback(
    (
      current: Extract<InfiniteCanvasDropInteraction<Payload, Kind>, { status: "dragging" }>,
      event: DragEvent,
      payload: Payload,
    ) => {
      const node = rootRef.current;
      const latestState = store.state$.peek() as InfiniteCanvasState<Kind>;
      const clientPoint = getClientPoint(event);
      const viewportPoint =
        node === null ? current.viewportPoint : getViewportPoint(node, clientPoint);
      const dropTarget = resolveInfiniteCanvasDragDropTarget({
        chrome,
        dropPolicy,
        payload,
        resolvers: spatialTargetResolvers,
        snapPolicy,
        state: latestState,
        viewportPoint,
      });

      return createInfiniteCanvasDropInteraction<Payload, Kind>({
        camera: latestState.camera,
        clientPoint,
        id: current.id,
        originClientPoint: current.originClientPoint,
        payload,
        placement: dropTarget.placement,
        pointerId: NATIVE_DROP_POINTER_ID,
        target: dropTarget.target,
        validation: dropTarget.validation,
        viewport: latestState.viewport,
        viewportPoint,
      });
    },
    [chrome, dropPolicy, snapPolicy, spatialTargetResolvers, store],
  );
  const startNativeDrag = useCallback(
    (event: DragEvent, payload: Payload) => {
      const node = rootRef.current;

      if (node === null) {
        return;
      }

      const latestState = store.state$.peek() as InfiniteCanvasState<Kind>;
      const clientPoint = getClientPoint(event);
      const viewportPoint = getViewportPoint(node, clientPoint);
      const dropTarget = resolveInfiniteCanvasDragDropTarget({
        chrome,
        dropPolicy,
        payload,
        resolvers: spatialTargetResolvers,
        snapPolicy,
        state: latestState,
        viewportPoint,
      });
      const next = createInfiniteCanvasDropInteraction<Payload, Kind>({
        camera: latestState.camera,
        clientPoint,
        id: NATIVE_DROP_INTERACTION_ID,
        originClientPoint: clientPoint,
        payload,
        placement: dropTarget.placement,
        pointerId: NATIVE_DROP_POINTER_ID,
        target: dropTarget.target,
        validation: dropTarget.validation,
        viewport: latestState.viewport,
        viewportPoint,
      });

      dropInteractionRef.current = next;
      setDropInteraction(next);
    },
    [chrome, dropPolicy, snapPolicy, spatialTargetResolvers, store],
  );
  /** Treats paste as a drop at the pointer or the visible-region center. */
  const commitPaste = useCallback(
    (event: ClipboardEvent, payload: Payload) => {
      const node = rootRef.current;

      if (node === null) {
        return;
      }

      const latestState = store.state$.peek() as InfiniteCanvasState<Kind>;
      const content = getInfiniteCanvasContentViewport(
        latestState.viewport,
        latestState.viewportInsets,
      );
      const viewportPoint = pastePointRef.current ?? {
        x: content.x + content.width / 2,
        y: content.y + content.height / 2,
      };
      const dropTarget = resolveInfiniteCanvasDragDropTarget({
        chrome,
        dropPolicy,
        payload,
        resolvers: spatialTargetResolvers,
        snapPolicy,
        state: latestState,
        viewportPoint,
      });

      const interaction = createInfiniteCanvasDropInteraction<Payload, Kind>({
        camera: latestState.camera,
        clientPoint: viewportPoint,
        id: NATIVE_DROP_INTERACTION_ID,
        originClientPoint: viewportPoint,
        payload,
        placement: dropTarget.placement,
        pointerId: NATIVE_DROP_POINTER_ID,
        target: dropTarget.target,
        validation: dropTarget.validation,
        viewport: latestState.viewport,
        viewportPoint,
      });

      if (interaction.status !== "dragging" || interaction.dropTarget.status !== "valid") {
        return;
      }

      event.preventDefault();
      dropPolicy?.onDrop?.({
        actions,
        dropTarget: interaction.dropTarget,
        payload,
        placement: interaction.placement,
        state: latestState,
        target: interaction.dropTarget.target,
        viewportPoint: interaction.viewportPoint,
        worldPoint: interaction.worldPoint,
      });
    },
    [actions, chrome, dropPolicy, snapPolicy, spatialTargetResolvers, store],
  );
  const cancelNativeDrag = useCallback(() => {
    dropInteractionRef.current = EMPTY_INFINITE_CANVAS_DROP;
    setDropInteraction(EMPTY_INFINITE_CANVAS_DROP);
  }, []);
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

  // Depend on fields because this value writes to the store.
  useEffect(() => {
    actions.setGroupMetrics({
      accordionHeaderSize: groupMetrics?.accordionHeaderSize,
      gutterSize: groupMetrics?.gutterSize,
      tabStripSize: groupMetrics?.tabStripSize,
    });
  }, [
    actions,
    groupMetrics?.accordionHeaderSize,
    groupMetrics?.gutterSize,
    groupMetrics?.tabStripSize,
  ]);

  useEffect(() => {
    actions.setViewportInsets({
      bottom: viewportInsets?.bottom ?? 0,
      left: viewportInsets?.left ?? 0,
      right: viewportInsets?.right ?? 0,
      top: viewportInsets?.top ?? 0,
    });
  }, [
    actions,
    viewportInsets?.bottom,
    viewportInsets?.left,
    viewportInsets?.right,
    viewportInsets?.top,
  ]);

  // The consumer must memoize this array because updates depend on its identity.
  useEffect(() => {
    actions.dispatch({ occluders: viewportOccluders ?? [], type: "viewportOccluders.set" });
  }, [actions, viewportOccluders]);

  useEffect(() => {
    const node = commandSurfaceRef.current;

    return node === null
      ? undefined
      : registerInfiniteCanvasHotkeys({
          actions: hotkeyActions,
          executeCommand: actions.executeCommand,
          getSelectionBounds: store.getSelectionBounds,
          getState: () => store.state$.peek() as InfiniteCanvasState<Kind>,
          bindings: hotkeyBindings,
          target: node,
        });
  }, [actions, hotkeyActions, hotkeyBindings, store]);

  useEffect(() => {
    const node = rootRef.current;

    if (node === null) {
      return;
    }

    const handleWheel = (event: WheelEvent) => {
      const state = store.state$.peek() as InfiniteCanvasState<Kind>;
      // A trackpad pinch uses `ctrlKey`. `metaKey` also prevents page zoom on macOS.
      const isZoomGesture = event.ctrlKey || event.metaKey;
      const isCanvasTarget = isCanvasWheelTarget(event.target, node);

      // Zoom gestures take priority over scrolling inside window bodies.
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
    // Keep listeners mounted so synchronous pointer sequences cannot lose events.
    const getInteractionForPointer = (pointerId: number) => {
      const current = (store.state$.peek() as InfiniteCanvasState<Kind>).interaction;

      return current !== null && current.pointerId === pointerId ? current : null;
    };
    const finishInteraction = (pointerId: number) => {
      const node = rootRef.current;

      if (node !== null) {
        releasePointer(node, pointerId);
      }

      stopEdgePan();
      actions.finishInteraction(pointerId);
    };
    /**
     * The pointer's last position, so a drag held still at an edge keeps
     * panning. The reducer only runs on an event, and a held pointer sends
     * none, so the frame loop replays this point until the drag ends or leaves
     * the band.
     */
    const held: {
      dockIntent: boolean;
      frame: number;
      point: InfiniteCanvasPoint | null;
      time: number;
    } = { dockIntent: false, frame: 0, point: null, time: 0 };

    const stopEdgePan = () => {
      if (held.frame !== 0) {
        cancelAnimationFrame(held.frame);
      }

      held.frame = 0;
      held.point = null;
    };

    const getEdgePanVelocity = (point: InfiniteCanvasPoint) => {
      const current = store.state$.peek() as InfiniteCanvasState<Kind>;

      // A pan interaction already moves the camera; panning it again fights the drag.
      return current.interaction === null || current.interaction.kind === "pan" || edgePan === false
        ? null
        : getInfiniteCanvasEdgePanVelocity(
            current.viewport,
            point,
            edgePan,
            current.viewportInsets,
          );
    };

    const stepEdgePan = (now: number) => {
      const point = held.point;
      const velocity = point === null ? null : getEdgePanVelocity(point);
      const interaction = (store.state$.peek() as InfiniteCanvasState<Kind>).interaction;

      if (point === null || velocity === null || interaction === null) {
        stopEdgePan();

        return;
      }

      // Cap the step so a stalled frame cannot fling the camera across the world.
      const seconds = Math.min((now - held.time) / 1000, MAX_EDGE_PAN_STEP_SECONDS);

      held.time = now;
      actions.panBy({ delta: { x: velocity.x * seconds, y: velocity.y * seconds } });
      // Re-step at the same point: the camera moved, so the drag has travelled.
      actions.stepInteraction({
        dockIntent: held.dockIntent,
        pointerId: interaction.pointerId,
        point,
      });
      held.frame = requestAnimationFrame(stepEdgePan);
    };

    const handlePointerMove = (event: PointerEvent) => {
      const node = rootRef.current;

      if (node === null || getInteractionForPointer(event.pointerId) === null) {
        return;
      }

      const point = getViewportPoint(node, getClientPoint(event));

      actions.stepInteraction({
        dockIntent: event.altKey,
        pointerId: event.pointerId,
        point,
      });

      held.dockIntent = event.altKey;
      held.point = point;

      if (getEdgePanVelocity(point) === null) {
        stopEdgePan();
      } else if (held.frame === 0) {
        held.time = performance.now();
        held.frame = requestAnimationFrame(stepEdgePan);
      }
    };
    const handlePointerUp = (event: PointerEvent) => {
      if (getInteractionForPointer(event.pointerId) !== null) {
        finishInteraction(event.pointerId);
      }
    };
    const handleBlur = () => {
      const current = (store.state$.peek() as InfiniteCanvasState<Kind>).interaction;

      if (current !== null) {
        finishInteraction(current.pointerId);
      }
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    window.addEventListener("blur", handleBlur);

    return () => {
      stopEdgePan();
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, [actions, edgePan, store]);

  useEffect(() => {
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
          // Commit the exact placement shown by the preview.
          placement: finalDropInteraction.placement,
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

  useEffect(() => {
    // Native drags use the same drop interaction as pointer drags.
    const node = rootRef.current;

    // Handle dragover only with a drop policy so rejected files cannot replace the page.
    if (node === null || dropPolicy === undefined) {
      return;
    }

    // Count nested dragenter and dragleave events before the drag ends.
    let depth = 0;
    // A `null` payload rejects the native drag.
    const readPayload = (event: DragEvent) =>
      getInfiniteCanvasNativeDropPayload(event.dataTransfer) as Payload | null;
    const updateFromDragEvent = (event: DragEvent, payload: Payload) => {
      const current = dropInteractionRef.current;

      if (current.status !== "dragging" || current.pointerId !== NATIVE_DROP_POINTER_ID) {
        return null;
      }

      const next = createDropInteractionFromNativeDrag(current, event, payload);

      dropInteractionRef.current = next;
      setDropInteraction(next);

      return next;
    };
    const handleDragEnter = (event: DragEvent) => {
      const payload = readPayload(event);

      if (payload === null) {
        return;
      }

      depth += 1;
      event.preventDefault();

      if (dropInteractionRef.current.status !== "dragging") {
        startNativeDrag(event, payload);
      }
    };
    const handleDragOver = (event: DragEvent) => {
      const payload = readPayload(event);

      if (payload === null) {
        return;
      }

      // Prevent the browser from replacing the page with the dropped file.
      event.preventDefault();

      const next = updateFromDragEvent(event, payload);

      if (event.dataTransfer !== null) {
        // Show the rejected drop cursor.
        event.dataTransfer.dropEffect =
          next?.status === "dragging" && next.dropTarget.status === "valid" ? "copy" : "none";
      }
    };
    const handleDragLeave = (event: DragEvent) => {
      if (readPayload(event) === null) {
        return;
      }

      depth = Math.max(0, depth - 1);

      if (depth === 0) {
        cancelNativeDrag();
      }
    };
    const handleDrop = (event: DragEvent) => {
      const payload = readPayload(event);

      if (payload === null) {
        return;
      }

      event.preventDefault();
      depth = 0;

      const final = updateFromDragEvent(event, payload);

      if (final?.status === "dragging" && final.dropTarget.status === "valid") {
        dropPolicy?.onDrop?.({
          actions,
          dropTarget: final.dropTarget,
          payload: final.payload,
          placement: final.placement,
          state: store.state$.peek() as InfiniteCanvasState<Kind>,
          target: final.dropTarget.target,
          viewportPoint: final.viewportPoint,
          worldPoint: final.worldPoint,
        });
      }

      cancelNativeDrag();
    };

    // Listen on the document because the canvas is not focusable. Ignore editable targets.
    const handlePaste = (event: ClipboardEvent) => {
      if (event.defaultPrevented || isEditableEventTarget(event.target)) {
        return;
      }

      const payload = getInfiniteCanvasNativeDropPayload(event.clipboardData) as Payload | null;

      if (payload !== null) {
        commitPaste(event, payload);
      }
    };
    const trackPastePoint = (event: PointerEvent) => {
      pastePointRef.current = getViewportPoint(node, getClientPoint(event));
    };
    const forgetPastePoint = () => {
      pastePointRef.current = null;
    };

    node.addEventListener("dragenter", handleDragEnter);
    node.addEventListener("dragover", handleDragOver);
    node.addEventListener("dragleave", handleDragLeave);
    node.addEventListener("drop", handleDrop);
    node.addEventListener("pointermove", trackPastePoint);
    node.addEventListener("pointerleave", forgetPastePoint);
    document.addEventListener("paste", handlePaste);

    return () => {
      node.removeEventListener("dragenter", handleDragEnter);
      node.removeEventListener("dragover", handleDragOver);
      node.removeEventListener("dragleave", handleDragLeave);
      node.removeEventListener("drop", handleDrop);
      node.removeEventListener("pointermove", trackPastePoint);
      node.removeEventListener("pointerleave", forgetPastePoint);
      document.removeEventListener("paste", handlePaste);
    };
  }, [
    actions,
    cancelNativeDrag,
    createDropInteractionFromNativeDrag,
    dropPolicy,
    startNativeDrag,
    store,
  ]);

  return (
    <InfiniteCanvasDesktopPortalContext.Provider value={desktopPortalRoot}>
      <InfiniteCanvasIconsContext.Provider value={resolvedIcons}>
        <InfiniteCanvasAnnouncer>
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
            onPointerLeave={() => {
              setIsOverSelectableTarget(false);
            }}
            onPointerMove={
              spatialTargetResolvers.length === 0
                ? undefined
                : (event) => {
                    if (interaction !== null) {
                      return;
                    }

                    const target = resolveSpatialTarget(
                      getViewportPoint(event.currentTarget, getClientPoint(event)),
                    );

                    setIsOverSelectableTarget(
                      getInfiniteCanvasSelectableTargetFromSpatialTarget(target) !== null,
                    );
                  }
            }
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
            // The window listener is the only pointer-move dispatcher.
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
              onKeyDown={(event) => {
                // Tab enters the active window. Shift+Tab remains available to leave the canvas.
                if (event.key !== "Tab" || event.shiftKey || state.activeWindowId === null) {
                  return;
                }

                const frame = document.getElementById(
                  getInfiniteCanvasWindowFrameElementId(canvasInstanceId, state.activeWindowId),
                );
                const body = frame?.querySelector<HTMLElement>(
                  "[data-infinite-canvas-body='true']",
                );

                if (body !== null && body !== undefined && focusInfiniteCanvasContent(body)) {
                  event.preventDefault();
                }
              }}
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
            {/* Keep fixed portals outside all canvas transforms. */}
            <div
              // This layer is outside the canvas keyboard scope, so modal Escape works.
              data-infinite-canvas-command-scope="ignore"
              data-slot={INFINITE_CANVAS_SLOTS.portalRoot}
              ref={setDesktopPortalRoot}
              style={{
                inset: 0,
                pointerEvents: "none",
                position: "absolute",
                zIndex: PORTAL_ROOT_Z_INDEX,
              }}
            />
            {renderBackdrop === undefined && !hasCompositorGrid ? (
              <InfiniteCanvasGridBackdrop />
            ) : null}
            {renderBackdrop === undefined ? null : (
              <div
                data-slot={INFINITE_CANVAS_SLOTS.grid}
                style={{ inset: 0, pointerEvents: "none", position: "absolute" }}
              >
                {renderBackdrop(overlayContext)}
              </div>
            )}
            {/* The underlay surface always mounts: the framework's own passes live there. */}
            {SceneSurface === undefined ? null : (
              <SceneSurface
                chrome={chrome}
                compositor={compositor}
                devicePixelRatio={devicePixelRatio}
                diagnostics={diagnostics}
                dropInteraction={dropInteraction}
                placement="underlay"
                spatialTargetResolvers={spatialTargetResolvers}
                theme={resolvedTheme}
                zIndex={SCENE_UNDERLAY_Z_INDEX}
              />
            )}
            {renderUnderlay === undefined ? null : (
              <div
                data-slot={INFINITE_CANVAS_SLOTS.underlay}
                style={{
                  inset: 0,
                  pointerEvents: "none",
                  position: "absolute",
                  zIndex: UNDERLAY_Z_INDEX,
                }}
              >
                {renderUnderlay(overlayContext)}
              </div>
            )}
            <InfiniteCanvasGroupLayer
              canvasInstanceId={canvasInstanceId}
              devicePixelRatio={devicePixelRatio}
              groupLabel={groupLabel}
              labelSize={chrome.groupLabelSize}
              resizeHandleSize={chrome.resizeHandleSize}
              tabLabel={groupTabLabel}
              zIndex={GROUP_LAYER_Z_INDEX}
            />
            <InfiniteCanvasWindowLayer
              canvasInstanceId={canvasInstanceId}
              chrome={chrome}
              devicePixelRatio={devicePixelRatio}
              stackBands={DEFAULT_INFINITE_CANVAS_STACK_BANDS}
              theme={resolvedTheme}
              windowDefinitions={windowDefinitions}
              zIndex={WINDOW_LAYER_Z_INDEX}
            />
            {SceneSurface === undefined ||
            !hasInfiniteCanvasOverlayPass({
              hasDropPolicy: dropPolicy !== undefined,
              policy: compositor,
            }) ? null : (
              <SceneSurface
                chrome={chrome}
                compositor={compositor}
                devicePixelRatio={devicePixelRatio}
                diagnostics={diagnostics}
                dropInteraction={dropInteraction}
                placement="overlay"
                spatialTargetResolvers={spatialTargetResolvers}
                theme={resolvedTheme}
                zIndex={SCENE_OVERLAY_Z_INDEX}
              />
            )}
            <InfiniteCanvasRevealedChangeOverlay devicePixelRatio={devicePixelRatio} />
            <InfiniteCanvasSelectionBoundsOverlay devicePixelRatio={devicePixelRatio} />
            <InfiniteCanvasDockPreviewOverlay devicePixelRatio={devicePixelRatio} />
            <InfiniteCanvasSnapOverlay devicePixelRatio={devicePixelRatio} />
            <InfiniteCanvasDropSnapOverlay
              devicePixelRatio={devicePixelRatio}
              drop={dropInteraction}
            />
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
        </InfiniteCanvasAnnouncer>
      </InfiniteCanvasIconsContext.Provider>
    </InfiniteCanvasDesktopPortalContext.Provider>
  );
}

function InfiniteCanvasWindowLayer<Kind extends string>({
  canvasInstanceId,
  chrome,
  devicePixelRatio,
  stackBands,
  theme,
  windowDefinitions,
  zIndex = WINDOW_LAYER_Z_INDEX,
}: Readonly<{
  /** Canvas token that namespaces frame ids used by `aria-controls`. */
  canvasInstanceId?: string;
  chrome: InfiniteCanvasChromeMetrics;
  devicePixelRatio: number;
  stackBands: InfiniteCanvasStackBands;
  theme: InfiniteCanvasTheme;
  windowDefinitions: InfiniteCanvasWindowRegistry<Kind>;
  zIndex?: number;
}>) {
  const fallbackInstanceId = useId();
  const resolvedInstanceId = canvasInstanceId ?? fallbackInstanceId;
  const state = useInfiniteCanvasState<Kind>();
  // Grouped windows omit resize handles because handles can cover the gutter.
  const { hiddenWindowIds, windowRects } = useMemo(
    () => getInfiniteCanvasGroupProjection(state.groups, state.groupMetrics),
    [state.groupMetrics, state.groups],
  );
  const admittedWindowIds = useMemo(
    () => getInfiniteCanvasWorkspaceWindowIds(state),
    [state.activeWorkspaceId, state.workspaces],
  );
  // Keep DOM order stable. The z-index controls visual stacking.
  const visibleWindows = useMemo(
    () =>
      state.windows.filter(
        (window): window is InfiniteCanvasWindow<Kind> =>
          window.mode !== "minimized" &&
          !hiddenWindowIds.has(window.id) &&
          (admittedWindowIds === null || admittedWindowIds.has(window.id)) &&
          isRegisteredInfiniteCanvasWindow(windowDefinitions, window),
      ),
    [admittedWindowIds, hiddenWindowIds, state.windows, windowDefinitions],
  );

  return (
    <div style={{ inset: 0, pointerEvents: "none", position: "absolute", zIndex }}>
      {visibleWindows.map((window) => (
        <InfiniteCanvasWindowFrame
          camera={state.camera}
          canvasInstanceId={resolvedInstanceId}
          chrome={chrome}
          devicePixelRatio={devicePixelRatio}
          isActive={state.activeWindowId === window.id}
          isGrouped={windowRects.has(window.id)}
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

/** Screen-pixel wheel amount for one line-mode step. */
const WHEEL_LINE_HEIGHT_PX = 40;

/** Converts wheel delta units to screen pixels. */
function getWheelScreenDelta(
  event: Pick<WheelEvent, "deltaMode" | "deltaX" | "deltaY">,
  viewport: InfiniteCanvasState["viewport"],
): InfiniteCanvasPoint {
  switch (event.deltaMode) {
    case WheelEvent.DOM_DELTA_LINE:
      return {
        x: event.deltaX * WHEEL_LINE_HEIGHT_PX,
        y: event.deltaY * WHEEL_LINE_HEIGHT_PX,
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
  isOverSelectableTarget = false,
): CSSProperties["cursor"] {
  if (interaction === null) {
    // Consumer targets have no DOM element for cursor styles.
    return isOverSelectableTarget
      ? "pointer"
      : getInfiniteCanvasIdleCursor(inputPolicy, pointerMode);
  }

  // Consumers can override pan, move, and marquee cursors.
  if (
    interaction.kind === "resize" ||
    interaction.kind === "groupMove" ||
    interaction.kind === "groupGutter" ||
    interaction.kind === "groupResize"
  ) {
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
