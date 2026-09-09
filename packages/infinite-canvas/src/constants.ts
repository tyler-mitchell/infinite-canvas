import type {
  InfiniteCanvasCamera,
  InfiniteCanvasChromeMetrics,
  InfiniteCanvasChromeMetricsInput,
  InfiniteCanvasInputPolicy,
  InfiniteCanvasSnapPolicy,
  InfiniteCanvasStackBands,
  InfiniteCanvasTheme,
  InfiniteCanvasViewportInsets,
  InfiniteCanvasViewportInsetsInput,
  InfiniteCanvasZoomPolicy,
  InfiniteCanvasZoomPolicyInput,
} from "./types";

const DEFAULT_INFINITE_CANVAS_CAMERA: InfiniteCanvasCamera = {
  center: {
    x: 0,
    y: 0,
  },
  zoom: 1,
};

const DEFAULT_INFINITE_CANVAS_CHROME: InfiniteCanvasChromeMetrics = {
  borderWidth: 2,
  cornerSize: 10,
  // Group labels sit outside the shell.
  groupLabelSize: 20,
  headerAccentHeight: 3,
  headerHeight: 40,
  resizeHandleSize: 16,
};

function resolveInfiniteCanvasChromeMetrics(
  chrome: InfiniteCanvasChromeMetricsInput = {},
): InfiniteCanvasChromeMetrics {
  return {
    ...DEFAULT_INFINITE_CANVAS_CHROME,
    ...chrome,
  };
}

const NO_INFINITE_CANVAS_VIEWPORT_INSETS: InfiniteCanvasViewportInsets = {
  bottom: 0,
  left: 0,
  right: 0,
  top: 0,
};

/** Optional screen-pixel insets for consumer chrome on each viewport edge. */
function resolveInfiniteCanvasViewportInsets(
  insets: InfiniteCanvasViewportInsetsInput = {},
): InfiniteCanvasViewportInsets {
  return {
    ...NO_INFINITE_CANVAS_VIEWPORT_INSETS,
    ...insets,
  };
}

/**
 * How a drag held near a viewport edge moves the camera, so an object can be
 * placed outside the region visible when the drag started.
 *
 * Declared beside its default rather than in `types.ts`, matching
 * `InfiniteCanvasDiagnosticsPolicy` and `InfiniteCanvasCompositorPolicy`.
 */
type InfiniteCanvasEdgePanPolicy = Readonly<{
  /** Screen pixels in from each content edge where panning begins. */
  bandPx: number;
  /** Screen pixels per second at the edge. The speed eases in across the band. */
  maxSpeedPxPerSecond: number;
}>;

/**
 * A band roughly one window header deep, crossed in about a second and a half
 * at full speed. Wide enough to enter on purpose, slow enough to stop in.
 */
const DEFAULT_INFINITE_CANVAS_EDGE_PAN: InfiniteCanvasEdgePanPolicy = {
  bandPx: 48,
  maxSpeedPxPerSecond: 900,
};

const MIN_RENDERABLE_INFINITE_CANVAS_ZOOM = 0.01;

const DEFAULT_INFINITE_CANVAS_ZOOM: InfiniteCanvasZoomPolicy = {
  defaultZoom: 1,
  maxZoom: 2.8,
  minZoom: 0.12,
  step: 1.12,
  wheelMaxExponent: 0.5,
  wheelSensitivity: 1.35,
};

function resolveInfiniteCanvasZoomPolicy(
  zoomPolicy: InfiniteCanvasZoomPolicyInput = {},
): InfiniteCanvasZoomPolicy {
  return {
    ...DEFAULT_INFINITE_CANVAS_ZOOM,
    ...zoomPolicy,
  };
}

const DEFAULT_INFINITE_CANVAS_INPUT_POLICY: InfiniteCanvasInputPolicy = {
  emptyCanvasDrag: "pan",
};

const DEFAULT_INFINITE_CANVAS_STACK_BANDS: InfiniteCanvasStackBands = {
  overlay: 1_000_000_000,
  pinned: 1_000_000,
};

const DEFAULT_INFINITE_CANVAS_SNAP_POLICY: InfiniteCanvasSnapPolicy = {
  edgeInset: 32,
  enabled: true,
  gapThreshold: 10,
  releaseThreshold: 18,
  snapToCenters: true,
  snapToGaps: true,
  snapToViewport: false,
  snapToWindows: true,
  threshold: 10,
};

const DEFAULT_INFINITE_CANVAS_THEME: InfiniteCanvasTheme = {
  activeAccent: "#b7f4ff",
  activeBorder: "#e8fbff",
  background: "#050607",
  bodyBackground: "#07080b",
  gridMajor: "rgba(61, 102, 112, 0.24)",
  gridMinor: "rgba(38, 66, 74, 0.18)",
  headerActive: "#17262a",
  headerIdle: "#101317",
  idleBorder: "#273035",
  revealedChange: "rgba(160, 196, 204, 0.55)",
  selectionBorder: "#5f858d",
  selectionBounds: "rgba(115, 157, 165, 0.38)",
};

export type { InfiniteCanvasEdgePanPolicy };
export {
  DEFAULT_INFINITE_CANVAS_CAMERA,
  DEFAULT_INFINITE_CANVAS_CHROME,
  DEFAULT_INFINITE_CANVAS_EDGE_PAN,
  DEFAULT_INFINITE_CANVAS_INPUT_POLICY,
  DEFAULT_INFINITE_CANVAS_SNAP_POLICY,
  DEFAULT_INFINITE_CANVAS_STACK_BANDS,
  DEFAULT_INFINITE_CANVAS_THEME,
  DEFAULT_INFINITE_CANVAS_ZOOM,
  MIN_RENDERABLE_INFINITE_CANVAS_ZOOM,
  NO_INFINITE_CANVAS_VIEWPORT_INSETS,
  resolveInfiniteCanvasChromeMetrics,
  resolveInfiniteCanvasViewportInsets,
  resolveInfiniteCanvasZoomPolicy,
};
