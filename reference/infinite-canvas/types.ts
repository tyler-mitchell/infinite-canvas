import type { RegisterableHotkey } from "@tanstack/hotkeys";
import type {
  ComponentType,
  CSSProperties,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from "react";

type InfiniteCanvasPoint = Readonly<{
  x: number;
  y: number;
}>;

type InfiniteCanvasSize = Readonly<{
  height: number;
  width: number;
}>;

type InfiniteCanvasRect = InfiniteCanvasPoint & InfiniteCanvasSize;

type InfiniteCanvasCamera = Readonly<{
  center: InfiniteCanvasPoint;
  zoom: number;
}>;

type InfiniteCanvasViewport = InfiniteCanvasSize;

type InfiniteCanvasResizeHandle =
  | "north"
  | "south"
  | "east"
  | "west"
  | "north-east"
  | "north-west"
  | "south-east"
  | "south-west";

type InfiniteCanvasWindowMode = "normal" | "minimized" | "maximized";

type InfiniteCanvasWindow<Kind extends string = string, Data = unknown> = Readonly<{
  data?: Data;
  id: string;
  isPinned: boolean;
  kind: Kind;
  minSize: InfiniteCanvasSize;
  mode: InfiniteCanvasWindowMode;
  rect: InfiniteCanvasRect;
  restoreRect?: InfiniteCanvasRect;
  title: string;
  zIndex: number;
}>;

type InfiniteCanvasSelection = Readonly<{
  anchorTarget?: InfiniteCanvasSelectionTarget | null;
  anchorWindowId: string | null;
  targets?: readonly InfiniteCanvasSelectionTarget[];
  windowIds: readonly string[];
}>;

type InfiniteCanvasSelectionTargetType = "edge" | "scene-object";

type InfiniteCanvasSelectionTarget = Readonly<{
  data?: unknown;
  id: string;
  kind: string;
  type: InfiniteCanvasSelectionTargetType;
}>;

type InfiniteCanvasSnapGuide = Readonly<{
  axis: "x" | "y";
  from: "viewport" | "window";
  id: string;
  kind: "center" | "edge" | "gap";
  position: number;
  sourceAnchor: "bottom" | "center" | "left" | "middle" | "right" | "top";
}>;

type InfiniteCanvasSnapPreview = Readonly<{
  guides: readonly InfiniteCanvasSnapGuide[];
  rect: InfiniteCanvasRect;
  windowId: string;
}>;

type InfiniteCanvasSnapPolicy = Readonly<{
  edgeInset: number;
  enabled: boolean;
  gapThreshold: number;
  releaseThreshold: number;
  snapToCenters: boolean;
  snapToGaps: boolean;
  snapToViewport: boolean;
  snapToWindows: boolean;
  threshold: number;
}>;

type InfiniteCanvasPanInteraction = Readonly<{
  kind: "pan";
  originCamera: InfiniteCanvasCamera;
  originPointer: InfiniteCanvasPoint;
  pointerId: number;
}>;

type InfiniteCanvasMarqueeMode = "add" | "replace" | "toggle";

type InfiniteCanvasMarqueeInteraction = Readonly<{
  currentPointer: InfiniteCanvasPoint;
  kind: "marquee";
  mode: InfiniteCanvasMarqueeMode;
  originPointer: InfiniteCanvasPoint;
  originSelectionIds: readonly string[];
  pointerId: number;
}>;

type InfiniteCanvasMoveOriginRect = Readonly<{
  rect: InfiniteCanvasRect;
  windowId: string;
}>;

type InfiniteCanvasMoveInteraction = Readonly<{
  kind: "move";
  originPointer: InfiniteCanvasPoint;
  originRect: InfiniteCanvasRect;
  originRects: readonly InfiniteCanvasMoveOriginRect[];
  pointerId: number;
  windowId: string;
  zoom: number;
}>;

type InfiniteCanvasResizeInteraction = Readonly<{
  handle: InfiniteCanvasResizeHandle;
  kind: "resize";
  originPointer: InfiniteCanvasPoint;
  originRect: InfiniteCanvasRect;
  pointerId: number;
  windowId: string;
  zoom: number;
}>;

type InfiniteCanvasInteraction =
  | InfiniteCanvasMarqueeInteraction
  | InfiniteCanvasPanInteraction
  | InfiniteCanvasMoveInteraction
  | InfiniteCanvasResizeInteraction
  | null;

type InfiniteCanvasState<Kind extends string = string> = Readonly<{
  activeWindowId: string | null;
  camera: InfiniteCanvasCamera;
  interaction: InfiniteCanvasInteraction;
  selection: InfiniteCanvasSelection;
  snapPreview: InfiniteCanvasSnapPreview | null;
  viewport: InfiniteCanvasViewport;
  windows: readonly InfiniteCanvasWindow<Kind>[];
}>;

type InfiniteCanvasSerializedState<Kind extends string = string> = Readonly<{
  activeWindowId: string | null;
  camera: InfiniteCanvasCamera;
  selection?: InfiniteCanvasSelection;
  version: 1;
  windows: readonly InfiniteCanvasWindow<Kind>[];
}>;

type InfiniteCanvasChromeMetrics = Readonly<{
  borderWidth: number;
  cornerSize: number;
  headerAccentHeight: number;
  headerHeight: number;
  resizeHandleSize: number;
}>;

type InfiniteCanvasZoomPolicy = Readonly<{
  defaultZoom: number;
  maxZoom: number;
  minZoom: number;
  step: number;
  wheelMaxExponent: number;
  wheelSensitivity: number;
}>;

type InfiniteCanvasZoomPolicyInput = Partial<InfiniteCanvasZoomPolicy>;

type InfiniteCanvasPointerMode = "marquee" | "pan";

type InfiniteCanvasEmptyCanvasDragMode = InfiniteCanvasPointerMode | "marqueeWhenSelectionExists";

type InfiniteCanvasCursor = CSSProperties["cursor"];

type InfiniteCanvasCursorInteraction = "marquee" | "move" | "pan";

type InfiniteCanvasCursorPolicy = Readonly<{
  idle?: Readonly<Partial<Record<InfiniteCanvasPointerMode, InfiniteCanvasCursor>>>;
  interaction?: Readonly<Partial<Record<InfiniteCanvasCursorInteraction, InfiniteCanvasCursor>>>;
}>;

type InfiniteCanvasInputPolicy = Readonly<{
  cursor?: InfiniteCanvasCursorPolicy;
  emptyCanvasDrag: InfiniteCanvasEmptyCanvasDragMode;
}>;

type InfiniteCanvasStackBands = Readonly<{
  overlay: number;
  pinned: number;
}>;

type InfiniteCanvasTheme = Readonly<{
  activeAccent: string;
  activeBorder: string;
  background: string;
  bodyBackground: string;
  gridMajor: string;
  gridMinor: string;
  headerActive: string;
  headerIdle: string;
  idleBorder: string;
  selectionBorder: string;
  selectionBounds: string;
}>;

type InfiniteCanvasWindowRenderContext<Kind extends string = string> = Readonly<{
  actions: InfiniteCanvasCommands<Kind>;
  isActive: boolean;
  isSelected: boolean;
  state: InfiniteCanvasState<Kind>;
  window: InfiniteCanvasWindow<Kind>;
}>;

type InfiniteCanvasSpatialWindowArea = "body" | "frame" | "header" | "resize-handle";

type InfiniteCanvasSpatialTarget<Kind extends string = string> =
  | Readonly<{
      type: "empty-world";
      viewportPoint: InfiniteCanvasPoint;
      worldPoint: InfiniteCanvasPoint;
    }>
  | Readonly<{
      area: InfiniteCanvasSpatialWindowArea;
      resizeHandle?: InfiniteCanvasResizeHandle;
      type: "window";
      viewportPoint: InfiniteCanvasPoint;
      window: InfiniteCanvasWindow<Kind>;
      windowId: string;
      worldPoint: InfiniteCanvasPoint;
    }>
  | Readonly<{
      data?: unknown;
      id: string;
      kind: string;
      type: "scene-object";
      viewportPoint: InfiniteCanvasPoint;
      worldPoint: InfiniteCanvasPoint;
    }>
  | Readonly<{
      data?: unknown;
      id: string;
      kind: string;
      type: "edge";
      viewportPoint: InfiniteCanvasPoint;
      worldPoint: InfiniteCanvasPoint;
    }>
  | Readonly<{
      data?: unknown;
      id: string;
      kind: string;
      type: "overlay";
      viewportPoint: InfiniteCanvasPoint;
      worldPoint: InfiniteCanvasPoint;
    }>;

type InfiniteCanvasResolvedSpatialTarget<Kind extends string = string> = Exclude<
  InfiniteCanvasSpatialTarget<Kind>,
  { type: "empty-world" }
>;

type InfiniteCanvasSpatialTargetResolverContext<Kind extends string = string> = Readonly<{
  chrome: InfiniteCanvasChromeMetrics;
  state: InfiniteCanvasState<Kind>;
  viewportPoint: InfiniteCanvasPoint;
  worldPoint: InfiniteCanvasPoint;
}>;

type InfiniteCanvasSpatialTargetResolverPhase = "after-windows" | "before-windows";

type InfiniteCanvasSpatialTargetResolver<Kind extends string = string> = Readonly<{
  id: string;
  phase?: InfiniteCanvasSpatialTargetResolverPhase;
  resolve: (
    context: InfiniteCanvasSpatialTargetResolverContext<Kind>,
  ) => InfiniteCanvasResolvedSpatialTarget<Kind> | null;
}>;

type InfiniteCanvasResolveSpatialTarget<Kind extends string = string> = (
  viewportPoint: InfiniteCanvasPoint,
) => InfiniteCanvasSpatialTarget<Kind>;

type InfiniteCanvasDropPayload = unknown;

type InfiniteCanvasDropValidationResult = Readonly<{
  accepted: boolean;
  reason?: string;
}>;

type InfiniteCanvasDropValidationInput = boolean | InfiniteCanvasDropValidationResult;

type InfiniteCanvasResolvedDropTarget<Kind extends string = string> =
  | Readonly<{
      status: "outside";
      target: null;
    }>
  | Readonly<{
      status: "valid";
      target: InfiniteCanvasSpatialTarget<Kind>;
    }>
  | Readonly<{
      reason?: string;
      status: "invalid";
      target: InfiniteCanvasSpatialTarget<Kind>;
    }>;

type InfiniteCanvasDropInteraction<
  Payload = InfiniteCanvasDropPayload,
  Kind extends string = string,
> =
  | Readonly<{
      status: "idle";
    }>
  | Readonly<{
      clientPoint: InfiniteCanvasPoint;
      dropTarget: InfiniteCanvasResolvedDropTarget<Kind>;
      id: string;
      isOverViewport: boolean;
      originClientPoint: InfiniteCanvasPoint;
      payload: Payload;
      pointerId: number;
      status: "dragging";
      viewportPoint: InfiniteCanvasPoint;
      worldPoint: InfiniteCanvasPoint;
    }>;

type InfiniteCanvasDragStartInput<Payload = InfiniteCanvasDropPayload> = Readonly<{
  event: ReactPointerEvent<HTMLElement>;
  id: string;
  payload: Payload;
}>;

type InfiniteCanvasDropCommitContext<
  Kind extends string = string,
  Payload = InfiniteCanvasDropPayload,
> = Readonly<{
  actions: InfiniteCanvasCommands<Kind>;
  dropTarget: Extract<InfiniteCanvasResolvedDropTarget<Kind>, { status: "valid" }>;
  payload: Payload;
  state: InfiniteCanvasState<Kind>;
  target: InfiniteCanvasSpatialTarget<Kind>;
  viewportPoint: InfiniteCanvasPoint;
  worldPoint: InfiniteCanvasPoint;
}>;

type InfiniteCanvasDropTargetContext<
  Kind extends string = string,
  Payload = InfiniteCanvasDropPayload,
> = Readonly<{
  payload: Payload;
  state: InfiniteCanvasState<Kind>;
  target: InfiniteCanvasSpatialTarget<Kind>;
  viewportPoint: InfiniteCanvasPoint;
  worldPoint: InfiniteCanvasPoint;
}>;

type InfiniteCanvasDropPolicy<
  Kind extends string = string,
  Payload = InfiniteCanvasDropPayload,
> = Readonly<{
  canDrop?: (
    context: InfiniteCanvasDropTargetContext<Kind, Payload>,
  ) => InfiniteCanvasDropValidationInput;
  onDrop?: (context: InfiniteCanvasDropCommitContext<Kind, Payload>) => void;
}>;

type InfiniteCanvasOverlayRenderContext<
  Kind extends string = string,
  Payload = InfiniteCanvasDropPayload,
> = Readonly<{
  actions: InfiniteCanvasCommands<Kind>;
  cancelDrag: () => void;
  contextualCommands: readonly InfiniteCanvasContextualCommand[];
  drag: InfiniteCanvasDropInteraction<Payload, Kind>;
  resolveSpatialTarget: InfiniteCanvasResolveSpatialTarget<Kind>;
  startDrag: (input: InfiniteCanvasDragStartInput<Payload>) => void;
  state: InfiniteCanvasState<Kind>;
}>;

type InfiniteCanvasWindowFrameSurfaceProps = Readonly<{
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}>;

type InfiniteCanvasWindowFrameHeaderProps = Readonly<{
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}>;

type InfiniteCanvasWindowFrameTitleProps = Readonly<{
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}>;

type InfiniteCanvasWindowFrameControlsProps = Readonly<{
  className?: string;
  style?: CSSProperties;
}>;

type InfiniteCanvasWindowFrameBodyProps = Readonly<{
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}>;

type InfiniteCanvasWindowFrameActiveCornersProps = Readonly<{
  className?: string;
  style?: CSSProperties;
}>;

type InfiniteCanvasWindowFrameSlots = Readonly<{
  ActiveCorners: ComponentType<InfiniteCanvasWindowFrameActiveCornersProps>;
  Body: ComponentType<InfiniteCanvasWindowFrameBodyProps>;
  Controls: ComponentType<InfiniteCanvasWindowFrameControlsProps>;
  Header: ComponentType<InfiniteCanvasWindowFrameHeaderProps>;
  Surface: ComponentType<InfiniteCanvasWindowFrameSurfaceProps>;
  Title: ComponentType<InfiniteCanvasWindowFrameTitleProps>;
}>;

type InfiniteCanvasWindowFrameRenderContext<Kind extends string = string> =
  InfiniteCanvasWindowRenderContext<Kind> &
    Readonly<{
      chrome: InfiniteCanvasChromeMetrics;
      frame: InfiniteCanvasWindowFrameSlots;
      renderDefaultFrame: () => ReactNode;
      theme: InfiniteCanvasTheme;
    }>;

type InfiniteCanvasSceneVector3 = readonly [number, number, number];

type InfiniteCanvasWindowProxy<Kind extends string = string> = Readonly<{
  bodyLocalRect: InfiniteCanvasRect;
  bodyScenePosition: InfiniteCanvasSceneVector3;
  bodyWorldRect: InfiniteCanvasRect;
  center: InfiniteCanvasPoint;
  frameScenePosition: InfiniteCanvasSceneVector3;
  frameWorldRect: InfiniteCanvasRect;
  id: string;
  isActive: boolean;
  isPinned: boolean;
  isSelected: boolean;
  kind: Kind;
  mode: InfiniteCanvasWindowMode;
  rect: InfiniteCanvasRect;
  screenCenter: InfiniteCanvasPoint;
  screenPosition: InfiniteCanvasSceneVector3;
  screenRect: InfiniteCanvasRect;
  screenSize: InfiniteCanvasSize;
  size: InfiniteCanvasSize;
  title: string;
  zIndex: number;
}>;

/** @deprecated Use InfiniteCanvasWindowProxy. */
type InfiniteCanvasWindowSceneModel<Kind extends string = string> = InfiniteCanvasWindowProxy<Kind>;

type InfiniteCanvasSceneLayerRenderContext<
  Kind extends string = string,
  Payload = InfiniteCanvasDropPayload,
> = Readonly<{
  actions: InfiniteCanvasCommands<Kind>;
  camera: InfiniteCanvasCamera;
  chrome: InfiniteCanvasChromeMetrics;
  contextualCommands: readonly InfiniteCanvasContextualCommand[];
  devicePixelRatio: number;
  drop: InfiniteCanvasDropInteraction<Payload, Kind>;
  getState: () => InfiniteCanvasState<Kind>;
  getWindowProxy: (windowId: string) => InfiniteCanvasWindowProxy<Kind> | null;
  /** @deprecated Use getWindowProxy. */
  getWindowSceneModel: (windowId: string) => InfiniteCanvasWindowSceneModel<Kind> | null;
  resolveSpatialTarget: InfiniteCanvasResolveSpatialTarget<Kind>;
  space: InfiniteCanvasSceneLayerSpace;
  state: InfiniteCanvasState<Kind>;
  theme: InfiniteCanvasTheme;
  visibleRect: InfiniteCanvasRect;
  visibleScreenRect: InfiniteCanvasRect;
  visibleWindows: readonly InfiniteCanvasWindowProxy<Kind>[];
  visibleWorldRect: InfiniteCanvasRect;
  viewport: InfiniteCanvasViewport;
  windows: readonly InfiniteCanvasWindowProxy<Kind>[];
}>;

type InfiniteCanvasSceneLayerPlacement = "overlay" | "underlay";
type InfiniteCanvasSceneLayerSpace = "screen" | "world";
type InfiniteCanvasSceneLayerFrameloop = "always" | "demand";

type InfiniteCanvasSceneLayer<
  Kind extends string = string,
  Payload = InfiniteCanvasDropPayload,
> = Readonly<{
  frameloop?: InfiniteCanvasSceneLayerFrameloop;
  id: string;
  placement?: InfiniteCanvasSceneLayerPlacement;
  space?: InfiniteCanvasSceneLayerSpace;
  render: (context: InfiniteCanvasSceneLayerRenderContext<Kind, Payload>) => ReactNode;
}>;

type InfiniteCanvasWindowWheelBehavior = "canvas-pan" | "native-scroll";

type InfiniteCanvasWindowBodyPointerBehavior = "canvas-pan" | "native";

type InfiniteCanvasWindowTextSelection = "none" | "native";

type InfiniteCanvasWindowFrameChrome = "dom" | "host" | "scene";

type InfiniteCanvasWindowDefinition<Kind extends string = string> = Readonly<{
  bodyPointerBehavior?: InfiniteCanvasWindowBodyPointerBehavior;
  frameChrome?: InfiniteCanvasWindowFrameChrome;
  kind: Kind;
  overflowY?: CSSProperties["overflowY"];
  renderBody?: (context: InfiniteCanvasWindowRenderContext<Kind>) => ReactNode;
  renderFrame?: (context: InfiniteCanvasWindowFrameRenderContext<Kind>) => ReactNode;
  textSelection?: InfiniteCanvasWindowTextSelection;
  wheelBehavior?: InfiniteCanvasWindowWheelBehavior;
}>;

type InfiniteCanvasWindowRegistry<Kind extends string = string> = Readonly<
  Record<Kind, InfiniteCanvasWindowDefinition<Kind>>
>;

type InfiniteCanvasCameraNavigationBehavior =
  | Readonly<{ type: "center" }>
  | Readonly<{ type: "centerAtZoom"; zoom: number }>
  | Readonly<{ maxZoom?: number; paddingPx?: number; type: "fit" }>;

type InfiniteCanvasCameraNavigationTarget =
  | Readonly<{ point: InfiniteCanvasPoint; type: "point" }>
  | Readonly<{ type: "rect"; rect: InfiniteCanvasRect }>
  | Readonly<{ type: "selection" }>
  | Readonly<{ type: "visibleWindows" }>
  | Readonly<{ type: "window"; windowId: string }>;

type InfiniteCanvasCameraNavigationRequest = Readonly<{
  behavior?: InfiniteCanvasCameraNavigationBehavior;
  target: InfiniteCanvasCameraNavigationTarget;
}>;

type InfiniteCanvasCommand =
  | Readonly<{ type: "desktop.cancel" }>
  | Readonly<{ type: "selection.clear" }>
  | Readonly<{ type: "selection.selectAllVisible" }>
  | Readonly<{ type: "view.fitAll" }>
  | Readonly<{ type: "view.fitSelection" }>
  | Readonly<{
      request: InfiniteCanvasCameraNavigationRequest;
      type: "view.navigate";
    }>
  | Readonly<{
      amountPx: number;
      direction: "down" | "left" | "right" | "up";
      type: "window.nudge";
    }>
  | Readonly<{ type: "view.resetZoom" }>;

type InfiniteCanvasCommandId =
  | "desktop.cancel"
  | "selection.clear"
  | "selection.selectAllVisible"
  | "view.fitAll"
  | "view.fitSelection"
  | "view.resetZoom"
  | "window.nudge.down"
  | "window.nudge.down.large"
  | "window.nudge.left"
  | "window.nudge.left.large"
  | "window.nudge.right"
  | "window.nudge.right.large"
  | "window.nudge.up"
  | "window.nudge.up.large";

type InfiniteCanvasCommandDescriptor = Readonly<{
  command: InfiniteCanvasCommand;
  description: string;
  hotkeys: readonly RegisterableHotkey[];
  id: InfiniteCanvasCommandId;
  label: string;
}>;

type InfiniteCanvasCommandGroup = "canvas" | "selection" | "view" | "window";

type InfiniteCanvasContextualCommand = InfiniteCanvasCommandDescriptor &
  Readonly<{
    enabled: boolean;
    group: InfiniteCanvasCommandGroup;
  }>;

type InfiniteCanvasHotkeyBinding = Readonly<{
  command: InfiniteCanvasCommand;
  description: string;
  hotkey: RegisterableHotkey;
  id: InfiniteCanvasCommandId;
  label: string;
}>;

type InfiniteCanvasAction<Kind extends string = string> =
  | Readonly<{
      request: InfiniteCanvasCameraNavigationRequest;
      type: "camera.navigate";
    }>
  | Readonly<{ delta: InfiniteCanvasPoint; type: "camera.panBy" }>
  | Readonly<{ type: "camera.zoomAt"; anchor: InfiniteCanvasPoint; zoom: number }>
  | Readonly<{ command: InfiniteCanvasCommand; type: "command.execute" }>
  | Readonly<{ type: "desktop.hydrate"; state: InfiniteCanvasState<Kind> }>
  | Readonly<{ type: "desktop.reset"; state: InfiniteCanvasState<Kind> }>
  | Readonly<{ type: "interaction.finish"; pointerId: number }>
  | Readonly<{
      mode: InfiniteCanvasMarqueeMode;
      pointerId: number;
      point: InfiniteCanvasPoint;
      type: "interaction.startMarquee";
    }>
  | Readonly<{
      type: "interaction.startMove";
      pointerId: number;
      point: InfiniteCanvasPoint;
      windowId: string;
    }>
  | Readonly<{
      clearSelection?: boolean;
      pointerId: number;
      point: InfiniteCanvasPoint;
      type: "interaction.startPan";
    }>
  | Readonly<{
      type: "interaction.startResize";
      handle: InfiniteCanvasResizeHandle;
      pointerId: number;
      point: InfiniteCanvasPoint;
      windowId: string;
    }>
  | Readonly<{
      point: InfiniteCanvasPoint;
      pointerId: number;
      snapPolicy?: InfiniteCanvasSnapPolicy;
      type: "interaction.step";
    }>
  | Readonly<{ type: "selection.add"; windowIds: readonly string[] }>
  | Readonly<{ type: "selection.clear" }>
  | Readonly<{ type: "selection.remove"; windowIds: readonly string[] }>
  | Readonly<{ type: "selection.replace"; windowIds: readonly string[] }>
  | Readonly<{ type: "selection.selectAllVisible" }>
  | Readonly<{ targets: readonly InfiniteCanvasSelectionTarget[]; type: "selection.targets.add" }>
  | Readonly<{
      targets: readonly InfiniteCanvasSelectionTarget[];
      type: "selection.targets.remove";
    }>
  | Readonly<{
      targets: readonly InfiniteCanvasSelectionTarget[];
      type: "selection.targets.replace";
    }>
  | Readonly<{
      targets: readonly InfiniteCanvasSelectionTarget[];
      type: "selection.targets.toggle";
    }>
  | Readonly<{ type: "selection.toggle"; windowIds: readonly string[] }>
  | Readonly<{ type: "viewport.set"; viewport: InfiniteCanvasViewport }>
  | Readonly<{ type: "window.close"; windowId: string }>
  | Readonly<{ type: "window.focus"; windowId: string }>
  | Readonly<{ type: "window.maximize"; windowId: string }>
  | Readonly<{ type: "window.minimize"; windowId: string }>
  | Readonly<{ type: "window.open"; window: InfiniteCanvasWindow<Kind> }>
  | Readonly<{ type: "window.restore"; windowId: string }>
  | Readonly<{ type: "window.togglePinned"; windowId: string }>;

type InfiniteCanvasCommands<Kind extends string = string> = Readonly<{
  closeWindow: (windowId: string) => void;
  dispatch: (action: InfiniteCanvasAction<Kind>) => void;
  executeCommand: (command: InfiniteCanvasCommand) => void;
  finishInteraction: (pointerId: number) => void;
  focusWindow: (windowId: string) => void;
  hydrate: (state: InfiniteCanvasState<Kind>) => void;
  maximizeWindow: (windowId: string) => void;
  minimizeWindow: (windowId: string) => void;
  navigateView: (request: InfiniteCanvasCameraNavigationRequest) => void;
  navigateToPoint: (
    input: Readonly<{
      behavior?: InfiniteCanvasCameraNavigationBehavior;
      point: InfiniteCanvasPoint;
    }>,
  ) => void;
  navigateToRect: (
    input: Readonly<{
      behavior?: InfiniteCanvasCameraNavigationBehavior;
      rect: InfiniteCanvasRect;
    }>,
  ) => void;
  navigateToWindow: (
    input: Readonly<{
      behavior?: InfiniteCanvasCameraNavigationBehavior;
      windowId: string;
    }>,
  ) => void;
  openWindow: (window: InfiniteCanvasWindow<Kind>) => void;
  panBy: (input: Readonly<{ delta: InfiniteCanvasPoint }>) => void;
  fitAllVisibleWindows: () => void;
  fitSelection: () => void;
  reset: () => void;
  restoreWindow: (windowId: string) => void;
  selectAllVisibleWindows: () => void;
  selectTarget: (target: InfiniteCanvasSelectionTarget) => void;
  selectWindow: (windowId: string) => void;
  setTargetSelection: (targets: readonly InfiniteCanvasSelectionTarget[]) => void;
  setSelection: (windowIds: readonly string[]) => void;
  setViewport: (viewport: InfiniteCanvasViewport) => void;
  startMarquee: (
    input: Readonly<{
      mode: InfiniteCanvasMarqueeMode;
      pointerId: number;
      point: InfiniteCanvasPoint;
    }>,
  ) => void;
  startMove: (
    input: Readonly<{ pointerId: number; point: InfiniteCanvasPoint; windowId: string }>,
  ) => void;
  startPan: (
    input: Readonly<{
      clearSelection?: boolean;
      pointerId: number;
      point: InfiniteCanvasPoint;
    }>,
  ) => void;
  startResize: (
    input: Readonly<{
      handle: InfiniteCanvasResizeHandle;
      pointerId: number;
      point: InfiniteCanvasPoint;
      windowId: string;
    }>,
  ) => void;
  stepInteraction: (input: Readonly<{ pointerId: number; point: InfiniteCanvasPoint }>) => void;
  toggleTargetSelection: (target: InfiniteCanvasSelectionTarget) => void;
  toggleWindowSelection: (windowId: string) => void;
  togglePinned: (windowId: string) => void;
  zoomAt: (input: Readonly<{ anchor: InfiniteCanvasPoint; zoom: number }>) => void;
}>;

export type {
  InfiniteCanvasAction,
  InfiniteCanvasCamera,
  InfiniteCanvasCameraNavigationBehavior,
  InfiniteCanvasCameraNavigationRequest,
  InfiniteCanvasCameraNavigationTarget,
  InfiniteCanvasChromeMetrics,
  InfiniteCanvasCommand,
  InfiniteCanvasCommandDescriptor,
  InfiniteCanvasCommandGroup,
  InfiniteCanvasCommandId,
  InfiniteCanvasCommands,
  InfiniteCanvasContextualCommand,
  InfiniteCanvasCursor,
  InfiniteCanvasCursorInteraction,
  InfiniteCanvasCursorPolicy,
  InfiniteCanvasDragStartInput,
  InfiniteCanvasDropCommitContext,
  InfiniteCanvasDropInteraction,
  InfiniteCanvasDropPayload,
  InfiniteCanvasDropPolicy,
  InfiniteCanvasDropTargetContext,
  InfiniteCanvasDropValidationInput,
  InfiniteCanvasDropValidationResult,
  InfiniteCanvasEmptyCanvasDragMode,
  InfiniteCanvasInputPolicy,
  InfiniteCanvasInteraction,
  InfiniteCanvasHotkeyBinding,
  InfiniteCanvasMarqueeInteraction,
  InfiniteCanvasMarqueeMode,
  InfiniteCanvasMoveInteraction,
  InfiniteCanvasMoveOriginRect,
  InfiniteCanvasOverlayRenderContext,
  InfiniteCanvasPanInteraction,
  InfiniteCanvasPoint,
  InfiniteCanvasPointerMode,
  InfiniteCanvasRect,
  InfiniteCanvasResizeHandle,
  InfiniteCanvasResizeInteraction,
  InfiniteCanvasResolvedDropTarget,
  InfiniteCanvasResolveSpatialTarget,
  InfiniteCanvasResolvedSpatialTarget,
  InfiniteCanvasSceneLayer,
  InfiniteCanvasSceneLayerFrameloop,
  InfiniteCanvasSceneLayerPlacement,
  InfiniteCanvasSceneLayerRenderContext,
  InfiniteCanvasSceneLayerSpace,
  InfiniteCanvasSceneVector3,
  InfiniteCanvasSerializedState,
  InfiniteCanvasSelection,
  InfiniteCanvasSelectionTarget,
  InfiniteCanvasSelectionTargetType,
  InfiniteCanvasSize,
  InfiniteCanvasSpatialTarget,
  InfiniteCanvasSpatialTargetResolver,
  InfiniteCanvasSpatialTargetResolverContext,
  InfiniteCanvasSpatialTargetResolverPhase,
  InfiniteCanvasSpatialWindowArea,
  InfiniteCanvasSnapGuide,
  InfiniteCanvasSnapPolicy,
  InfiniteCanvasSnapPreview,
  InfiniteCanvasStackBands,
  InfiniteCanvasState,
  InfiniteCanvasTheme,
  InfiniteCanvasViewport,
  InfiniteCanvasWindow,
  InfiniteCanvasWindowBodyPointerBehavior,
  InfiniteCanvasWindowDefinition,
  InfiniteCanvasWindowFrameChrome,
  InfiniteCanvasWindowFrameActiveCornersProps,
  InfiniteCanvasWindowFrameBodyProps,
  InfiniteCanvasWindowFrameControlsProps,
  InfiniteCanvasWindowFrameHeaderProps,
  InfiniteCanvasWindowFrameRenderContext,
  InfiniteCanvasWindowFrameSlots,
  InfiniteCanvasWindowFrameSurfaceProps,
  InfiniteCanvasWindowFrameTitleProps,
  InfiniteCanvasWindowMode,
  InfiniteCanvasWindowProxy,
  InfiniteCanvasWindowRegistry,
  InfiniteCanvasWindowRenderContext,
  InfiniteCanvasWindowSceneModel,
  InfiniteCanvasWindowTextSelection,
  InfiniteCanvasWindowWheelBehavior,
  InfiniteCanvasZoomPolicy,
  InfiniteCanvasZoomPolicyInput,
};
