import type { RegisterableHotkey } from "@tanstack/hotkeys";
import type {
  ComponentType,
  CSSProperties,
  HTMLAttributes,
  PointerEvent as ReactPointerEvent,
  ReactNode,
  Ref,
} from "react";

import type {
  InfiniteCanvasGroupAxis,
  InfiniteCanvasGroupContainerNode,
  InfiniteCanvasGroupDockEdge,
  InfiniteCanvasGroupLayoutMode,
  InfiniteCanvasGroupNode,
} from "./group-tree";
// This type-only import prevents a runtime cycle through `window-placement`.
import type { InfiniteCanvasAlignment, InfiniteCanvasDistribution } from "./window-arrange";
import type {
  InfiniteCanvasWindowPlacement,
  InfiniteCanvasWindowPlacementRegion,
} from "./window-placement";

type InfiniteCanvasPoint = Readonly<{
  x: number;
  y: number;
}>;

/** World space uses DOM directions. Up decreases `y`. */
type InfiniteCanvasDirection = "down" | "left" | "right" | "up";

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

/** Screen-pixel bands covered by consumer chrome. This state is not serialized. */
type InfiniteCanvasViewportInsets = Readonly<{
  bottom: number;
  left: number;
  right: number;
  top: number;
}>;

type InfiniteCanvasViewportInsetsInput = Partial<InfiniteCanvasViewportInsets>;

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

/** Optional window permissions. An absent flag permits the action. */
type InfiniteCanvasWindowCapability = "closable" | "maximizable" | "minimizable" | "resizable";

type InfiniteCanvasWindowCapabilities = Partial<
  Readonly<Record<InfiniteCanvasWindowCapability, boolean>>
>;

type InfiniteCanvasWindow<Kind extends string = string, Data = unknown> = Readonly<{
  capabilities?: InfiniteCanvasWindowCapabilities;
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

/** Describes the group region used when the current move ends. */
type InfiniteCanvasDockPreview = Readonly<{
  containerId: string;
  edge: InfiniteCanvasGroupDockEdge;
  groupId: string | null;
  /** Region filled by the drop. */
  rect: InfiniteCanvasRect;
  targetId: string;
  windowId: string;
}>;

type InfiniteCanvasMoveInteraction = Readonly<{
  /** Current move preview. Null when no group target exists. */
  dockPreview: InfiniteCanvasDockPreview | null;
  kind: "move";
  originPointer: InfiniteCanvasPoint;
  originRect: InfiniteCanvasRect;
  originRects: readonly InfiniteCanvasMoveOriginRect[];
  pointerId: number;
  windowId: string;
  originCamera: InfiniteCanvasCamera;
}>;

/** Moves a group by one member header. */
type InfiniteCanvasGroupMoveInteraction = Readonly<{
  groupId: string;
  kind: "groupMove";
  originPointer: InfiniteCanvasPoint;
  originRect: InfiniteCanvasRect;
  pointerId: number;
  originCamera: InfiniteCanvasCamera;
}>;

/** Resizes a group shell and derives member rects from the new shell. */
type InfiniteCanvasGroupResizeInteraction = Readonly<{
  groupId: string;
  handle: InfiniteCanvasResizeHandle;
  kind: "groupResize";
  /** Structural minimum from group metrics and tree layout. */
  minSize: InfiniteCanvasSize;
  originPointer: InfiniteCanvasPoint;
  originRect: InfiniteCanvasRect;
  pointerId: number;
  originCamera: InfiniteCanvasCamera;
}>;

/** Resizes adjacent split panes from the interaction start state. */
type InfiniteCanvasGroupGutterInteraction = Readonly<{
  afterChildId: string;
  availableExtent: number;
  axis: InfiniteCanvasGroupAxis;
  beforeChildId: string;
  containerId: string;
  groupId: string;
  kind: "groupGutter";
  originContainer: InfiniteCanvasGroupContainerNode;
  originPointer: InfiniteCanvasPoint;
  pointerId: number;
  originCamera: InfiniteCanvasCamera;
}>;

type InfiniteCanvasResizeInteraction = Readonly<{
  handle: InfiniteCanvasResizeHandle;
  kind: "resize";
  originPointer: InfiniteCanvasPoint;
  originRect: InfiniteCanvasRect;
  pointerId: number;
  windowId: string;
  originCamera: InfiniteCanvasCamera;
}>;

type InfiniteCanvasInteraction =
  | InfiniteCanvasMarqueeInteraction
  | InfiniteCanvasPanInteraction
  | InfiniteCanvasMoveInteraction
  | InfiniteCanvasGroupMoveInteraction
  | InfiniteCanvasGroupGutterInteraction
  | InfiniteCanvasGroupResizeInteraction
  | InfiniteCanvasResizeInteraction
  | null;

/** A world-space shell that arranges member windows with a local tree. */
type InfiniteCanvasGroup = Readonly<{
  id: string;
  rect: InfiniteCanvasRect;
  /** Null derives the title from current group members. */
  title: string | null;
  tree: InfiniteCanvasGroupNode;
  zIndex: number;
}>;

/** Undoable document state. */
type InfiniteCanvasDocument<Kind extends string = string> = Readonly<{
  /** The active workspace is part of the undoable document. */
  activeWorkspaceId: string | null;
  groups: readonly InfiniteCanvasGroup[];
  windows: readonly InfiniteCanvasWindow<Kind>[];
  workspaces: readonly InfiniteCanvasWorkspace[];
}>;

/** A named window set with camera and selection snapshots from its last exit. */
type InfiniteCanvasWorkspace = Readonly<{
  camera: InfiniteCanvasCamera;
  id: string;
  selection: InfiniteCanvasSelection;
  title: string;
  windowIds: readonly string[];
}>;

type InfiniteCanvasHistory<Kind extends string = string> = Readonly<{
  future: readonly InfiniteCanvasDocument<Kind>[];
  past: readonly InfiniteCanvasDocument<Kind>[];
}>;

type InfiniteCanvasRecipeWindow = Readonly<{
  isPinned: boolean;
  mode: InfiniteCanvasWindowMode;
  rect: InfiniteCanvasRect;
  windowId: string;
  zIndex: number;
}>;

type InfiniteCanvasRecipeGroup = Readonly<{
  groupId: string;
  rect: InfiniteCanvasRect;
  /** Null preserves a title derived from recipe members. */
  title: string | null;
  tree: InfiniteCanvasGroupNode;
  zIndex: number;
}>;

/** A relative arrangement that references windows by ID. */
type InfiniteCanvasRecipe = Readonly<{
  groups: readonly InfiniteCanvasRecipeGroup[];
  id: string;
  name: string;
  size: InfiniteCanvasSize;
  version: 1;
  windows: readonly InfiniteCanvasRecipeWindow[];
}>;

/** Places a recipe at an origin or centers it in a rect. */
type InfiniteCanvasRecipePlacement =
  | Readonly<{ origin: InfiniteCanvasPoint }>
  | Readonly<{ rect: InfiniteCanvasRect }>;

/** Sizes used to solve group chrome. */
type InfiniteCanvasGroupMetrics = Readonly<{
  accordionHeaderSize: number;
  gutterSize: number;
  tabStripSize: number;
}>;

type InfiniteCanvasGroupMetricsInput = Partial<InfiniteCanvasGroupMetrics>;

type InfiniteCanvasState<Kind extends string = string> = Readonly<{
  activeWindowId: string | null;
  /** Null disables workspace filtering. */
  activeWorkspaceId: string | null;
  camera: InfiniteCanvasCamera;
  /** Chrome metrics used by group layout. This state is not serialized. */
  groupMetrics: InfiniteCanvasGroupMetrics;
  groups: readonly InfiniteCanvasGroup[];
  /** Session-only edit history. */
  history: InfiniteCanvasHistory<Kind>;
  interaction: InfiniteCanvasInteraction;
  /**
   * The region an undo or redo just restored, for a consumer to mark. Not serialized.
   *
   * Optional rather than nullable because absent and "nothing revealed" are the same fact, so a
   * reader needs one check. It also keeps a field about undo out of every fixture that builds a
   * state for some unrelated reason.
   *
   * `token` counts reveals so a renderer can key on it. Undoing twice in the same place produces
   * the same rectangle, and a marker keyed only by geometry would not restart its animation — the
   * second undo would look like nothing happened, which is the failure this whole feature exists
   * to remove.
   */
  revealedChange?: Readonly<{ rect: InfiniteCanvasRect; token: number }>;
  selection: InfiniteCanvasSelection;
  snapPreview: InfiniteCanvasSnapPreview | null;
  viewport: InfiniteCanvasViewport;
  /** Screen-pixel bands covered by consumer chrome. */
  viewportInsets: InfiniteCanvasViewportInsets;
  /** Screen-pixel rects covered by chrome inside the content area. */
  viewportOccluders: readonly InfiniteCanvasViewportOccluder[];
  windows: readonly InfiniteCanvasWindow<Kind>[];
  workspaces: readonly InfiniteCanvasWorkspace[];
}>;

/** Serialized version 3. Older versions migrate missing fields to empty lists. */
type InfiniteCanvasSerializedState<Kind extends string = string> = Readonly<{
  activeWindowId: string | null;
  camera: InfiniteCanvasCamera;
  activeWorkspaceId?: string | null;
  groups: readonly InfiniteCanvasGroup[];
  selection?: InfiniteCanvasSelection;
  version: 3;
  windows: readonly InfiniteCanvasWindow<Kind>[];
  workspaces?: readonly InfiniteCanvasWorkspace[];
}>;

/** Screen-pixel rect covered by consumer chrome. */
type InfiniteCanvasViewportOccluder = InfiniteCanvasRect;

type InfiniteCanvasChromeMetrics = Readonly<{
  borderWidth: number;
  cornerSize: number;
  /** Group label size in screen pixels. Zero hides the label. */
  groupLabelSize: number;
  headerAccentHeight: number;
  headerHeight: number;
  /** Resize-handle size in screen pixels. */
  resizeHandleSize: number;
}>;

/** Partial override of default chrome metrics. */
type InfiniteCanvasChromeMetricsInput = Partial<InfiniteCanvasChromeMetrics>;

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

type InfiniteCanvasHudPolicy = Readonly<{
  cameraControls: boolean;
  minimizedDock: boolean;
  pointerModeControls: boolean;
  statusCard: boolean;
  zoomControls: boolean;
}>;

type InfiniteCanvasHudPolicyInput = boolean | Readonly<Partial<InfiniteCanvasHudPolicy>>;

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
  /** Marks the region an undo or redo restored, while it fades. */
  revealedChange: string;
  selectionBorder: string;
  selectionBounds: string;
}>;

type InfiniteCanvasWindowRenderContext<Kind extends string = string, Data = unknown> = Readonly<{
  actions: InfiniteCanvasCommands<Kind>;
  isActive: boolean;
  isSelected: boolean;
  state: InfiniteCanvasState<Kind>;
  window: InfiniteCanvasWindow<Kind, Data>;
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

/** Resolver context that does not require a pointer position. */
type InfiniteCanvasSpatialTargetGeometryContext<Kind extends string = string> = Readonly<{
  chrome: InfiniteCanvasChromeMetrics;
  state: InfiniteCanvasState<Kind>;
}>;

type InfiniteCanvasSpatialTargetResolverContext<Kind extends string = string> =
  InfiniteCanvasSpatialTargetGeometryContext<Kind> &
    Readonly<{
      viewportPoint: InfiniteCanvasPoint;
      worldPoint: InfiniteCanvasPoint;
    }>;

type InfiniteCanvasSpatialTargetResolverPhase = "after-windows" | "before-windows";

type InfiniteCanvasSpatialTargetResolver<Kind extends string = string> = Readonly<{
  /** Returns a target world rect or null. Overlay resolvers omit this function. */
  getTargetRect?: (
    target: InfiniteCanvasSelectionTarget,
    context: InfiniteCanvasSpatialTargetGeometryContext<Kind>,
  ) => InfiniteCanvasRect | null;
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

/** File data from a drag that started outside the page. */
type InfiniteCanvasFileDropPayload = Readonly<{
  /** Empty until drop because browsers protect in-flight file data. */
  files: readonly File[];
  type: "files";
  /** MIME types available during the drag. */
  types: readonly string[];
}>;

/** Text data from a drag that started outside the page. */
type InfiniteCanvasTextDropPayload = Readonly<{
  /** Empty until drop because browsers protect in-flight transfer data. */
  text: string;
  type: "text";
  /** MIME types available during the drag. */
  types: readonly string[];
  /** URI lines without RFC 2483 comments. Empty until drop. */
  uris: readonly string[];
}>;

/** Supported payloads for a drag that started outside the page. */
type InfiniteCanvasNativeDropPayload =
  | InfiniteCanvasFileDropPayload
  | InfiniteCanvasTextDropPayload;

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

/** Snapped drop rect and guides. */
type InfiniteCanvasDropPlacement = Readonly<{
  preview: InfiniteCanvasSnapPreview | null;
  rect: InfiniteCanvasRect;
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
      /** Null when the drop policy gives no placement size. */
      placement: InfiniteCanvasDropPlacement | null;
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
  /** Placement shown when the pointer was released. */
  placement: InfiniteCanvasDropPlacement | null;
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
  /** Returns payload size and pointer offset for snap placement, or null. */
  placement?: (
    context: InfiniteCanvasDropTargetContext<Kind, Payload>,
  ) => Readonly<{ anchor?: InfiniteCanvasPoint; size: InfiniteCanvasSize }> | null;
}>;

/** Overlay context without the payload-consuming `startDrag` function. */
type InfiniteCanvasOverlayReadContext<
  Kind extends string = string,
  Payload = InfiniteCanvasDropPayload,
> = Readonly<{
  actions: InfiniteCanvasCommands<Kind>;
  cancelDrag: () => void;
  contextualCommands: readonly InfiniteCanvasContextualCommand[];
  drag: InfiniteCanvasDropInteraction<Payload, Kind>;
  resolveSpatialTarget: InfiniteCanvasResolveSpatialTarget<Kind>;
  state: InfiniteCanvasState<Kind>;
}>;

/** Overlay read context plus `startDrag`. */
type InfiniteCanvasOverlayRenderContext<
  Kind extends string = string,
  Payload = InfiniteCanvasDropPayload,
> = InfiniteCanvasOverlayReadContext<Kind, Payload> &
  Readonly<{
    startDrag: (input: InfiniteCanvasDragStartInput<Payload>) => void;
  }>;

/** Renders a slot with merged props and default children. */
type InfiniteCanvasSlotRender = (
  props: Record<string, unknown>,
  state: Readonly<{ children?: ReactNode }>,
) => ReactNode;

/** DOM attributes plus a React 19 ref and slot renderer. */
type InfiniteCanvasSlotElementProps<Element extends HTMLElement> = HTMLAttributes<Element> &
  Readonly<{
    ref?: Ref<Element>;
    render?: InfiniteCanvasSlotRender;
  }>;

type InfiniteCanvasWindowFrameSurfaceProps = InfiniteCanvasSlotElementProps<HTMLDivElement>;

type InfiniteCanvasWindowFrameHeaderProps = InfiniteCanvasSlotElementProps<HTMLElement>;

type InfiniteCanvasWindowFrameTitleProps = InfiniteCanvasSlotElementProps<HTMLDivElement>;

type InfiniteCanvasWindowFrameControlsProps = InfiniteCanvasSlotElementProps<HTMLDivElement>;

type InfiniteCanvasWindowFrameBodyProps = InfiniteCanvasSlotElementProps<HTMLDivElement>;

type InfiniteCanvasWindowFrameActiveCornersProps = InfiniteCanvasSlotElementProps<HTMLDivElement>;

type InfiniteCanvasWindowFrameSlots = Readonly<{
  ActiveCorners: ComponentType<InfiniteCanvasWindowFrameActiveCornersProps>;
  Body: ComponentType<InfiniteCanvasWindowFrameBodyProps>;
  Controls: ComponentType<InfiniteCanvasWindowFrameControlsProps>;
  Header: ComponentType<InfiniteCanvasWindowFrameHeaderProps>;
  Surface: ComponentType<InfiniteCanvasWindowFrameSurfaceProps>;
  Title: ComponentType<InfiniteCanvasWindowFrameTitleProps>;
}>;

type InfiniteCanvasWindowFrameRenderContext<
  Kind extends string = string,
  Data = unknown,
> = InfiniteCanvasWindowRenderContext<Kind, Data> &
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

type InfiniteCanvasWindowDefinition<Kind extends string = string, Data = unknown> = Readonly<{
  bodyPointerBehavior?: InfiniteCanvasWindowBodyPointerBehavior;
  frameChrome?: InfiniteCanvasWindowFrameChrome;
  kind: Kind;
  overflowY?: CSSProperties["overflowY"];
  /** Mounts a screen-space portal root outside the window transform. */
  portalRoot?: boolean;
  renderBody?: (context: InfiniteCanvasWindowRenderContext<Kind, Data>) => ReactNode;
  renderFrame?: (context: InfiniteCanvasWindowFrameRenderContext<Kind, Data>) => ReactNode;
  /** Renders semantic detail at far zoom. Omission keeps the full body at all zooms. */
  renderSummary?: (context: InfiniteCanvasWindowRenderContext<Kind, Data>) => ReactNode;
  textSelection?: InfiniteCanvasWindowTextSelection;
  wheelBehavior?: InfiniteCanvasWindowWheelBehavior;
}>;

/** Per-kind registry input with typed window data. */
type InfiniteCanvasWindowRegistryInput<
  Kind extends string,
  DataByKind extends Readonly<Record<Kind, unknown>>,
> = Readonly<{
  [K in Kind]: InfiniteCanvasWindowDefinition<Kind, DataByKind[K]>;
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
      direction: InfiniteCanvasDirection;
      type: "window.nudge";
    }>
  | Readonly<{
      /** Aligns selected floating windows within their collective bounds. */
      alignment: InfiniteCanvasAlignment;
      type: "window.align";
    }>
  | Readonly<{ type: "group.equalizeChildren" }>
  | Readonly<{ type: "activeWindow.close" }>
  | Readonly<{ type: "activeWindow.minimize" }>
  | Readonly<{ type: "activeWindow.toggleMaximized" }>
  | Readonly<{ type: "activeWindow.togglePinned" }>
  /** Closes all closable selected windows as one edit. */
  | Readonly<{ type: "selection.close" }>
  /** Minimizes all permitted selected windows as one edit. */
  | Readonly<{ type: "selection.minimize" }>
  /** Pins all selected windows, or unpins them when all are pinned. */
  | Readonly<{ type: "selection.togglePinned" }>
  | Readonly<{ amountPx: number; direction: InfiniteCanvasDirection; type: "view.pan" }>
  | Readonly<{ factor: number; type: "view.zoomBy" }>
  | Readonly<{ direction: InfiniteCanvasDirection; type: "selection.extendDirection" }>
  | Readonly<{ type: "selection.removeActive" }>
  | Readonly<{ direction: "next" | "previous"; type: "workspace.cycle" }>
  | Readonly<{ type: "workspace.showAll" }>
  | Readonly<{ type: "workspace.removeActiveWindow" }>
  /** Creates or enters a named workspace. */
  | Readonly<{ title?: string; type: "workspace.create"; workspaceId: string }>
  | Readonly<{ type: "workspace.enter"; workspaceId: string }>
  /** Closes the workspace without closing its windows. */
  | Readonly<{ type: "workspace.close"; workspaceId: string }>
  /** Moves the active window to the named workspace. */
  | Readonly<{ type: "workspace.moveActiveWindow"; workspaceId: string }>
  /** Shows, restores, and focuses a window across workspace filters. */
  | Readonly<{ type: "window.reveal"; windowId: string }>
  | Readonly<{ amountPx: number; type: "group.resizePane" }>
  | Readonly<{ type: "group.dissolve" }>
  | Readonly<{ type: "group.flipAxis" }>
  | Readonly<{ toward: "end" | "start"; type: "group.moveChild" }>
  | Readonly<{ layout: InfiniteCanvasGroupLayoutMode; type: "group.setLayout" }>
  | Readonly<{ direction: InfiniteCanvasDirection; type: "window.dockDirection" }>
  | Readonly<{ type: "window.undock" }>
  | Readonly<{ type: "window.swap" }>
  | Readonly<{
      /** Distributes selected floating windows with equal gaps. */
      distribution: InfiniteCanvasDistribution;
      type: "window.distribute";
    }>
  | Readonly<{
      /** Places the active window in the visible region without snapping. */
      region: InfiniteCanvasWindowPlacementRegion;
      type: "window.place";
    }>
  | Readonly<{
      /** Screen-pixel resize amount. */
      amountPx: number;
      /** Right and down grow. Left and up shrink. The origin stays fixed. */
      direction: InfiniteCanvasDirection;
      type: "window.resize";
    }>
  | Readonly<{
      direction: InfiniteCanvasDirection;
      type: "window.focusDirection";
    }>
  | Readonly<{ type: "history.undo" }>
  | Readonly<{ type: "history.redo" }>
  | Readonly<{ type: "view.resetZoom" }>;

type InfiniteCanvasCommandId =
  | "desktop.cancel"
  | "history.redo"
  | "workspace.close"
  | "workspace.create"
  | "workspace.enter"
  | "window.reveal"
  | "window.align.bottom"
  | "window.align.horizontal-center"
  | "window.align.left"
  | "window.align.right"
  | "window.align.top"
  | "window.align.vertical-center"
  | "window.distribute.horizontal"
  | "window.distribute.vertical"
  | "activeWindow.close"
  | "activeWindow.minimize"
  | "activeWindow.toggleMaximized"
  | "activeWindow.togglePinned"
  | "selection.close"
  | "selection.minimize"
  | "selection.togglePinned"
  | "group.equalizeChildren"
  | "group.dissolve"
  | "group.growPane"
  | "group.shrinkPane"
  | "selection.extend.down"
  | "selection.extend.left"
  | "selection.extend.right"
  | "selection.extend.up"
  | "selection.removeActive"
  | "workspace.cycle.next"
  | "workspace.cycle.previous"
  | "workspace.removeActiveWindow"
  | "workspace.moveActiveWindow"
  | "workspace.showAll"
  | "view.pan.down"
  | "view.pan.left"
  | "view.pan.right"
  | "view.pan.up"
  | "view.zoomIn"
  | "view.zoomOut"
  | "group.flipAxis"
  | "group.moveChild.end"
  | "group.moveChild.start"
  | "group.setLayout.accordion"
  | "group.setLayout.split"
  | "group.setLayout.tabs"
  | "window.dock.down"
  | "window.dock.left"
  | "window.dock.right"
  | "window.dock.up"
  | "window.undock"
  | "window.swap"
  | "history.undo"
  | "selection.clear"
  | "selection.selectAllVisible"
  | "view.fitAll"
  | "view.fitSelection"
  | "view.resetZoom"
  | "window.focus.down"
  | "window.focus.left"
  | "window.focus.right"
  | "window.focus.up"
  | "window.nudge.down"
  | "window.nudge.down.large"
  | "window.nudge.left"
  | "window.nudge.left.large"
  | "window.nudge.right"
  | "window.nudge.right.large"
  | "window.nudge.up"
  | "window.nudge.up.large"
  | "window.place.bottom"
  | "window.place.center"
  | "window.place.fill"
  | "window.place.left"
  | "window.place.right"
  | "window.place.top"
  | "window.resize.down"
  | "window.resize.left"
  | "window.resize.right"
  | "window.resize.up";

type InfiniteCanvasCommandDescriptor = Readonly<{
  command: InfiniteCanvasCommand;
  description: string;
  hotkeys: readonly RegisterableHotkey[];
  id: InfiniteCanvasCommandId;
  label: string;
}>;

type InfiniteCanvasCommandGroup = "canvas" | "edit" | "selection" | "view" | "window";

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
  | Readonly<{
      groupId: string;
      rect: InfiniteCanvasRect;
      title?: string;
      type: "group.create";
      windowIds: readonly string[];
    }>
  | Readonly<{
      title?: string;
      type: "workspace.create";
      windowIds?: readonly string[];
      workspaceId: string;
    }>
  | Readonly<{ type: "workspace.close"; workspaceId: string }>
  | Readonly<{ title: string; type: "workspace.setTitle"; workspaceId: string }>
  | Readonly<{ type: "workspace.activate"; workspaceId: string | null }>
  | Readonly<{ type: "workspace.addWindow"; windowId: string; workspaceId: string }>
  /** Moves windows and their complete groups to one workspace as one edit. */
  | Readonly<{ type: "workspace.moveWindows"; windowIds: readonly string[]; workspaceId: string }>
  | Readonly<{ type: "workspace.removeWindow"; windowId: string; workspaceId: string }>
  /** Final list index. */
  | Readonly<{ toIndex: number; type: "workspace.reorder"; workspaceId: string }>
  | Readonly<{
      type: "workspace.setWindows";
      windowIds: readonly string[];
      workspaceId: string;
    }>
  | Readonly<{ groupId: string; title: string; type: "group.setTitle" }>
  | Readonly<{ groupId: string; type: "group.close" }>
  | Readonly<{ groupId: string; rect: InfiniteCanvasRect; type: "group.setRect" }>
  | Readonly<{
      containerId: string;
      edge: InfiniteCanvasGroupDockEdge;
      groupId: string;
      targetId: string;
      type: "group.dockWindow";
      windowId: string;
    }>
  | Readonly<{ rect?: InfiniteCanvasRect; type: "group.undockWindow"; windowId: string }>
  | Readonly<{
      placement: InfiniteCanvasRecipePlacement;
      recipe: InfiniteCanvasRecipe;
      type: "recipe.apply";
    }>
  | Readonly<{
      childId: string;
      containerId: string;
      groupId: string;
      type: "group.setActiveChild";
    }>
  | Readonly<{
      containerId: string;
      groupId: string;
      layout: InfiniteCanvasGroupLayoutMode;
      type: "group.setLayoutMode";
    }>
  | Readonly<{
      containerId: string;
      groupId: string;
      type: "group.setChildWeights";
      weights: Readonly<Record<string, number>>;
    }>
  | Readonly<{ containerId: string; groupId: string; type: "group.equalizeChildren" }>
  | Readonly<{
      axis: InfiniteCanvasGroupAxis;
      containerId: string;
      groupId: string;
      type: "group.setAxis";
    }>
  | Readonly<{ childId: string; groupId: string; toIndex: number; type: "group.reorderChild" }>
  | Readonly<{
      afterChildId: string;
      availableExtent: number;
      axis: InfiniteCanvasGroupAxis;
      beforeChildId: string;
      containerId: string;
      groupId: string;
      point: InfiniteCanvasPoint;
      pointerId: number;
      type: "interaction.startGroupGutter";
    }>
  | Readonly<{
      groupId: string;
      handle: InfiniteCanvasResizeHandle;
      /** Structural group minimum from the render layer. */
      minSize: InfiniteCanvasSize;
      point: InfiniteCanvasPoint;
      pointerId: number;
      type: "interaction.startGroupResize";
    }>
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
      /** Enables group docking and suppresses alignment guides. */
      dockIntent?: boolean;
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
  | Readonly<{ metrics: InfiniteCanvasGroupMetrics; type: "groupMetrics.set" }>
  | Readonly<{ insets: InfiniteCanvasViewportInsets; type: "viewportInsets.set" }>
  | Readonly<{
      occluders: readonly InfiniteCanvasViewportOccluder[];
      type: "viewportOccluders.set";
    }>
  | Readonly<{ title: string; type: "window.setTitle"; windowId: string }>
  | Readonly<{ type: "window.close"; windowId: string }>
  | Readonly<{ type: "window.focus"; windowId: string }>
  | Readonly<{ type: "window.maximize"; windowId: string }>
  | Readonly<{ type: "window.minimize"; windowId: string }>
  | Readonly<{
      /** Placement resolved here, against live state, rather than by the caller. */
      placement?: InfiniteCanvasWindowPlacement;
      type: "window.open";
      window: InfiniteCanvasWindow<Kind>;
    }>
  | Readonly<{ type: "window.restore"; windowId: string }>
  | Readonly<{ type: "window.togglePinned"; windowId: string }>;

type InfiniteCanvasCommands<Kind extends string = string> = Readonly<{
  closeGroup: (groupId: string) => void;
  closeWindow: (windowId: string) => void;
  createGroup: (
    input: Readonly<{
      groupId: string;
      rect: InfiniteCanvasRect;
      title?: string;
      windowIds: readonly string[];
    }>,
  ) => void;
  dispatch: (action: InfiniteCanvasAction<Kind>) => void;
  dockWindow: (
    input: Readonly<{
      containerId: string;
      edge: InfiniteCanvasGroupDockEdge;
      groupId: string;
      targetId: string;
      windowId: string;
    }>,
  ) => void;
  executeCommand: (command: InfiniteCanvasCommand) => void;
  finishInteraction: (pointerId: number) => void;
  focusWindow: (windowId: string) => void;
  applyRecipe: (
    input: Readonly<{ placement: InfiniteCanvasRecipePlacement; recipe: InfiniteCanvasRecipe }>,
  ) => void;
  redo: () => void;
  reorderGroupChild: (
    input: Readonly<{ childId: string; groupId: string; toIndex: number }>,
  ) => void;
  reorderWorkspace: (input: Readonly<{ toIndex: number; workspaceId: string }>) => void;
  setGroupActiveChild: (
    input: Readonly<{ childId: string; containerId: string; groupId: string }>,
  ) => void;
  setGroupChildWeights: (
    input: Readonly<{
      containerId: string;
      groupId: string;
      weights: Readonly<Record<string, number>>;
    }>,
  ) => void;
  /** Updates non-empty titles without command-palette parameters. */
  setWindowTitle: (input: Readonly<{ title: string; windowId: string }>) => void;
  setGroupTitle: (input: Readonly<{ groupId: string; title: string }>) => void;
  setWorkspaceTitle: (input: Readonly<{ title: string; workspaceId: string }>) => void;
  /** Updates one workspace member without replacing the full membership list. */
  addWindowToWorkspace: (input: Readonly<{ windowId: string; workspaceId: string }>) => void;
  removeWindowFromWorkspace: (input: Readonly<{ windowId: string; workspaceId: string }>) => void;
  setGroupAxis: (
    input: Readonly<{
      axis: InfiniteCanvasGroupAxis;
      containerId: string;
      groupId: string;
    }>,
  ) => void;
  setGroupLayoutMode: (
    input: Readonly<{
      containerId: string;
      groupId: string;
      layout: InfiniteCanvasGroupLayoutMode;
    }>,
  ) => void;
  setGroupRect: (input: Readonly<{ groupId: string; rect: InfiniteCanvasRect }>) => void;
  startGroupGutterDrag: (
    input: Readonly<{
      afterChildId: string;
      availableExtent: number;
      axis: InfiniteCanvasGroupAxis;
      beforeChildId: string;
      containerId: string;
      groupId: string;
      point: InfiniteCanvasPoint;
      pointerId: number;
    }>,
  ) => void;
  /** Starts a group resize with a minimum from the same layout metrics. */
  startGroupResize: (
    input: Readonly<{
      groupId: string;
      handle: InfiniteCanvasResizeHandle;
      minSize: InfiniteCanvasSize;
      point: InfiniteCanvasPoint;
      pointerId: number;
    }>,
  ) => void;
  undo: () => void;
  undockWindow: (input: Readonly<{ rect?: InfiniteCanvasRect; windowId: string }>) => void;
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
  /** Without a placement the window keeps its own rect. */
  openWindow: (
    window: InfiniteCanvasWindow<Kind>,
    placement?: InfiniteCanvasWindowPlacement,
  ) => void;
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
  /** Updates group chrome metrics. */
  setGroupMetrics: (metrics: InfiniteCanvasGroupMetricsInput) => void;
  setViewport: (viewport: InfiniteCanvasViewport) => void;
  /** Updates screen-pixel bands covered by consumer chrome. */
  setViewportInsets: (insets: InfiniteCanvasViewportInsetsInput) => void;
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
  stepInteraction: (
    input: Readonly<{ dockIntent?: boolean; pointerId: number; point: InfiniteCanvasPoint }>,
  ) => void;
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
  InfiniteCanvasDirection,
  InfiniteCanvasDockPreview,
  InfiniteCanvasDocument,
  InfiniteCanvasGroup,
  InfiniteCanvasGroupGutterInteraction,
  InfiniteCanvasGroupMetrics,
  InfiniteCanvasGroupMetricsInput,
  InfiniteCanvasGroupMoveInteraction,
  InfiniteCanvasGroupResizeInteraction,
  InfiniteCanvasHistory,
  InfiniteCanvasCursor,
  InfiniteCanvasCursorInteraction,
  InfiniteCanvasCursorPolicy,
  InfiniteCanvasDragStartInput,
  InfiniteCanvasDropCommitContext,
  InfiniteCanvasDropInteraction,
  InfiniteCanvasDropPlacement,
  InfiniteCanvasDropPayload,
  InfiniteCanvasDropPolicy,
  InfiniteCanvasDropTargetContext,
  InfiniteCanvasDropValidationInput,
  InfiniteCanvasDropValidationResult,
  InfiniteCanvasEmptyCanvasDragMode,
  InfiniteCanvasFileDropPayload,
  InfiniteCanvasNativeDropPayload,
  InfiniteCanvasTextDropPayload,
  InfiniteCanvasInputPolicy,
  InfiniteCanvasInteraction,
  InfiniteCanvasHotkeyBinding,
  InfiniteCanvasHudPolicy,
  InfiniteCanvasHudPolicyInput,
  InfiniteCanvasMarqueeInteraction,
  InfiniteCanvasMarqueeMode,
  InfiniteCanvasMoveInteraction,
  InfiniteCanvasMoveOriginRect,
  InfiniteCanvasOverlayReadContext,
  InfiniteCanvasOverlayRenderContext,
  InfiniteCanvasPanInteraction,
  InfiniteCanvasPoint,
  InfiniteCanvasPointerMode,
  InfiniteCanvasRecipe,
  InfiniteCanvasRecipeGroup,
  InfiniteCanvasRecipePlacement,
  InfiniteCanvasRecipeWindow,
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
  InfiniteCanvasSpatialTargetGeometryContext,
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
  InfiniteCanvasViewportInsets,
  InfiniteCanvasViewportInsetsInput,
  InfiniteCanvasViewportOccluder,
  InfiniteCanvasWindow,
  InfiniteCanvasWindowBodyPointerBehavior,
  InfiniteCanvasWindowDefinition,
  InfiniteCanvasWindowFrameChrome,
  InfiniteCanvasWindowFrameActiveCornersProps,
  InfiniteCanvasWindowFrameBodyProps,
  InfiniteCanvasWindowFrameControlsProps,
  InfiniteCanvasWindowFrameHeaderProps,
  InfiniteCanvasWindowFrameRenderContext,
  InfiniteCanvasSlotElementProps,
  InfiniteCanvasSlotRender,
  InfiniteCanvasWindowFrameSlots,
  InfiniteCanvasWindowFrameSurfaceProps,
  InfiniteCanvasWindowFrameTitleProps,
  InfiniteCanvasWindowCapabilities,
  InfiniteCanvasWindowCapability,
  InfiniteCanvasWindowMode,
  InfiniteCanvasWorkspace,
  InfiniteCanvasWindowProxy,
  InfiniteCanvasWindowRegistry,
  InfiniteCanvasWindowRegistryInput,
  InfiniteCanvasWindowRenderContext,
  InfiniteCanvasWindowTextSelection,
  InfiniteCanvasWindowWheelBehavior,
  InfiniteCanvasZoomPolicy,
  InfiniteCanvasChromeMetricsInput,
  InfiniteCanvasZoomPolicyInput,
};
