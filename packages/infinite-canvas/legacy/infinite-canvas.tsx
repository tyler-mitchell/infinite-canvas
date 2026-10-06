"use client";

import { getSelectedWindowIds } from "./selection";
import type { ContextMenuPolicy } from "./types";
import type { InfiniteCanvasStoreOptions } from "./store";

import { applyModifiedPointerTargetSelection } from "./frame-slots";
import { InfiniteCanvasPalette, PaletteContext } from "./palette";
import { useComponentPalette } from "./use-component-palette";

import { useValue } from "@legendapp/state/react";
import { observablePrimitive, ObservableHint, type OpaqueObject } from "@legendapp/state";

import { getHotkeyManager } from "@tanstack/hotkeys";
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

import { useResizeObserver } from "use-resize-observer";

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
import {
  DEFAULT_INFINITE_CANVAS_COMPOSITOR,
  hasInfiniteCanvasOverlayPass,
  resolveInfiniteCanvasCompositorPolicy,
  type InfiniteCanvasCompositorPolicy,
  type InfiniteCanvasCompositorPolicyInput,
} from "./compositor/policy";
import {
  DEFAULT_INFINITE_CANVAS_INPUT_POLICY,
  DRAG_THRESHOLD_PX,
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
import { InfiniteCanvasCameraLayer } from "./camera-layer";
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
import { ComponentPreview } from "./react/component-preview";
import {
  getInfiniteCanvasGroupTabLabel,
  isInfiniteCanvasWindowGrouped,
  type InfiniteCanvasGroupTabLabel,
} from "./group-state";
import type { InfiniteCanvasGroup, InfiniteCanvasGroupMetricsInput } from "./types";
import {
  DEFAULT_INFINITE_CANVAS_ICONS,
  InfiniteCanvasIconsContext,
  type InfiniteCanvasIcons,
} from "./icons";
import { getInfiniteCanvasPointerOwnedIds, getInteractionCursor } from "./interaction";
import { InfiniteCanvasDesktopPortalContext } from "./portal";
import {
  getInfiniteCanvasIdleCursor,
  getInfiniteCanvasInteractionCursor,
  getInfiniteCanvasPointerMode,
  withInfiniteCanvasPointerMode,
} from "./input-policy";
import { focusInfiniteCanvasCommandSurface, registerInfiniteCanvasHotkeys } from "./keyboard";
import type { InfiniteCanvasHotkeyAction } from "./keyboard";
import type { InfiniteCanvasHotkeyBinding } from "./operations";
import {
  capturePointer,
  clearNativeTextSelection,
  getClientPoint,
  getViewportPoint,
  isInteractiveTarget,
  isPrimaryButton,
  releasePointer,
} from "./input";
import {
  getInfiniteCanvasSelectableTargetFromSpatialTarget,
  resolveInfiniteCanvasSpatialTarget,
} from "./spatial-target";
import {
  InfiniteCanvasProvider,
  useInfiniteCanvasDispatch,
  useInfiniteCanvasSelector,
  useInfiniteCanvasStore,
} from "./react/store";
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
} from "./types";

type InfiniteCanvasDesktopProps<
  Kind extends string = string,
  Payload = InfiniteCanvasDropPayload,
> = InfiniteCanvasStoreOptions<Kind> &
  Omit<InfiniteCanvasViewportProps<Kind, Payload>, "zoomPolicy" | "compositor" | "diagnostics"> &
  Readonly<{
    documentKey?: string;
    compositor?: InfiniteCanvasCompositorPolicyInput;
    diagnostics?: InfiniteCanvasDiagnosticsPolicyInput;
    rasterization?: InfiniteCanvasRasterizationPolicyInput | boolean;
  }>;

type InfiniteCanvasViewportProps<
  Kind extends string,
  Payload = InfiniteCanvasDropPayload,
> = Readonly<{
  children?: ReactNode;
  componentPalette?: boolean;
  groupContextMenu?: ContextMenuPolicy | false;
  tools?: CanvasToolsOptions<Kind>;
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
    context: Readonly<{
      group: InfiniteCanvasGroup;
      rect: InfiniteCanvasRect;
      windowRects: ReadonlyMap<string, InfiniteCanvasRect>;
      windows: readonly InfiniteCanvasWindow[];
    }>,
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
  sceneSurface?: InfiniteCanvasSceneSurface<Kind, Payload>;
  /** Store used for move, resize, and drop snapping. */
  snapPolicy?: InfiniteCanvasSnapPolicy;
  subtitle?: string;
  spatialTargetResolvers?: readonly InfiniteCanvasSpatialTargetResolver<Kind>[];
  theme?: Partial<InfiniteCanvasTheme>;
  title?: string;
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
            groupInsertion: placementInput.groupInsertion,
            contentSize: placementInput.contentSize,
            size: placementInput.size,
            snapPolicy: placementInput.snapPolicy ?? snapPolicy,
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

function InfiniteCanvasDesktop<Kind extends string, Payload = InfiniteCanvasDropPayload>(
  props: InfiniteCanvasDesktopProps<Kind, Payload>,
) {
  const zoomPolicy = useMemo(
    () => resolveInfiniteCanvasZoomPolicy(props.zoomPolicy),
    [props.zoomPolicy],
  );
  const rasterization = useMemo(
    () => resolveInfiniteCanvasRasterizationPolicy(props.rasterization),
    [props.rasterization],
  );
  const diagnostics = useMemo(
    () => resolveInfiniteCanvasDiagnosticsPolicy(props.diagnostics),
    [props.diagnostics],
  );
  const compositor = useMemo(
    () => resolveInfiniteCanvasCompositorPolicy(props.compositor),
    [props.compositor],
  );
  return (
    <InfiniteCanvasProvider {...props} key={props.documentKey} zoomPolicy={zoomPolicy}>
      <InfiniteCanvasDiagnosticsProvider policy={diagnostics}>
        <InfiniteCanvasRasterizationProvider policy={rasterization}>
          <InfiniteCanvasViewport
            {...props}
            zoomPolicy={zoomPolicy}
            diagnostics={diagnostics}
            compositor={compositor}
            title={props.title ?? "Infinite Canvas Framework"}
            subtitle={
              props.subtitle ?? "Composable WebGPU surface, DOM body seam, pure window model."
            }
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
  children,
  componentPalette,
  chrome: chromeInput,
  className,
  compositor = DEFAULT_INFINITE_CANVAS_COMPOSITOR,
  diagnostics = DEFAULT_INFINITE_CANVAS_DIAGNOSTICS,
  edgePan = DEFAULT_INFINITE_CANVAS_EDGE_PAN,
  dropPolicy: suppliedDropPolicy,
  groupContextMenu,
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
  sceneSurface: SceneSurface,
  snapPolicy,
  subtitle = "",
  spatialTargetResolvers = EMPTY_LIST,
  theme,
  title = "",
  tools = false,
  viewportInsets,
  viewportOccluders,
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
  const [dropInteraction$] = useState(() =>
    observablePrimitive<OpaqueObject<InfiniteCanvasDropInteraction<Payload, Kind>>>(
      ObservableHint.opaque(EMPTY_INFINITE_CANVAS_DROP),
    ),
  );
  const dropInteraction = useValue(dropInteraction$);
  const dragActivationRef = useRef<Readonly<{ activate: () => void; distance: number }> | null>(
    null,
  );
  const store = useInfiniteCanvasStore<Kind>();
  const windowDefinitions = useValue(store.windowDefinitions$);
  const dispatch = useInfiniteCanvasDispatch<Kind>();
  const palette = useComponentPalette({ store });
  const componentPreview = componentPalette ? palette.getPreview(dropInteraction) : null;
  const dropPolicy = suppliedDropPolicy ?? (componentPalette ? palette.dropPolicy : undefined);
  const hasDropPolicy = dropPolicy !== undefined;

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
  const createDropInteractionFromPointer = useStableCallback(
    (
      current: Pick<
        Extract<InfiniteCanvasDropInteraction<Payload, Kind>, { status: "dragging" }>,
        "id" | "originClientPoint" | "payload" | "pointerId"
      >,
      event: Pick<PointerEvent, "clientX" | "clientY">,
      payload: Payload = current.payload,
    ) => {
      const node = rootRef.current;
      if (node === null) return EMPTY_INFINITE_CANVAS_DROP;
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

      return createInfiniteCanvasDropInteraction<Payload, Kind>({
        camera: latestState.camera,
        clientPoint,
        id: current.id,
        originClientPoint: current.originClientPoint,
        payload,
        placement: dropTarget.placement,
        pointerId: current.pointerId,
        target: dropTarget.target,
        validation: dropTarget.validation,
        viewport: latestState.viewport,
        viewportPoint,
      });
    },
  );
  useLayoutEffect(() => {
    const current = dropInteraction$.peek();
    if (current.status !== "dragging") return;
    dropInteraction$.set(
      createDropInteractionFromPointer(current, {
        clientX: current.clientPoint.x,
        clientY: current.clientPoint.y,
      }),
    );
  }, [dropPolicy, createDropInteractionFromPointer, dropInteraction$]);

  const cancelDropDrag = useCallback(() => {
    dragActivationRef.current = null;
    const current = dropInteraction$.peek();

    if (current.status === "dragging") {
      releaseDropPointerCapture(current.pointerId);
    }

    dropInteraction$.set(EMPTY_INFINITE_CANVAS_DROP);
  }, [releaseDropPointerCapture, dropInteraction$]);
  const startDropDrag = useStableCallback(
    ({
      event,
      id,
      payload,
      onActivate,
      activationDistance = DRAG_THRESHOLD_PX,
    }: InfiniteCanvasDragStartInput<Payload>) => {
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
      dragActivationRef.current =
        onActivate === undefined ? null : { activate: onActivate, distance: activationDistance };

      const clientPoint = getClientPoint(event);
      dropInteraction$.set(
        createDropInteractionFromPointer(
          {
            id,
            originClientPoint: clientPoint,
            payload,
            pointerId: event.pointerId,
          },
          event,
        ),
      );
    },
  );
  const startNativeDrag = useStableCallback((event: DragEvent, payload: Payload) => {
    const clientPoint = getClientPoint(event);
    dropInteraction$.set(
      createDropInteractionFromPointer(
        {
          id: NATIVE_DROP_INTERACTION_ID,
          originClientPoint: clientPoint,
          payload,
          pointerId: NATIVE_DROP_POINTER_ID,
        },
        event,
      ),
    );
  });
  const commitDropInteraction = useStableCallback(
    (interaction: InfiniteCanvasDropInteraction<Payload, Kind>) => {
      if (interaction.status !== "dragging" || interaction.dropTarget.status !== "valid") return;
      dropPolicy?.onDrop?.({
        dispatch,
        dropTarget: interaction.dropTarget,
        payload: interaction.payload,
        placement: interaction.placement,
        state: store.state$.peek() as InfiniteCanvasState<Kind>,
        target: interaction.dropTarget.target,
        viewportPoint: interaction.viewportPoint,
        worldPoint: interaction.worldPoint,
      });
    },
  );
  /** Treats paste as a drop at the pointer or the visible-region center. */
  const commitPaste = useStableCallback((event: ClipboardEvent, payload: Payload) => {
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
    const bounds = node.getBoundingClientRect();
    const clientPoint = { x: bounds.left + viewportPoint.x, y: bounds.top + viewportPoint.y };
    const interaction = createDropInteractionFromPointer(
      {
        id: NATIVE_DROP_INTERACTION_ID,
        originClientPoint: clientPoint,
        payload,
        pointerId: NATIVE_DROP_POINTER_ID,
      },
      { clientX: clientPoint.x, clientY: clientPoint.y },
    );

    if (interaction.status !== "dragging" || interaction.dropTarget.status !== "valid") {
      return;
    }

    event.preventDefault();
    commitDropInteraction(interaction);
  });
  // The slot that renders an overlay adds the live state, so only a mounted overlay renders per
  // state change and the viewport itself does not subscribe to the state.
  const overlayContext = useMemo(
    () =>
      ({
        dispatch,
        cancelDrag: cancelDropDrag,
        drag: dropInteraction,
        resolveSpatialTarget,
        startDrag: startDropDrag,
      }) satisfies InfiniteCanvasOverlaySlotContext<Kind, Payload>,
    [dispatch, cancelDropDrag, dropInteraction, resolveSpatialTarget, startDropDrag],
  );

  useEffect(() => {
    setPointerModeOverride(null);
  }, [inputPolicy.emptyCanvasDrag]);

  useResizeObserver({
    box: "border-box",
    onResize: ({ height = 0, width = 0 }) => {
      dispatch({ type: "viewport.set", viewport: { height, width } });
    },
    ref: rootRef,
  });

  // Depend on fields because this value writes to the store.
  useEffect(() => {
    dispatch({
      type: "groupMetrics.set",
      metrics: {
        accordionHeaderSize: groupMetrics?.accordionHeaderSize,
        gutterSize: groupMetrics?.gutterSize,
        tabStripSize: groupMetrics?.tabStripSize,
      },
    });
  }, [
    dispatch,
    groupMetrics?.accordionHeaderSize,
    groupMetrics?.gutterSize,
    groupMetrics?.tabStripSize,
  ]);

  useEffect(() => {
    dispatch({
      type: "viewportInsets.set",
      insets: {
        bottom: viewportInsets?.bottom ?? 0,
        left: viewportInsets?.left ?? 0,
        right: viewportInsets?.right ?? 0,
        top: viewportInsets?.top ?? 0,
      },
    });
  }, [
    dispatch,
    viewportInsets?.bottom,
    viewportInsets?.left,
    viewportInsets?.right,
    viewportInsets?.top,
  ]);

  // The consumer must memoize this array because updates depend on its identity.
  useEffect(() => {
    dispatch({ occluders: viewportOccluders ?? [], type: "viewportOccluders.set" });
  }, [dispatch, viewportOccluders]);

  useEffect(() => {
    const node = commandSurfaceRef.current;

    return node === null
      ? undefined
      : registerInfiniteCanvasHotkeys({
          hotkeyActions,
          dispatch,
          isCommandEnabled: store.isCommandEnabled,
          getState: store.getState,
          bindings: hotkeyBindings ?? store.hotkeyBindings,
          target: node,
        });
  }, [dispatch, hotkeyActions, hotkeyBindings, store]);

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
        dispatch({
          type: "camera.panBy",
          delta: getWheelScreenDelta(event, state.viewport),
        });

        return;
      }

      dispatch({
        type: "camera.zoomAt",
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
  }, [dispatch, store, zoomPolicy]);

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

  const getEdgePanVelocity = useStableCallback((point: InfiniteCanvasPoint) => {
    const current = store.state$.peek() as InfiniteCanvasState<Kind>;

    // A pan interaction already moves the camera; panning it again fights the drag.
    return current.interaction === null || current.interaction.kind === "pan" || edgePan === false
      ? null
      : getInfiniteCanvasEdgePanVelocity(current.viewport, point, edgePan, current.viewportInsets);
  });

  useEffect(() => {
    // Keep listeners mounted so synchronous pointer sequences cannot lose events.
    const getInteractionForPointer = (pointerId: number) => {
      const current = (store.state$.peek() as InfiniteCanvasState<Kind>).interaction;

      return current !== null && current.pointerId === pointerId ? current : null;
    };
    const finishInteraction = (pointerId: number, cancelled = false) => {
      stopEdgePan();
      dispatch(cancelled ? { type: "desktop.cancel" } : { type: "interaction.finish", pointerId });
      const node = rootRef.current;

      if (node !== null) {
        releasePointer(node, pointerId);
      }
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
      dispatch({
        type: "camera.panBy",
        delta: { x: velocity.x * seconds, y: velocity.y * seconds },
      });
      // Re-step at the same point: the camera moved, so the drag has travelled.
      dispatch({
        type: "interaction.step",
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

      dispatch({
        type: "interaction.step",
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
        finishInteraction(event.pointerId, event.type === "pointercancel");
      }
    };
    const handleBlur = () => {
      const current = (store.state$.peek() as InfiniteCanvasState<Kind>).interaction;

      if (current !== null) {
        finishInteraction(current.pointerId, true);
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
  }, [dispatch, getEdgePanVelocity, store]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const current = dropInteraction$.peek();

      if (current.status !== "dragging" || event.pointerId !== current.pointerId) {
        return;
      }

      const activation = dragActivationRef.current;
      if (
        activation !== null &&
        Math.hypot(
          event.clientX - current.originClientPoint.x,
          event.clientY - current.originClientPoint.y,
        ) >= activation.distance
      ) {
        dragActivationRef.current = null;
      }
      const next = createDropInteractionFromPointer(current, event);
      dropInteraction$.set(next);
    };
    const finishDropDrag = (event: PointerEvent) => {
      const current = dropInteraction$.peek();

      if (current.status !== "dragging" || event.pointerId !== current.pointerId) {
        return;
      }

      try {
        const finalDropInteraction = createDropInteractionFromPointer(current, event);
        const activation = dragActivationRef.current;
        if (
          activation !== null &&
          Math.hypot(
            event.clientX - current.originClientPoint.x,
            event.clientY - current.originClientPoint.y,
          ) < activation.distance
        ) {
          cancelDropDrag();
          activation.activate();
          return;
        }
        dragActivationRef.current = null;

        commitDropInteraction(finalDropInteraction);
      } finally {
        cancelDropDrag();
      }
    };
    const escape = getHotkeyManager().register(
      "Escape",
      (event) => {
        if (dropInteraction$.peek().status === "dragging") {
          event.preventDefault();
          event.stopPropagation();
          cancelDropDrag();
        }
      },
      { target: window, ignoreInputs: false, preventDefault: false, stopPropagation: false },
    );

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", finishDropDrag);
    window.addEventListener("pointercancel", cancelDropDrag);
    window.addEventListener("blur", cancelDropDrag);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", finishDropDrag);
      window.removeEventListener("pointercancel", cancelDropDrag);
      escape.unregister();
      window.removeEventListener("blur", cancelDropDrag);
    };
  }, [
    dispatch,
    cancelDropDrag,
    createDropInteractionFromPointer,
    commitDropInteraction,
    releaseDropPointerCapture,
    store,
    dropInteraction$,
  ]);

  useEffect(() => {
    // Native drags use the same drop interaction as pointer drags.
    const node = rootRef.current;

    // Handle dragover only with a drop policy so rejected files cannot replace the page.
    if (node === null || !hasDropPolicy) {
      return;
    }

    // Count nested dragenter and dragleave events before the drag ends.
    let depth = 0;
    // A `null` payload rejects the native drag.
    const readPayload = (event: DragEvent) =>
      getInfiniteCanvasNativeDropPayload(event.dataTransfer) as Payload | null;
    const updateFromDragEvent = (event: DragEvent, payload: Payload) => {
      const current = dropInteraction$.peek();

      if (current.status !== "dragging" || current.pointerId !== NATIVE_DROP_POINTER_ID) {
        return null;
      }

      const next = createDropInteractionFromPointer(current, event, payload);

      dropInteraction$.set(next);

      return next;
    };
    const handleDragEnter = (event: DragEvent) => {
      const payload = readPayload(event);

      if (payload === null) {
        return;
      }

      depth += 1;
      event.preventDefault();

      if (dropInteraction$.peek().status !== "dragging") {
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
        cancelDropDrag();
      }
    };
    const handleDrop = (event: DragEvent) => {
      const payload = readPayload(event);

      if (payload === null) {
        return;
      }

      event.preventDefault();
      depth = 0;

      try {
        const final = updateFromDragEvent(event, payload);

        if (final !== null) commitDropInteraction(final);
      } finally {
        cancelDropDrag();
      }
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
    dispatch,
    cancelDropDrag,
    hasDropPolicy,
    commitDropInteraction,
    commitPaste,
    createDropInteractionFromPointer,
    startNativeDrag,
    store,
    dropInteraction$,
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
              if (store.state$.peek().interaction?.pointerId === event.pointerId)
                dispatch({ type: "desktop.cancel" });
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
                  applyModifiedPointerTargetSelection(dispatch, event, selectableTarget);

                  return;
                }
              }

              const selectionExists = getSelectedWindowIds(getState().selection).length > 0;
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
                dispatch({
                  type: "interaction.startPan",
                  clearSelection: shouldClearSelectionOnPanStart(event, spacePanRef.current),
                  pointerId: event.pointerId,
                  point,
                });
              } else {
                dispatch({
                  type: "interaction.startMarquee",
                  mode: getMarqueeMode(event),
                  pointerId: event.pointerId,
                  point,
                });
              }
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
                const { activeWindowId } = getState();

                if (event.key !== "Tab" || event.shiftKey || activeWindowId === null) {
                  return;
                }

                const frame = document.getElementById(
                  getInfiniteCanvasWindowFrameElementId(canvasInstanceId, activeWindowId),
                );
                const body = frame?.querySelector<HTMLElement>(
                  "[data-infinite-canvas-body='true']",
                );

                if (body !== null && body !== undefined) {
                  body.focus({ preventScroll: true });
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
                <InfiniteCanvasOverlaySlot context={overlayContext} render={renderBackdrop} />
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
                <InfiniteCanvasOverlaySlot context={overlayContext} render={renderUnderlay} />
              </div>
            )}
            <InfiniteCanvasGroupLayer
              canvasInstanceId={canvasInstanceId}
              groupContextMenu={groupContextMenu}
              dropGroupId={
                dropInteraction.status === "dragging" &&
                dropInteraction.dropTarget.status === "valid"
                  ? dropInteraction.placement?.groupInsertion?.groupId
                  : undefined
              }
              groupLabel={groupLabel}
              labelSize={chrome.groupLabelSize}
              resizeHandleSize={chrome.resizeHandleSize}
              tabLabel={groupTabLabel}
              zIndex={GROUP_LAYER_Z_INDEX}
            />
            {componentPreview === null ? null : (
              <ComponentPreview
                {...componentPreview}
                canvasInstanceId={canvasInstanceId}
                chrome={chrome}
                theme={resolvedTheme}
                onMeasure={palette.measure}
              />
            )}
            <InfiniteCanvasWindowLayer
              canvasInstanceId={canvasInstanceId}
              chrome={chrome}
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
            {tools === false ? null : (
              <InfiniteCanvasTools tools={tools === true ? undefined : tools} />
            )}
            <InfiniteCanvasSelectionBoundsOverlay devicePixelRatio={devicePixelRatio} />
            <InfiniteCanvasDockPreviewOverlay devicePixelRatio={devicePixelRatio} />
            <InfiniteCanvasSnapOverlay devicePixelRatio={devicePixelRatio} />
            <InfiniteCanvasDropSnapOverlay
              devicePixelRatio={devicePixelRatio}
              drop={dropInteraction}
            />
            <InfiniteCanvasMarqueeOverlay />
            <PaletteContext value={{ palette, context: overlayContext }}>{children}</PaletteContext>
            {renderOverlay === undefined ? null : (
              <InfiniteCanvasOverlaySlot context={overlayContext} render={renderOverlay} />
            )}
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

type InfiniteCanvasOverlaySlotContext<Kind extends string, Payload> = Omit<
  InfiniteCanvasOverlayRenderContext<Kind, Payload>,
  "contextualCommands"
>;

/** Renders one consumer overlay. Overlays subscribe to the state they read. */
function InfiniteCanvasOverlaySlot<Kind extends string, Payload>({
  context,
  render,
}: Readonly<{
  context: InfiniteCanvasOverlaySlotContext<Kind, Payload>;
  render: (context: InfiniteCanvasOverlayRenderContext<Kind, Payload>) => ReactNode;
}>) {
  const store = useInfiniteCanvasStore<Kind>();

  return render({
    ...context,
    // Computed when an overlay reads it.
    get contextualCommands() {
      return store.getContextualCommands();
    },
  });
}

function InfiniteCanvasWindowLayerContent<Kind extends string>({
  canvasInstanceId,
  chrome,
  stackBands,
  theme,
  windowDefinitions,
  zIndex = WINDOW_LAYER_Z_INDEX,
}: Readonly<{
  /** Canvas token that namespaces frame ids used by `aria-controls`. */
  canvasInstanceId?: string;
  chrome: InfiniteCanvasChromeMetrics;
  stackBands: InfiniteCanvasStackBands;
  theme: InfiniteCanvasTheme;
  windowDefinitions: InfiniteCanvasWindowRegistry<Kind>;
  zIndex?: number;
}>) {
  const fallbackInstanceId = useId();
  const resolvedInstanceId = canvasInstanceId ?? fallbackInstanceId;
  const store = useInfiniteCanvasStore<Kind>();
  const windows = useValue(store.state$.windows);
  const groups = useValue(store.state$.groups);
  const activeWindowId = useValue(store.state$.activeWindowId);
  const selectedWindowIds = useValue(() => getSelectedWindowIds(store.state$.selection.get()));
  const selectedWindowIdSet = new Set(selectedWindowIds);
  const interaction = useValue(store.state$.interaction);
  const zoom = useValue(store.state$.camera.zoom);
  const canvasLayout = useValue(store.layout$);
  // Keep DOM order stable. The z-index controls visual stacking.
  const visibleWindows = useMemo(
    () =>
      windows.filter((window): window is InfiniteCanvasWindow<Kind> =>
        canvasLayout.visibleWindowIds.has(window.id),
      ),
    [canvasLayout.visibleWindowIds, windows],
  );
  const pointerOwned = useMemo(
    () => getInfiniteCanvasPointerOwnedIds(store.state$.peek() as InfiniteCanvasState<Kind>),
    [groups, interaction, store],
  );

  return (
    <InfiniteCanvasCameraLayer zIndex={zIndex}>
      {visibleWindows.map((window) => {
        const rect = canvasLayout.windowRects.get(window.id);
        if (rect === undefined) return null;
        return (
          <InfiniteCanvasWindowFrame
            canvasInstanceId={resolvedInstanceId}
            chrome={chrome}
            isActive={activeWindowId === window.id}
            isGrouped={isInfiniteCanvasWindowGrouped(store.state$.peek(), window.id)}
            isPointerOwned={pointerOwned.windowIds.has(window.id)}
            isSelected={selectedWindowIdSet.has(window.id)}
            key={window.id}
            rect={rect}
            stackBands={stackBands}
            theme={theme}
            window={window}
            windowDefinitions={windowDefinitions}
            zoom={zoom}
          />
        );
      })}
    </InfiniteCanvasCameraLayer>
  );
}

const InfiniteCanvasWindowLayer = memo(
  InfiniteCanvasWindowLayerContent,
) as typeof InfiniteCanvasWindowLayerContent;

function isCanvasPanTarget(
  target: EventTarget | null,
  viewport: HTMLElement,
  dragIntent: "marquee" | "pan",
) {
  if (!(target instanceof Element) || !viewport.contains(target)) {
    return target === viewport;
  }

  if (isInteractiveTarget(target)) {
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
    interaction.kind === "groupGutter" ||
    interaction.kind === "groupResize"
  ) {
    return getInteractionCursor(interaction);
  }

  return getInfiniteCanvasInteractionCursor(
    inputPolicy,
    interaction.kind === "groupReorder" ? "move" : interaction.kind,
  );
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
  Palette: InfiniteCanvasPalette,
  Desktop: InfiniteCanvasDesktop,
  Hud: InfiniteCanvasHud,
  Provider: InfiniteCanvasProvider,
  Viewport: InfiniteCanvasViewport,
  WindowLayer: InfiniteCanvasWindowLayer,
} as const;

export {
  InfiniteCanvas,
  InfiniteCanvasDesktop,
  InfiniteCanvasHud,
  InfiniteCanvasViewport,
  InfiniteCanvasWindowLayer,
};

export type { InfiniteCanvasDesktopProps, InfiniteCanvasViewportProps };
import type { InfiniteCanvasRect } from "./types";
import type { CanvasToolsOptions } from "./tools";
import { InfiniteCanvasTools } from "./react/tools";
import { useStableCallback } from "@base-ui/utils/useStableCallback";
