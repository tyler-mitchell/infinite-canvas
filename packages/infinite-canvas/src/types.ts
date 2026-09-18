import type { RegisterableHotkey } from "@tanstack/hotkeys";
import type { useRender } from "@base-ui/react/use-render";
import type { Type } from "arktype";
import type { canvasModel, commandInputs } from "./schema";
import type { CommandId } from "./operations";
import type { ComponentRenderContext } from "./component";
import type { CameraNavigationResult } from "./camera-rig";
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
  InfiniteCanvasGroupMasonry,
  InfiniteCanvasGroupNode,
  InfiniteCanvasGroupWindowNodeLayout,
} from "./group-tree";
import type { InfiniteCanvasWindowPlacement } from "./window-placement";

type InfiniteCanvasPoint = Readonly<typeof canvasModel.Point.infer>;

/** World space uses DOM directions. Up decreases `y`. */
type InfiniteCanvasDirection = typeof canvasModel.Direction.infer;

type InfiniteCanvasSize = Readonly<typeof canvasModel.Size.infer>;

type InfiniteCanvasRect = Readonly<typeof canvasModel.Rect.infer>;

type InfiniteCanvasCamera = Readonly<typeof canvasModel.Camera.infer>;

/** Screen positions use 0–1 fractions. Target offsets use world units. */
export type CameraComposition = Readonly<typeof canvasModel.CameraComposition.infer>;
export type CameraFramingMode = typeof canvasModel.CameraFramingMode.infer;

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

type InfiniteCanvasWindowMode = typeof canvasModel.WindowMode.infer;

/** Optional window permissions. An absent flag permits the action. */
type InfiniteCanvasWindowCapability =
  | "closable"
  | "maximizable"
  | "minimizable"
  | "movable"
  | "resizable";

type InfiniteCanvasWindowCapabilities = Readonly<typeof canvasModel.WindowCapabilities.infer>;

type InfiniteCanvasWindow<Kind extends string = string, Data = unknown> = Readonly<
  Omit<typeof canvasModel.Window.infer, "kind" | "data"> & {
    data?: Data;
    kind: Kind;
  }
>;

type InfiniteCanvasSelection = Readonly<{
  anchorTarget: InfiniteCanvasSelectionTarget | null;
  targets: readonly InfiniteCanvasSelectionTarget[];
}>;

type InfiniteCanvasSelectionTargetType = "window" | "edge" | "group" | "scene-object";

type InfiniteCanvasSelectionTarget =
  | Readonly<{ id: string; type: "window" }>
  | Readonly<{
      data?: unknown;
      id: string;
      kind: string;
      type: Exclude<InfiniteCanvasSelectionTargetType, "window">;
    }>;

type InfiniteCanvasSnapGuide = Readonly<{
  axis: "x" | "y";
  from: "viewport" | "window";
  id: string;
  kind: "center" | "edge" | "gap";
  position: number;
  sourceAnchor: "bottom" | "center" | "left" | "middle" | "right" | "top";
  windowIds: readonly string[];
}>;

type InfiniteCanvasSnapPreview = Readonly<{
  guides: readonly InfiniteCanvasSnapGuide[];
  rect: InfiniteCanvasRect;
  target: TransformTarget | null;
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
  originSelection: InfiniteCanvasSelection;
  pointerId: number;
}>;

type TransformTarget =
  | Readonly<{ id: string; type: "window" }>
  | Readonly<{ id: string; type: "group" }>;

type InfiniteCanvasMoveOriginRect = Readonly<{
  bounds: InfiniteCanvasRect;
  rect: InfiniteCanvasRect;
  target: TransformTarget;
}>;

/** Describes the group region used when the current move ends. */
type InfiniteCanvasDockPreview = Readonly<{
  containerId: string;
  edge: InfiniteCanvasGroupDockEdge;
  groupId: string | null;
  /** For a lattice target: the cells the dropped window takes. */
  layout?: InfiniteCanvasGroupWindowNodeLayout;
  /** Region filled by the drop. */
  rect: InfiniteCanvasRect;
  targetId: string;
  windowId: string;
}>;

type InfiniteCanvasMoveInteraction = Readonly<{
  delta: InfiniteCanvasPoint;
  /** Current move preview. Null when no group target exists. */
  dockPreview: InfiniteCanvasDockPreview | null;
  kind: "move";
  originPointer: InfiniteCanvasPoint;
  originRects: readonly InfiniteCanvasMoveOriginRect[];
  pointerId: number;
  target: TransformTarget;
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
  | Readonly<{ kind: "groupReorder"; groupId: string; childId: string; pointerId: number }>
  | InfiniteCanvasMarqueeInteraction
  | InfiniteCanvasPanInteraction
  | InfiniteCanvasMoveInteraction
  | InfiniteCanvasGroupGutterInteraction
  | InfiniteCanvasGroupResizeInteraction
  | InfiniteCanvasResizeInteraction
  | null;

/** A world-space shell that arranges member windows with a local tree. */
type InfiniteCanvasGroup = Readonly<
  Omit<typeof canvasModel.GroupHeader.infer, "tree"> & {
    tree: InfiniteCanvasGroupNode;
  }
>;

/**
 * A directed edge between two windows.
 *
 * `kind` names the relation and belongs to the consumer's vocabulary, the way `InfiniteCanvasWindow`
 * carries a window kind. `data` is the consumer's payload and the framework never reads it.
 */
type InfiniteCanvasConnection = Readonly<{
  /** Consumer-owned payload, validated by the consumer like `window.data`. */
  data?: unknown;
  from: string;
  id: string;
  kind: string;
  to: string;
}>;

/** Undoable document state. */
type DocumentContent<Kind extends string = string> = Readonly<{
  /** The active workspace is part of the undoable document. */
  activeWorkspaceId: string | null;
  connections: readonly InfiniteCanvasConnection[];
  groups: readonly InfiniteCanvasGroup[];
  windows: readonly InfiniteCanvasWindow<Kind>[];
  workspaces: readonly InfiniteCanvasWorkspace[];
}>;

/** A named window set with camera and selection snapshots from its last exit. */
type InfiniteCanvasWorkspace = Readonly<
  Omit<typeof canvasModel.Workspace.infer, "windowIds" | "selection"> & {
    selection: InfiniteCanvasSelection;
    windowIds: readonly string[];
  }
>;

type InfiniteCanvasRecipeWindow = Readonly<typeof canvasModel.RecipeWindow.infer>;

type InfiniteCanvasRecipeGroup = Readonly<
  Omit<typeof canvasModel.RecipeGroupHeader.infer, "tree"> & {
    tree: InfiniteCanvasGroupNode;
  }
>;

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

type InfiniteCanvasState<Kind extends string = string> = DocumentContent<Kind> &
  Readonly<{
    activeWindowId: string | null;
    camera: InfiniteCanvasCamera;
    /** Chrome metrics used by group layout. This state is not serialized. */
    groupMetrics: InfiniteCanvasGroupMetrics;
    /** Session-only edit history. */
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
  }>;

type InfiniteCanvasDocument<Kind extends string = string> = DocumentContent<Kind> &
  Readonly<{
    activeWindowId: string | null;
    camera: InfiniteCanvasCamera;
    selection: InfiniteCanvasSelection;
    version: 4;
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
  dispatch: InfiniteCanvasDispatch<Kind>;
  /** The room the body has, after the header and borders. A renderer that fits content needs it. */
  bodySize: InfiniteCanvasSize;
  isActive: boolean;
  isSelected: boolean;
  rect: InfiniteCanvasRect;
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
      rect: InfiniteCanvasRect;
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
  contentSize?: InfiniteCanvasSize;
  groupInsertion?: Readonly<typeof canvasModel.GroupInsertion.infer>;
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
  onActivate?: () => void;
  activationDistance?: number;
}>;

type InfiniteCanvasDropCommitContext<
  Kind extends string = string,
  Payload = InfiniteCanvasDropPayload,
> = Readonly<{
  dispatch: InfiniteCanvasDispatch<Kind>;
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
  placement?: (context: InfiniteCanvasDropTargetContext<Kind, Payload>) => Readonly<{
    anchor?: InfiniteCanvasPoint;
    groupInsertion?: InfiniteCanvasDropPlacement["groupInsertion"];
    contentSize?: InfiniteCanvasSize;
    size: InfiniteCanvasSize;
    snapPolicy?: InfiniteCanvasSnapPolicy | false;
  }> | null;
}>;

/** Overlay context without the payload-consuming `startDrag` function. */
type InfiniteCanvasOverlayReadContext<
  Kind extends string = string,
  Payload = InfiniteCanvasDropPayload,
> = Readonly<{
  dispatch: InfiniteCanvasDispatch<Kind>;
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
type InfiniteCanvasSlotRender = useRender.RenderProp;

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

type InfiniteCanvasWindowProxy<Kind extends string = string> = Readonly<{
  bodyLocalRect: InfiniteCanvasRect;
  bodyWorldRect: InfiniteCanvasRect;
  center: InfiniteCanvasPoint;
  frameWorldRect: InfiniteCanvasRect;
  id: string;
  isActive: boolean;
  isPinned: boolean;
  isSelected: boolean;
  kind: Kind;
  mode: InfiniteCanvasWindowMode;
  rect: InfiniteCanvasRect;
  screenCenter: InfiniteCanvasPoint;
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
  dispatch: InfiniteCanvasDispatch<Kind>;
  camera: InfiniteCanvasCamera;
  chrome: InfiniteCanvasChromeMetrics;
  devicePixelRatio: number;
  drop: InfiniteCanvasDropInteraction<Payload, Kind>;
  getState: () => InfiniteCanvasState<Kind>;
  getWindowProxy: (windowId: string) => InfiniteCanvasWindowProxy<Kind> | null;
  resolveSpatialTarget: InfiniteCanvasResolveSpatialTarget<Kind>;
  space: InfiniteCanvasSceneLayerSpace;
  state: InfiniteCanvasState<Kind>;
  theme: InfiniteCanvasTheme;
  /** The viewport as a screen rect, for a pass drawing in screen space. */
  visibleScreenRect: InfiniteCanvasRect;
  /** `windows` culled to `visibleWorldRect`. */
  visibleWindows: readonly InfiniteCanvasWindowProxy<Kind>[];
  /** The world the viewport frames right now. */
  visibleWorldRect: InfiniteCanvasRect;
  viewport: InfiniteCanvasViewport;
  windows: readonly InfiniteCanvasWindowProxy<Kind>[];
}>;

type InfiniteCanvasSceneLayerPlacement = "overlay" | "underlay";
type InfiniteCanvasSceneLayerSpace = "screen" | "world";

/** What the compositor measured about one window's surroundings on the last frame. */
type InfiniteCanvasWindowProximity = Readonly<{
  /** World distance from this window's edge to the nearest other window's edge. */
  nearest: number;
  /** ID of the nearest window within reach, or null. */
  nearestWindowId: string | null;
  /** Windows within reach. */
  neighbors: number;
  /** Sum over neighbours of (1 - distance / reach); crowding reads high. */
  pressure: number;
}>;

type InfiniteCanvasWindowWheelBehavior = "canvas-pan" | "native-scroll";

/** Body presses pan, move the window after a threshold, or retain native handling. */
type InfiniteCanvasWindowBodyPointerBehavior = "canvas-pan" | "move" | "native";

type InfiniteCanvasWindowTextSelection = "none" | "native";

type InfiniteCanvasWindowFrameChrome = "dom" | "host" | "scene";

type InfiniteCanvasWindowDefinition<Kind extends string = string, Data = unknown> = Readonly<{
  renderComponent?(props: Data, context: ComponentRenderContext): ReactNode;
  aspectRatio?: number;
  minSize?: InfiniteCanvasSize;
  contextMenu?: ContextMenuPolicy | false;
  actions?: Readonly<Record<string, ComponentAction<Data>>>;
  schema?: Type<any, any>;
  size?: InfiniteCanvasSize;
  bodyDragThresholdPx?: number;
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

export type ContextMenuPolicy = Readonly<{
  commands?: readonly InfiniteCanvasCommandId[];
  label?: string;
  showDisabled?: boolean;
}>;

export type ComponentAction<Props = unknown> = Readonly<{
  label: string;
  description?: string;
  multiple?: boolean;
  enabled?(props: Props): boolean | string;
}> &
  (
    | Readonly<{ set: Partial<Props>; update?: never }>
    | Readonly<{
        set?: never;
        update(props: Props): Partial<Props> | Error;
      }>
  );

/** Per-kind registry input with typed window data. */
type InfiniteCanvasWindowRegistryInput<
  Kind extends string,
  DataByKind extends Readonly<Record<Kind, unknown>>,
> = Readonly<{
  [K in Kind]: InfiniteCanvasWindowDefinition<Kind, DataByKind[K]>;
}>;

type InfiniteCanvasWindowRegistry<Kind extends string = string> = Readonly<
  Record<string, InfiniteCanvasWindowDefinition<Kind>>
>;

type InfiniteCanvasCameraNavigationBehavior = Readonly<
  typeof canvasModel.CameraNavigationBehavior.infer
>;

type InfiniteCanvasCameraNavigationTarget = Readonly<
  typeof canvasModel.CameraNavigationTarget.infer
>;

type InfiniteCanvasCameraNavigationRequest = Readonly<
  typeof canvasModel.CameraNavigationRequest.infer
>;

type InfiniteCanvasCommand = {
  [CommandType in keyof typeof commandInputs]: Readonly<{ type: CommandType }> & {
    readonly [Field in keyof (typeof commandInputs)[CommandType]["infer"]]: Readonly<
      (typeof commandInputs)[CommandType]["infer"][Field]
    >;
  };
}[keyof typeof commandInputs];

type InfiniteCanvasCommandId = CommandId | InfiniteCanvasCommand["type"] | `component:${string}`;

type InfiniteCanvasCommandDescriptor<Id extends string = InfiniteCanvasCommandId> = Readonly<{
  command: InfiniteCanvasCommand;
  description: string;
  hotkeys: readonly RegisterableHotkey[];
  id: Id;
  label: string;
}>;

type InfiniteCanvasCommandGroup = "canvas" | "component" | "edit" | "selection" | "view" | "window";

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
  | InfiniteCanvasCommand
  | Readonly<{ delta: InfiniteCanvasPoint; type: "camera.panBy" }>
  | Readonly<{ type: "camera.zoomAt"; anchor: InfiniteCanvasPoint; zoom: number }>
  | Readonly<{ connection: InfiniteCanvasConnection; type: "connection.open" }>
  | Readonly<{ connectionId: string; type: "connection.close" }>
  | Readonly<{
      connectionId: string;
      patch: Partial<InfiniteCanvasConnection>;
      type: "connection.update";
    }>
  | Readonly<{ type: "desktop.hydrate"; state: InfiniteCanvasState<Kind> }>
  | Readonly<{
      groupId: string;
      rect: InfiniteCanvasRect;
      title?: string;
      type: "group.create";
      layout?: InfiniteCanvasGroupLayoutMode;
      masonry?: InfiniteCanvasGroupMasonry;
      windowIds: readonly string[];
    }>
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
  | Readonly<{
      axis: InfiniteCanvasGroupAxis;
      containerId: string;
      groupId: string;
      type: "group.setAxis";
    }>
  | Readonly<{ childId: string; groupId: string; toIndex: number; type: "group.reorderChild" }>
  | Readonly<{
      groupId: string;
      layouts: Readonly<Record<string, InfiniteCanvasGroupWindowNodeLayout>>;
      type: "group.setChildLayouts";
    }>
  | Readonly<{
      afterChildId: string;
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
      /** Minimum frame size in world units. */
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
      undock?: boolean;
      pointerId: number;
      point: InfiniteCanvasPoint;
      target: TransformTarget;
    }>
  | Readonly<{
      type: "interaction.startGroupReorder";
      groupId: string;
      childId: string;
      pointerId: number;
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
  | Readonly<{ type: "selection.add"; targets: readonly InfiniteCanvasSelectionTarget[] }>
  | Readonly<{ type: "selection.remove"; targets: readonly InfiniteCanvasSelectionTarget[] }>
  | Readonly<{ type: "selection.replace"; targets: readonly InfiniteCanvasSelectionTarget[] }>
  | Readonly<{ type: "selection.toggle"; targets: readonly InfiniteCanvasSelectionTarget[] }>
  | Readonly<{ type: "viewport.set"; viewport: InfiniteCanvasViewport }>
  | Readonly<{ metrics: InfiniteCanvasGroupMetricsInput; type: "groupMetrics.set" }>
  | Readonly<{ insets: InfiniteCanvasViewportInsetsInput; type: "viewportInsets.set" }>
  | Readonly<{
      occluders: readonly InfiniteCanvasViewportOccluder[];
      type: "viewportOccluders.set";
    }>
  | Readonly<{ title: string; type: "window.setTitle"; windowId: string }>
  | Readonly<{ data: unknown; type: "window.setData"; windowId: string }>
  | Readonly<{ height: number; type: "window.setContentHeight"; windowId: string }>
  | Readonly<{ type: "window.focus"; windowId: string }>
  | Readonly<{
      /** Placement resolved here, against live state, rather than by the caller. */
      placement?: InfiniteCanvasWindowPlacement;
      target?: Readonly<typeof canvasModel.GroupInsertion.infer>;
      type: "window.open";
      window: InfiniteCanvasWindow<Kind>;
    }>
  /** A consumer sizes or places a floating window itself, as when its body sizes to content. */
  | Readonly<{ rect: InfiniteCanvasRect; type: "window.setRect"; windowId: string }>
  | Readonly<{ type: "window.togglePinned"; windowId: string }>;

type InfiniteCanvasActionInput<
  Type extends InfiniteCanvasAction["type"],
  Kind extends string = string,
> = {
  [ActionType in Type]: Omit<Extract<InfiniteCanvasAction<Kind>, { type: ActionType }>, "type"> &
    Readonly<{
      type: ActionType;
      currentState: InfiniteCanvasState<Kind>;
    }>;
}[Type];

type InfiniteCanvasDispatch<Kind extends string = string> = (
  action: InfiniteCanvasAction<Kind>,
  options?: Readonly<{ signal?: AbortSignal }>,
) => void | Promise<CameraNavigationResult>;

export type {
  InfiniteCanvasAction,
  InfiniteCanvasActionInput,
  InfiniteCanvasCamera,
  InfiniteCanvasCameraNavigationBehavior,
  InfiniteCanvasCameraNavigationRequest,
  InfiniteCanvasCameraNavigationTarget,
  InfiniteCanvasChromeMetrics,
  InfiniteCanvasCommand,
  InfiniteCanvasCommandDescriptor,
  InfiniteCanvasCommandGroup,
  InfiniteCanvasCommandId,
  InfiniteCanvasDispatch,
  InfiniteCanvasContextualCommand,
  InfiniteCanvasDirection,
  InfiniteCanvasDockPreview,
  DocumentContent,
  InfiniteCanvasGroup,
  InfiniteCanvasGroupGutterInteraction,
  InfiniteCanvasGroupMetrics,
  InfiniteCanvasGroupMetricsInput,
  TransformTarget,
  InfiniteCanvasGroupResizeInteraction,
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
  InfiniteCanvasConnection,
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
  InfiniteCanvasSceneLayerPlacement,
  InfiniteCanvasSceneLayerRenderContext,
  InfiniteCanvasSceneLayerSpace,
  InfiniteCanvasDocument,
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
  InfiniteCanvasWindowProximity,
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
