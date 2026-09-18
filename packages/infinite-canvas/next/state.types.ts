import type { ArkErrors, Type } from "arktype";
import type { Observable } from "@legendapp/state";
import type { Camera, Point, Rect, ResizeHandle, Size } from "./geometry";
import type { CameraMotion, ViewportInsets } from "./camera";
import type { ComponentActionRuntime, ComponentDrop, WindowCreation } from "./components";
import type {
  DocumentState,
  WindowCapabilities,
  WindowLayout,
  WindowState,
} from "./document.types";
import type { BoundLayout } from "./layout/arrange";
import type { DockEdge, Layout } from "./layout/kinds";
import type { Selection, SelectionMode, TargetKey } from "./selection";
import type { createCanvasState } from "./state";
import type { canvasSnapshot } from "./state.schema";
import type { ComputedContext } from "./state.computed";
import type { SnappingOptions } from "./alignment";

export type PointerState = {
  pointerId: number;
  point: Point;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
};

export type WindowPress = {
  undock: boolean;
  windowId: string;
  pointerId: number;
  point: Point;
  worldPoint: Point;
  threshold: number;
  handle: ResizeHandle | null;
};

export type Marquee = {
  pointerId: number;
  startPoint: Point;
  selection: Selection;
  mode: SelectionMode;
};

export type TabDrag = {
  container: string;
  child: string;
  pointerId: number;
  startPoint: Point;
  threshold: number;
  target: string | null;
  after: boolean;
};

export type WindowDrag = {
  pointerId: number;
  startPoint: Point;
  startRects: Record<string, Rect>;
  containers: Record<string, string>;
} & (
  | { kind: "move"; detached: Record<string, Rect>; target: string; alignmentTargets: Rect[] }
  | { kind: "resize"; handle: ResizeHandle }
);

export type SashDrag = {
  kind: "sash";
  pointerId: number;
  startPoint: Point;
  container: string;
  axis: "horizontal" | "vertical";
  index: number;
  sizes: number[];
};

export type WindowDefinition = {
  size: Size;
  minSize: Size;
  aspectRatio?: number;
  capabilities: WindowCapabilities;
  bodyDragThreshold: number;
  headerDragThreshold: number;
  resizeDragThreshold: number;
  maximizePadding: number;
  detail: { summaryBelow: number; fullAbove: number };
};

export type WindowDefinitionInput = Partial<Omit<WindowDefinition, "capabilities" | "detail">> & {
  capabilities?: Partial<WindowCapabilities>;
  detail?: Partial<WindowDefinition["detail"]>;
  schema?: Type;
  label?: string;
  actions?: Readonly<Record<string, ComponentActionRuntime>>;
};

export type CanvasConfiguration = {
  components: CanvasOptions["windowDefinitions"];
  layouts: Readonly<Record<string, BoundLayout>>;
  wrappers: Readonly<Record<DockEdge, WindowLayout>>;
  grouping: WindowLayout;
  cameraMotion: CameraMotion | undefined;
};

export type CanvasContext = {
  readonly state: Observable<CanvasState>;
  readonly computed: ComputedContext["computed"];
  readonly configuration: CanvasConfiguration;
  readonly inputs: {
    movableWindow: (windowId: string) => Observable<WindowState> | ArkErrors;
    resizableWindow: (windowId: string) => Observable<WindowState> | ArkErrors;
    openWindow: (
      input: WindowCreation,
    ) => (WindowCreation & { id: string; rect: Rect; data: unknown }) | ArkErrors;
  };
};

export type ViewState = {
  activeWindowId: string | null;
  cameraStopId: string | null;
  camera: Camera;
  selection: Selection;
  stackingOrder: TargetKey[];
  activeChildren: Record<string, string>;
};

export type CanvasSnapshot = {
  content: DocumentState;
  canvasView: ViewState;
  workspaceViews: Record<string, ViewState>;
  activeWorkspaceId: string | null;
};

export type CanvasState = {
  config: {
    windowDefinitions: Record<string, WindowDefinition>;
    historyLimit: number;
    camera: { minZoom: number; maxZoom: number; zoomSpeed: number; padding: number };
    placement: {
      gap: number;
      reach: number;
      undock: "keep" | "vacancy";
      dissolve: "keep" | "vacancy";
    };
    docking: { edgeZone: number };
    dropThreshold: number;
    nudge: { step: number; largeStep: number };
    snapping: SnappingOptions;
  };
  document: CanvasSnapshot;
  session: {
    camera: { workspaceId: string | null; camera: Camera } | null;
    drop: ComponentDrop | null;
    tabDrag: TabDrag | null;
    drag: WindowDrag | SashDrag | null;
    press: WindowPress | null;
    pan: { pointerId: number; point: Point; camera: Camera } | null;
    marquee: Marquee | null;
  };
  input: {
    pointer: PointerState | null;
    viewport: Size;
    viewportInsets: ViewportInsets;
    viewportOccluders: Rect[];
    contentSizes: Record<string, Size>;
  };
};

export type CanvasOptions = {
  viewport?: Size;
  viewportInsets?: Partial<ViewportInsets>;
  viewportOccluders?: Rect[];
  placement?: Partial<CanvasState["config"]["placement"]>;
  docking?: Partial<CanvasState["config"]["docking"]>;
  dropThreshold?: number;
  nudge?: Partial<CanvasState["config"]["nudge"]>;
  snapping?: Partial<SnappingOptions>;
  historyLimit?: number;
  layouts?: Readonly<Record<string, Layout<Type, Type>>>;
  wrappers?: Partial<Record<DockEdge, WindowLayout>>;
  grouping?: WindowLayout;
  camera?: Partial<CanvasState["config"]["camera"]>;
  cameraMotion?: CameraMotion;
  windowDefinitions: Record<string, WindowDefinitionInput>;
  document?: typeof canvasSnapshot.inferIn;
};

export type Canvas = ReturnType<typeof createCanvasState>;
