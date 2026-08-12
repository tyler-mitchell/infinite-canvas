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
// Type-only, so the cycle back through `window-placement` erases before runtime.
import type { InfiniteCanvasAlignment, InfiniteCanvasDistribution } from "./window-arrange";
import type { InfiniteCanvasWindowPlacementRegion } from "./window-placement";

type InfiniteCanvasPoint = Readonly<{
  x: number;
  y: number;
}>;

/**
 * A cardinal direction in world space, which grows downward like the DOM: `up`
 * is decreasing `y`. Shared by every directional command so nudging and focusing
 * can never disagree about which way is up.
 */
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

/**
 * Where a dragged window would dock if released now, resolved from the canonical
 * model and never from the DOM. `groupId: null` means the target is a floating
 * window, and dropping wraps it in a new group.
 */
type InfiniteCanvasDockPreview = Readonly<{
  containerId: string;
  edge: InfiniteCanvasGroupDockEdge;
  groupId: string | null;
  /** The region the drop would fill — half the target on that edge, or all of it for a tab merge. */
  rect: InfiniteCanvasRect;
  targetId: string;
  windowId: string;
}>;

type InfiniteCanvasMoveInteraction = Readonly<{
  /**
   * Carried on the interaction rather than in state: a dock preview belongs to
   * the drag that produced it, and dies with it. Nothing else can observe a
   * preview for a drag that is not happening.
   */
  dockPreview: InfiniteCanvasDockPreview | null;
  kind: "move";
  originPointer: InfiniteCanvasPoint;
  originRect: InfiniteCanvasRect;
  originRects: readonly InfiniteCanvasMoveOriginRect[];
  pointerId: number;
  windowId: string;
  originCamera: InfiniteCanvasCamera;
}>;

/** Dragging a group shell by any of its members' headers. DOCK-003. */
type InfiniteCanvasGroupMoveInteraction = Readonly<{
  groupId: string;
  kind: "groupMove";
  originPointer: InfiniteCanvasPoint;
  originRect: InfiniteCanvasRect;
  pointerId: number;
  originCamera: InfiniteCanvasCamera;
}>;

/**
 * Dragging a group shell's outer edge. The shell's rect changes; the tree does not,
 * and every member's rect is re-derived from the new shell — a group resize is one
 * write to `group.rect` and a re-solve, never a per-window resize.
 *
 * A grouped window's own edges carry no handles: `interaction.startResize` refuses a
 * grouped window, because a pane is resized by its seam and the shell by its edge.
 */
type InfiniteCanvasGroupResizeInteraction = Readonly<{
  groupId: string;
  handle: InfiniteCanvasResizeHandle;
  kind: "groupResize";
  /** Structural floor from the tree — gutters, strips, headers, panes. Never `minSize`. */
  minSize: InfiniteCanvasSize;
  originPointer: InfiniteCanvasPoint;
  originRect: InfiniteCanvasRect;
  pointerId: number;
  originCamera: InfiniteCanvasCamera;
}>;

/**
 * Dragging the seam between two split panes. SPLIT-001: this changes weights,
 * never a DOM width.
 *
 * `originContainer` is the container as it stood when the drag began. Every step
 * recomputes the pair's weights from *that* snapshot and the total pointer travel
 * since. Applying an incremental delta to the live weights instead would let
 * rounding accumulate and the seam drift out from under the cursor.
 */
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

/**
 * A world object that owns a local layout. It moves and resizes as one thing;
 * inside, `tree` arranges its member windows.
 *
 * `rect` is the shell's content rect in world units — the solver partitions it
 * directly. A member window's own `rect` is kept synced to whatever the solver
 * says, so snapping, selection bounds, and camera framing keep reading
 * `window.rect` and need to know nothing about groups.
 */
type InfiniteCanvasGroup = Readonly<{
  id: string;
  rect: InfiniteCanvasRect;
  title: string;
  tree: InfiniteCanvasGroupNode;
  zIndex: number;
}>;

/** The undoable half of the canvas: what exists, not where you are looking. */
type InfiniteCanvasDocument<Kind extends string = string> = Readonly<{
  groups: readonly InfiniteCanvasGroup[];
  windows: readonly InfiniteCanvasWindow<Kind>[];
}>;

type InfiniteCanvasHistory<Kind extends string = string> = Readonly<{
  future: readonly InfiniteCanvasDocument<Kind>[];
  past: readonly InfiniteCanvasDocument<Kind>[];
}>;

/** A window's place in a saved arrangement, relative to the recipe's own origin. */
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
  title: string;
  tree: InfiniteCanvasGroupNode;
  zIndex: number;
}>;

/**
 * A named arrangement, stored with its origin at `(0, 0)` so it drops into any
 * region of an unbounded world. It names windows by id rather than carrying them:
 * a recipe restores where things were, never what they were.
 */
type InfiniteCanvasRecipe = Readonly<{
  groups: readonly InfiniteCanvasRecipeGroup[];
  id: string;
  name: string;
  size: InfiniteCanvasSize;
  version: 1;
  windows: readonly InfiniteCanvasRecipeWindow[];
}>;

/** Pin the arrangement's top-left at `origin`, or centre it inside `rect`. */
type InfiniteCanvasRecipePlacement =
  | Readonly<{ origin: InfiniteCanvasPoint }>
  | Readonly<{ rect: InfiniteCanvasRect }>;

type InfiniteCanvasState<Kind extends string = string> = Readonly<{
  activeWindowId: string | null;
  camera: InfiniteCanvasCamera;
  groups: readonly InfiniteCanvasGroup[];
  /** Session-scoped and never serialized: a layout is a document, not its edit log. */
  history: InfiniteCanvasHistory<Kind>;
  interaction: InfiniteCanvasInteraction;
  selection: InfiniteCanvasSelection;
  snapPreview: InfiniteCanvasSnapPreview | null;
  viewport: InfiniteCanvasViewport;
  windows: readonly InfiniteCanvasWindow<Kind>[];
}>;

/**
 * `version: 2` added `groups`. A `version: 1` payload is still accepted and
 * migrates to `groups: []`. Making `groups` an optional field on `version: 1`
 * would have looked backward-compatible right up until an older build read a
 * newer payload, dropped the field it did not know, and wrote back a layout with
 * every group silently deleted.
 */
type InfiniteCanvasSerializedState<Kind extends string = string> = Readonly<{
  activeWindowId: string | null;
  camera: InfiniteCanvasCamera;
  groups: readonly InfiniteCanvasGroup[];
  selection?: InfiniteCanvasSelection;
  version: 2;
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

/**
 * Where a dragged payload would land, and the guides holding it there. `preview` is
 * `null` when snapping is off or nothing is near enough to catch.
 *
 * Lives here rather than in `drop-interaction` because the drop interaction carries
 * one, and a type-only cycle between the two modules would be a cycle a reader has
 * to hold in their head.
 */
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
      /**
       * Where the payload would land, snapped, and the guides holding it there.
       * `null` unless `dropPolicy.placement` declared how big the incoming thing is —
       * without a size there is no rect to snap, and nothing honest to draw.
       */
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
  /**
   * The very placement the preview was drawing when the pointer came up — not a
   * fresh call. Recomputing it here is how a drop lands somewhere other than where
   * the ghost promised, because the two calls can disagree the moment anything
   * about the snap candidates differs.
   */
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
  /**
   * How large the payload will be when it lands, and where the pointer sits inside
   * it. Supplying this is what lets the framework snap the drop against the same
   * candidates a window move snaps against, and draw the same guides — the ones it
   * was already computing inside `getInfiniteCanvasDropPlacement` and discarding.
   *
   * Return `null` for a payload that has no rect. Omit it entirely and drops behave
   * as before: no snapping, no guides, `drag.placement` is `null`.
   */
  placement?: (
    context: InfiniteCanvasDropTargetContext<Kind, Payload>,
  ) => Readonly<{ anchor?: InfiniteCanvasPoint; size: InfiniteCanvasSize }> | null;
}>;

/**
 * Everything an overlay *reads*. `Payload` appears only in output positions here,
 * so this type is covariant in it: a context for a narrow payload is assignable to
 * one for a wider payload, and a shared utility can take
 * `InfiniteCanvasOverlayReadContext<Kind, MyPayload>` without also naming `Kind`
 * at every call site.
 */
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

/**
 * The read surface plus the one function that makes the whole context invariant.
 *
 * `startDrag` takes a `Payload`, so it is *contravariant* in it, and an
 * intersection with a contravariant member is assignable in neither direction.
 * That is why a helper written against the default payload could not accept a
 * typed one, and why every generic consumer utility had to thread both type
 * parameters through. Splitting the surface means a utility that only reads takes
 * `InfiniteCanvasOverlayReadContext` and stops caring.
 */
type InfiniteCanvasOverlayRenderContext<
  Kind extends string = string,
  Payload = InfiniteCanvasDropPayload,
> = InfiniteCanvasOverlayReadContext<Kind, Payload> &
  Readonly<{
    startDrag: (input: InfiniteCanvasDragStartInput<Payload>) => void;
  }>;

/**
 * What a frame slot accepts.
 *
 * Until 2026-08-12 this was `{ children?, className?, style? }` and nothing else — which made the
 * framework *unstyled* rather than *headless*. A consumer could recolour a header but could not
 * put an `id` on it, attach an `onFocus`, hang a `ref` off it to measure or anchor to, give it an
 * `aria-describedby`, or render it as anything but the tag the framework picked.
 *
 * Now every slot takes the element's own props — `ref` included, which needs no `forwardRef`
 * because React 19 passes it as an ordinary prop — plus `render`, Base UI's spelling of
 * `asChild`: given the merged props, the consumer returns the element, and the framework keeps
 * its behaviour while giving up its tag.
 *
 * Merging is `mergeInfiniteCanvasSlotProps`, and the rules are per-kind rather than
 * last-wins — event handlers compose so passing `onPointerDown` to a header cannot silently
 * disable window dragging, and `data-slot` stays framework-owned because it is the styling
 * contract's only anchor.
 */
type InfiniteCanvasSlotRender = (
  props: Record<string, unknown>,
  state: Readonly<{ children?: ReactNode }>,
) => ReactNode;

/**
 * `HTMLAttributes` rather than `ComponentPropsWithRef<"div">`, and the reason is a hard
 * TypeScript limit rather than a preference: intersecting the full element props with anything
 * makes the union too complex to represent (TS2590), which this repository has already hit once
 * in its router typings. `HTMLAttributes` plus an explicit `ref` carries the substance —
 * `id`, `role`, `tabIndex`, every `aria-*`, every DOM event, `className`, `style` — at a
 * fraction of the type size. Arbitrary `data-*` is the one thing it does not admit; slots that
 * need one today have it framework-side, and widening further would reintroduce TS2590.
 */
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
  /**
   * Mount a portal root that tracks this window's screen rect, outside every
   * transform. Opt-in: a root for every window would cost a style write per window
   * per camera tick, and windows that never open a popover would pay for one.
   */
  portalRoot?: boolean;
  renderBody?: (context: InfiniteCanvasWindowRenderContext<Kind, Data>) => ReactNode;
  renderFrame?: (context: InfiniteCanvasWindowFrameRenderContext<Kind, Data>) => ReactNode;
  /**
   * What this window shows when it is too small on screen to read (semantic LOD).
   *
   * Opt-in per kind, and the lane is inert without it: a kind that declares no summary always
   * renders its body, at any zoom. That is the honest default — the framework cannot invent a
   * meaningful summary for content it does not understand, and a generic one would be worse
   * than small text, because small text at least still says what it says.
   *
   * Rasterization does **not** solve this and never could: a rasterized paragraph is still a
   * paragraph. At far zoom a window has to say something *different* — a title, an icon, a
   * count — not the same thing smaller. Receives the same context as `renderBody`.
   */
  renderSummary?: (context: InfiniteCanvasWindowRenderContext<Kind, Data>) => ReactNode;
  textSelection?: InfiniteCanvasWindowTextSelection;
  wheelBehavior?: InfiniteCanvasWindowWheelBehavior;
}>;

/**
 * A registry with `data` typed per kind, as it is written.
 *
 * `defineInfiniteCanvasWindowRegistry<Kind, DataByKind>` accepts this shape and
 * returns the erased `InfiniteCanvasWindowRegistry<Kind>`. The type lives at the
 * authoring boundary and nowhere else, on purpose: `renderBody` *takes* a context,
 * so `InfiniteCanvasWindowDefinition<K, {text: string}>` is not assignable to
 * `InfiniteCanvasWindowDefinition<K, unknown>`, and threading `Data` any further
 * would force every internal component signature to carry it for a guarantee the
 * framework cannot keep anyway — `window.data` really is `unknown` at runtime.
 */
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
      /**
       * Bring the selected floating windows to a shared edge or centreline of their own
       * collective bounds — never the viewport's. Aligning three windows left means "share the
       * leftmost one's left edge", not "go to the left of the screen"; the latter is
       * `window.place`, and conflating them gives two commands that both claim to align.
       */
      alignment: InfiniteCanvasAlignment;
      type: "window.align";
    }>
  /** Exactly two selected windows trade centres, each keeping its own size. */
  | Readonly<{ type: "group.equalizeChildren" }>
  | Readonly<{ type: "activeWindow.close" }>
  | Readonly<{ type: "activeWindow.minimize" }>
  | Readonly<{ type: "activeWindow.toggleMaximized" }>
  | Readonly<{ type: "activeWindow.togglePinned" }>
  | Readonly<{ type: "group.flipAxis" }>
  | Readonly<{ layout: InfiniteCanvasGroupLayoutMode; type: "group.setLayout" }>
  | Readonly<{ direction: InfiniteCanvasDirection; type: "window.dockDirection" }>
  | Readonly<{ type: "window.undock" }>
  | Readonly<{ type: "window.swap" }>
  | Readonly<{
      /**
       * Even out the gaps between the selected floating windows along one axis, holding the
       * outermost two still. Equal gaps rather than equal centres — with windows of differing
       * size the two differ, and equal gaps is what every tool means by "distribute".
       */
      distribution: InfiniteCanvasDistribution;
      type: "window.distribute";
    }>
  | Readonly<{
      /** Where in the visible region the active window lands. Never snapped. */
      region: InfiniteCanvasWindowPlacementRegion;
      type: "window.place";
    }>
  | Readonly<{
      /** Screen pixels, converted through the camera like a nudge. */
      amountPx: number;
      /**
       * `right`/`down` grow the window; `left`/`up` shrink it. The window's origin never
       * moves — only its east and south edges do, which is what "resize" means when there is
       * no handle under a cursor to say otherwise.
       */
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
  | "group.equalizeChildren"
  | "group.flipAxis"
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
      /**
       * The shell's structural floor, measured by the caller with the same metrics it
       * laid the tree out with. Carried on the action for the same reason
       * `availableExtent` is: metrics live in the render layer, and the reducer must not
       * guess at them or a consumer with custom metrics gets a floor that disagrees with
       * the layout it can see.
       */
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
      /**
       * The user is asking to dock, not to overlap. Held during a window drag it
       * resolves a dock region under the pointer and suppresses alignment guides,
       * which are the wrong affordance once a drop target exists.
       */
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
  | Readonly<{ type: "window.close"; windowId: string }>
  | Readonly<{ type: "window.focus"; windowId: string }>
  | Readonly<{ type: "window.maximize"; windowId: string }>
  | Readonly<{ type: "window.minimize"; windowId: string }>
  | Readonly<{ type: "window.open"; window: InfiniteCanvasWindow<Kind> }>
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
  /**
   * Drag a group shell's outer edge. The tree is untouched; members re-project.
   *
   * `minSize` comes from `getInfiniteCanvasGroupMinimumSize(group.tree, metrics)` — pass
   * the same metrics the shell was laid out with.
   */
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
  InfiniteCanvasSlotElementProps,
  InfiniteCanvasSlotRender,
  InfiniteCanvasWindowFrameSlots,
  InfiniteCanvasWindowFrameSurfaceProps,
  InfiniteCanvasWindowFrameTitleProps,
  InfiniteCanvasWindowMode,
  InfiniteCanvasWindowProxy,
  InfiniteCanvasWindowRegistry,
  InfiniteCanvasWindowRegistryInput,
  InfiniteCanvasWindowRenderContext,
  InfiniteCanvasWindowTextSelection,
  InfiniteCanvasWindowWheelBehavior,
  InfiniteCanvasZoomPolicy,
  InfiniteCanvasZoomPolicyInput,
};
