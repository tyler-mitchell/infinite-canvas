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

import { InfiniteCanvasHud } from "./canvas-hud";
import {
  InfiniteCanvasDockPreviewOverlay,
  InfiniteCanvasDropSnapOverlay,
  InfiniteCanvasMarqueeOverlay,
  InfiniteCanvasSelectionBoundsOverlay,
  InfiniteCanvasSnapOverlay,
} from "./canvas-overlays";
import { getInfiniteCanvasWindowFrameElementId, INFINITE_CANVAS_SLOTS } from "./data-attributes";
import { getInfiniteCanvasWorkspaceWindowIds } from "./workspace";
import { focusInfiniteCanvasContent } from "./focus-trap";
import {
  DEFAULT_INFINITE_CANVAS_INPUT_POLICY,
  DEFAULT_INFINITE_CANVAS_STACK_BANDS,
  DEFAULT_INFINITE_CANVAS_THEME,
  resolveInfiniteCanvasChromeMetrics,
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
import { getInfiniteCanvasContentViewport, getWheelZoomFactor } from "./geometry";
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
import { SCENE_UNDERLAY_Z_INDEX, getSceneLayers } from "./scene-surface";
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
  diagnostics?: InfiniteCanvasDiagnosticsPolicyInput;
  documentKey?: string;
  dropPolicy?: InfiniteCanvasDropPolicy<Kind, Payload>;
  /**
   * Chords for verbs the canvas does not have. Added to its keymap, unlike `hotkeyBindings` which
   * replaces. Canvas scope rules apply, so a chord in a window body does not fire.
   */
  hotkeyActions?: readonly InfiniteCanvasHotkeyAction<Kind>[];
  hotkeyBindings?: readonly InfiniteCanvasHotkeyBinding[];
  hud?: InfiniteCanvasHudPolicyInput;
  icons?: InfiniteCanvasIcons;
  initialState: InfiniteCanvasState<Kind>;
  inputPolicy?: InfiniteCanvasInputPolicy;
  rasterization?: InfiniteCanvasRasterizationPolicyInput | boolean;
  /**
   * Replaces the default grid, beneath every window. Outside the world transform, so project with
   * `worldPointToScreenPoint`. Takes no pointer events.
   */
  renderBackdrop?: (context: InfiniteCanvasOverlayReadContext<Kind, Payload>) => ReactNode;
  /** World content beneath the windows: connectors, annotations, ink. Above the backdrop. */
  renderUnderlay?: (context: InfiniteCanvasOverlayReadContext<Kind, Payload>) => ReactNode;
  renderOverlay?: (context: InfiniteCanvasOverlayRenderContext<Kind, Payload>) => ReactNode;
  sceneLayers?: readonly InfiniteCanvasSceneLayer<Kind, Payload>[];
  /**
   * Paints `sceneLayers`. Pass `InfiniteCanvasWebGpuSurface` from
   * `@hyphened/infinite-canvas/scene`. Without it, scene layers are inert and `three` stays out
   * of the bundle.
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
  chrome?: InfiniteCanvasChromeMetricsInput;
  className?: string;
  diagnostics?: InfiniteCanvasDiagnosticsPolicy;
  /** Screen space the consumer's chrome covers, per edge. Without it, fitting aims at the element
   * middle and puts content behind a panel. */
  viewportInsets?: InfiniteCanvasViewportInsetsInput;
  /**
   * Chrome inside the content area, as screen rects. An inset is one number per edge and only
   * describes a band, so a floating minimap needs this. Placement steps around these; framing
   * ignores them. Memoize an inline array — depended on by identity.
   */
  viewportOccluders?: readonly InfiniteCanvasViewportOccluder[];
  dropPolicy?: InfiniteCanvasDropPolicy<Kind, Payload>;
  /**
   * Tab strip height, split seam width, accordion header extent. Goes to the store, not the layer
   * — the reducer places member windows from the same value.
   */
  groupMetrics?: InfiniteCanvasGroupMetricsInput;
  /**
   * Frame label above a group. Defaults to `getInfiniteCanvasGroupTitle`. Return `""` for no
   * label; `chrome.groupLabelSize` turns them all off.
   */
  groupLabel?: (
    context: Readonly<{ group: InfiniteCanvasGroup; windows: readonly InfiniteCanvasWindow[] }>,
  ) => string;
  /** Tab and accordion header names. Defaults to the window's `title`. */
  groupTabLabel?: InfiniteCanvasGroupTabLabel;
  /** Chords for verbs the canvas does not have. Added to its keymap, never replacing it. */
  hotkeyActions?: readonly InfiniteCanvasHotkeyAction<Kind>[];
  hotkeyBindings?: readonly InfiniteCanvasHotkeyBinding[];
  hud?: InfiniteCanvasHudPolicyInput;
  icons?: InfiniteCanvasIcons;
  inputPolicy?: InfiniteCanvasInputPolicy;
  /**
   * Replaces the default grid, beneath every window. Outside the world transform, so project with
   * `worldPointToScreenPoint`. Takes no pointer events.
   */
  renderBackdrop?: (context: InfiniteCanvasOverlayReadContext<Kind, Payload>) => ReactNode;
  /** World content beneath the windows: connectors, annotations, ink. Above the backdrop. */
  renderUnderlay?: (context: InfiniteCanvasOverlayReadContext<Kind, Payload>) => ReactNode;
  renderOverlay?: (context: InfiniteCanvasOverlayRenderContext<Kind, Payload>) => ReactNode;
  sceneLayers?: readonly InfiniteCanvasSceneLayer<Kind, Payload>[];
  sceneSurface?: InfiniteCanvasSceneSurface<Kind, Payload>;
  /** Reaches the store for move/resize; the viewport needs it to snap a drop too. */
  snapPolicy?: InfiniteCanvasSnapPolicy;
  subtitle?: string;
  spatialTargetResolvers?: readonly InfiniteCanvasSpatialTargetResolver<Kind>[];
  theme?: Partial<InfiniteCanvasTheme>;
  title?: string;
  windowDefinitions: InfiniteCanvasWindowRegistry<Kind>;
  zoomPolicy?: InfiniteCanvasZoomPolicy;
}>;

const SCENE_SCREEN_UNDERLAY_Z_INDEX = 1;
/** Connectors, annotations, ink. */
const UNDERLAY_Z_INDEX = 2;
const GROUP_LAYER_Z_INDEX = 5;
const PORTAL_ROOT_Z_INDEX = DEFAULT_INFINITE_CANVAS_STACK_BANDS.overlay + 1;
const WINDOW_LAYER_Z_INDEX = 10;
const SCENE_OVERLAY_Z_INDEX = DEFAULT_INFINITE_CANVAS_STACK_BANDS.overlay - 10;
const SCENE_SCREEN_OVERLAY_Z_INDEX = DEFAULT_INFINITE_CANVAS_STACK_BANDS.overlay - 9;

/** Mirrors theme.css's bridged token block. */
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
      "`@hyphened/infinite-canvas/scene`, and install the `three` and `@react-three/fiber` peers."
    );
  }

  if (frustumDiagnostics) {
    return (
      "[infinite-canvas] `diagnostics.frustum` needs a `sceneSurface` to run its probes. Pass " +
      "`sceneSurface={InfiniteCanvasWebGpuSurface}` from `@hyphened/infinite-canvas/scene`."
    );
  }

  return null;
}

// Local, so the package does not leak a `@types/node` requirement onto consumers.
declare const process: Readonly<{ env: Readonly<{ NODE_ENV?: string }> }>;

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
    // Snapped against the same candidates a window move snaps against, using the
    // same resolver. The guides were always being computed here; they were just
    // never handed to anyone.
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
  // Forwarded unresolved; `Viewport` merges it over the defaults.
  chrome,
  className,
  diagnostics,
  documentKey,
  dropPolicy,
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
            hotkeyActions={hotkeyActions}
            hotkeyBindings={hotkeyBindings}
            hud={hud}
            snapPolicy={snapPolicy}
            icons={icons}
            inputPolicy={inputPolicy}
            renderBackdrop={renderBackdrop}
            renderUnderlay={renderUnderlay}
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

/**
 * A drag from outside the page has no pointer, and the drop machinery is keyed by one. Negative
 * because no real `pointerId` is, so a mouse moving during a native drag cannot be mistaken for it.
 */
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

/** The canvas itself, mountable without `InfiniteCanvasDesktop`. Every policy prop defaults here. */
function InfiniteCanvasViewport<Kind extends string, Payload = InfiniteCanvasDropPayload>({
  chrome: chromeInput,
  className,
  diagnostics = DEFAULT_INFINITE_CANVAS_DIAGNOSTICS,
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
  sceneLayers = [],
  sceneSurface: SceneSurface,
  snapPolicy,
  subtitle = "",
  spatialTargetResolvers = [],
  theme,
  title = "",
  viewportInsets,
  viewportOccluders,
  windowDefinitions,
  zoomPolicy = resolveInfiniteCanvasZoomPolicy(),
}: InfiniteCanvasViewportProps<Kind, Payload>) {
  const canvasInstanceId = useId();
  // Field deps, not object identity: an inline `chrome={{ headerHeight: 32 }}` is a new object
  // every render, and window geometry memoizes on this.
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
  /** Last pointer position, so a paste lands where the user is looking. */
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
  // Local rather than in the store: a store write per pointermove would make every mouse movement
  // a state mutation, and mutations are undo checkpoints. Leaves this component as a cursor string.
  const [isOverSelectableTarget, setIsOverSelectableTarget] = useState(false);
  const cursor = getCanvasCursor(
    interaction,
    pointerMode,
    activeInputPolicy,
    isOverSelectableTarget,
  );
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
  // Separate from `createDropInteractionFromPointer`, which carries its payload forward. File
  // contents are withheld until the drop, so the payload is re-read each event.
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
  /**
   * A paste is a drop with no drag in front of it — same `DataTransfer`, so the same payload
   * reader, but nothing to preview or cancel. Lands under the pointer, or at the middle of what is
   * visible when the paste came from the keyboard alone.
   */
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

      // Refused. Leave the paste to the browser.
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

  // Field deps: an inline object is new every render, and this writes to the store.
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

  // Identity deps, unlike the insets: a list of rects has no fixed fields. Consumer must memoize.
  // Dispatch is idempotent, so failing to costs a re-render, not a loop.
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
      // A macOS trackpad pinch arrives as a wheel event with `ctrlKey` synthesized, so pinch and
      // Ctrl+wheel are one path. `metaKey` catches Cmd+wheel, which would otherwise page-zoom.
      const isZoomGesture = event.ctrlKey || event.metaKey;
      const isCanvasTarget = isCanvasWheelTarget(event.target, node);

      // Zoom outranks a scrollable body: a plain wheel over a `native-scroll` body scrolls it, a
      // zoom gesture over the same body zooms the canvas.
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
    // Mount-scoped, not gated on `interaction`. Gating attaches listeners only after React commits
    // the pointerdown, so a synchronous `down -> move -> up` loses the move. Peeking the store is
    // the only read that is never a frame stale.
    const getInteractionForPointer = (pointerId: number) => {
      const current = (store.state$.peek() as InfiniteCanvasState<Kind>).interaction;

      return current !== null && current.pointerId === pointerId ? current : null;
    };
    const finishInteraction = (pointerId: number) => {
      const node = rootRef.current;

      if (node !== null) {
        releasePointer(node, pointerId);
      }

      actions.finishInteraction(pointerId);
    };
    const handlePointerMove = (event: PointerEvent) => {
      const node = rootRef.current;

      if (node === null || getInteractionForPointer(event.pointerId) === null) {
        return;
      }

      actions.stepInteraction({
        dockIntent: event.altKey,
        pointerId: event.pointerId,
        point: getViewportPoint(node, getClientPoint(event)),
      });
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
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, [actions, store]);

  useEffect(() => {
    // Mount-scoped for the same reason: `startDrag` writes the ref synchronously.
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
          // The object the preview drew, not a fresh computation.
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
    // Native drags become the same interaction the pointer path produces, so `canDrop`,
    // placement, and snapping work unchanged. On the viewport element, not the window.
    const node = rootRef.current;

    // Inert without a `dropPolicy`: validation defaults to accepted, and `dragover` must
    // `preventDefault` or the browser navigates to the file.
    if (node === null || dropPolicy === undefined) {
      return;
    }

    // `dragenter`/`dragleave` fire per element crossed inside the canvas, so count depth.
    let depth = 0;
    // The only gate. `null` means the drag carries nothing describable.
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

      // Or the browser navigates to the file, replacing the app.
      event.preventDefault();

      const next = updateFromDragEvent(event, payload);

      if (event.dataTransfer !== null) {
        // `none` makes the cursor show a rejected type as rejected.
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

    // On the document, since the canvas is not focusable. The editable guard stops the canvas
    // stealing a paste from a window's editor.
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
          // Only bound when resolvers exist. Skipped mid-drag.
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
          // No `onPointerMove`. Window listener is the single dispatcher and carries `dockIntent`.
          // Second handler double-dispatches. See `single-dispatcher.test.ts`.
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
              // Tab enters the active window's body (FR-9). Escape returns here. Shift+Tab
              // unclaimed, or the canvas is a keyboard trap.
              if (event.key !== "Tab" || event.shiftKey || state.activeWindowId === null) {
                return;
              }

              const frame = document.getElementById(
                getInfiniteCanvasWindowFrameElementId(canvasInstanceId, state.activeWindowId),
              );
              const body = frame?.querySelector<HTMLElement>("[data-infinite-canvas-body='true']");

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
          {/* Outside every transform, so `position: fixed` resolves against the viewport. */}
          <div
            // Outside the canvas keyboard scope, so a portalled modal gets Escape.
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
          {renderBackdrop === undefined ? (
            <InfiniteCanvasGridBackdrop />
          ) : (
            <div
              data-slot={INFINITE_CANVAS_SLOTS.grid}
              style={{ inset: 0, pointerEvents: "none", position: "absolute" }}
            >
              {renderBackdrop(overlayContext)}
            </div>
          )}
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
  /** Namespaces each frame's DOM `id` for a tab's `aria-controls`. Mints its own if omitted. */
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
  // `windowRects` keys every grouped window. Those get no resize handles — handles straddle pane
  // edges and would bury the gutter.
  const { hiddenWindowIds, windowRects } = useMemo(
    () => getInfiniteCanvasGroupProjection(state.groups, state.groupMetrics),
    [state.groupMetrics, state.groups],
  );
  const admittedWindowIds = useMemo(
    () => getInfiniteCanvasWorkspaceWindowIds(state),
    [state.activeWorkspaceId, state.workspaces],
  );
  // Keep DOM order stable during focus changes; z-index owns visual stacking.
  const visibleWindows = useMemo(
    () =>
      state.windows.filter(
        (window): window is InfiniteCanvasWindow<Kind> =>
          window.mode !== "minimized" &&
          !hiddenWindowIds.has(window.id) &&
          // `null` means no active workspace, which admits everything.
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

/** Not a text line height. Firefox reports ~3 per notch, Chrome ~100px. 40 matches
 * `normalize-wheel`. Change this if the feel is wrong. */
const WHEEL_LINE_HEIGHT_PX = 40;

/** Wheel deltas in screen pixels, whatever unit the browser reported. */
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
    // Consumer targets are drawn, not DOM, so they have no element to hang a cursor on.
    return isOverSelectableTarget
      ? "pointer"
      : getInfiniteCanvasIdleCursor(inputPolicy, pointerMode);
  }

  // Structural cursors. Only pan/move/marquee are the consumer's to re-map.
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
