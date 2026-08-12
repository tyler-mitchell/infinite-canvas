import {
  DEFAULT_INFINITE_CANVAS_CHROME,
  DEFAULT_INFINITE_CANVAS_ZOOM,
  MIN_RENDERABLE_INFINITE_CANVAS_ZOOM,
} from "./constants";
import type {
  InfiniteCanvasCamera,
  InfiniteCanvasChromeMetrics,
  InfiniteCanvasPoint,
  InfiniteCanvasRect,
  InfiniteCanvasResizeHandle,
  InfiniteCanvasSize,
  InfiniteCanvasViewport,
  InfiniteCanvasZoomPolicy,
} from "./types";

type InfiniteCanvasScreenRect = Readonly<{
  height: number;
  left: number;
  top: number;
  width: number;
}>;

type InfiniteCanvasScreenTransform = ReturnType<typeof worldRectToScreenTransform>;

type InfiniteCanvasProjectedScreenRect = Readonly<{
  rawScreenRect: InfiniteCanvasScreenRect;
  rawScreenTransform: InfiniteCanvasScreenTransform;
  screenRect: InfiniteCanvasScreenRect;
  screenTransform: InfiniteCanvasScreenTransform;
}>;

type InfiniteCanvasGridLine = Readonly<{
  id: string;
  kind: "major" | "minor";
  rect: InfiniteCanvasRect;
}>;

const WHEEL_ZOOM_DELTA_SCALE = 180;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getConstrainedZoom(
  requestedZoom: number,
  zoomPolicy: InfiniteCanvasZoomPolicy = DEFAULT_INFINITE_CANVAS_ZOOM,
) {
  return clamp(
    requestedZoom,
    Math.max(zoomPolicy.minZoom, MIN_RENDERABLE_INFINITE_CANVAS_ZOOM),
    zoomPolicy.maxZoom,
  );
}

function addPoints(left: InfiniteCanvasPoint, right: InfiniteCanvasPoint) {
  return {
    x: left.x + right.x,
    y: left.y + right.y,
  };
}

function subtractPoints(left: InfiniteCanvasPoint, right: InfiniteCanvasPoint) {
  return {
    x: left.x - right.x,
    y: left.y - right.y,
  };
}

function getRectFromPoints(
  origin: InfiniteCanvasPoint,
  current: InfiniteCanvasPoint,
): InfiniteCanvasRect {
  return {
    height: Math.abs(current.y - origin.y),
    width: Math.abs(current.x - origin.x),
    x: Math.min(origin.x, current.x),
    y: Math.min(origin.y, current.y),
  };
}

function getRectCenter(rect: InfiniteCanvasRect): InfiniteCanvasPoint {
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
  };
}

function unionRects(rects: readonly InfiniteCanvasRect[]): InfiniteCanvasRect | null {
  return rects.reduce<InfiniteCanvasRect | null>((bounds, rect) => {
    if (bounds === null) {
      return rect;
    }

    const x = Math.min(bounds.x, rect.x);
    const y = Math.min(bounds.y, rect.y);
    const right = Math.max(bounds.x + bounds.width, rect.x + rect.width);
    const bottom = Math.max(bounds.y + bounds.height, rect.y + rect.height);

    return {
      height: bottom - y,
      width: right - x,
      x,
      y,
    };
  }, null);
}

function rectsIntersect(left: InfiniteCanvasRect, right: InfiniteCanvasRect) {
  return (
    Math.min(left.x + left.width, right.x + right.width) > Math.max(left.x, right.x) &&
    Math.min(left.y + left.height, right.y + right.height) > Math.max(left.y, right.y)
  );
}

function rectContainsPoint(rect: InfiniteCanvasRect, point: InfiniteCanvasPoint) {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

function scalePoint(point: InfiniteCanvasPoint, scale: number) {
  return {
    x: point.x * scale,
    y: point.y * scale,
  };
}

function isUsableViewport(viewport: InfiniteCanvasViewport) {
  return viewport.width > 0 && viewport.height > 0;
}

function worldPointToScreenPoint(
  camera: InfiniteCanvasCamera,
  viewport: InfiniteCanvasViewport,
  point: InfiniteCanvasPoint,
): InfiniteCanvasPoint {
  return {
    x: (point.x - camera.center.x) * camera.zoom + viewport.width / 2,
    y: (point.y - camera.center.y) * camera.zoom + viewport.height / 2,
  };
}

function screenPointToWorldPoint(
  camera: InfiniteCanvasCamera,
  viewport: InfiniteCanvasViewport,
  point: InfiniteCanvasPoint,
): InfiniteCanvasPoint {
  return {
    x: camera.center.x + (point.x - viewport.width / 2) / camera.zoom,
    y: camera.center.y + (point.y - viewport.height / 2) / camera.zoom,
  };
}

function worldRectToScreenRect(
  camera: InfiniteCanvasCamera,
  viewport: InfiniteCanvasViewport,
  rect: InfiniteCanvasRect,
): InfiniteCanvasScreenRect {
  const origin = worldPointToScreenPoint(camera, viewport, rect);

  return {
    height: rect.height * camera.zoom,
    left: origin.x,
    top: origin.y,
    width: rect.width * camera.zoom,
  };
}

/**
 * Whether a world rect overlaps the viewport, expanded by `marginPx` screen pixels.
 *
 * The framework's frustum test: pure, synchronous, and derived from the camera alone.
 * Distinct from `useInfiniteCanvasWindowFramed`, which reads a store written by the R3F
 * probe layer — that ships behind the optional `/scene` entry and only runs under
 * `diagnostics.frustum`, so it cannot be the basis of a rendering decision.
 *
 * A non-finite `marginPx` means unbounded: every rect overlaps. That is how the
 * rasterization policy spells "no viewport limit".
 *
 * **An unmeasured (`0 × 0`) viewport overlaps nothing, and this returns `false`.** That
 * is the honest geometric answer, and it is a trap, because the right response to it
 * depends on what the caller does with a `false`:
 *
 * - A caller that **culls** on `false` must not cull before the first resize
 *   observation, or it paints an empty canvas and recovers only on the next camera
 *   change. Guard with {@link isUsableViewport} first.
 * - A caller that **rasterizes** on `true` wants exactly this `false`: a window whose
 *   viewport has never been measured should stay live DOM, not become a snapshot.
 *
 * Opposite defaults for the same uncertainty, so this function does not pick one.
 */
function isWorldRectWithinViewport(
  camera: InfiniteCanvasCamera,
  viewport: InfiniteCanvasViewport,
  rect: InfiniteCanvasRect,
  marginPx = 0,
): boolean {
  if (!Number.isFinite(marginPx)) {
    return true;
  }

  const screenRect = worldRectToScreenRect(camera, viewport, rect);

  return (
    screenRect.left + screenRect.width >= -marginPx &&
    screenRect.left <= viewport.width + marginPx &&
    screenRect.top + screenRect.height >= -marginPx &&
    screenRect.top <= viewport.height + marginPx
  );
}

function worldRectToScreenTransform(
  camera: InfiniteCanvasCamera,
  viewport: InfiniteCanvasViewport,
  rect: InfiniteCanvasRect,
) {
  const screenRect = worldRectToScreenRect(camera, viewport, rect);

  return {
    height: rect.height,
    scale: camera.zoom,
    width: rect.width,
    x: screenRect.left,
    y: screenRect.top,
  };
}

/**
 * A world-unit length widened so it never renders thinner than `minimumScreenPx`.
 *
 * Chrome is drawn in world units inside a zoom-scaled frame, so an authored 1px border renders as
 * `1 × scale` screen pixels — a tenth of a pixel at 10% zoom. Borders, the header rule, and the
 * inner frame all thinned to nothing and a window became an unreadable blob exactly when the user
 * zoomed out to see how their windows relate.
 *
 * Above 100% this is inert: the authored width already exceeds the floor, and a stroke that grows
 * with the canvas is what you want. A non-positive scale has no meaningful conversion, so the
 * authored width passes through rather than dividing by zero.
 *
 * Lives here rather than in `window-frame.tsx`, where it was written, because it is a world↔screen
 * conversion and holds no React — and because being unreachable from a test is how zoom arithmetic
 * ships wrong. Two defects of exactly this shape were found on 2026-08-12: a detail-level band
 * whose thresholds stranded every stock window, and a `hitRadius` measured in world units so edges
 * became unclickable as you zoomed out. Not exported from the barrel; the frame is its only caller.
 */
function getWorldLengthWithScreenFloor(
  worldLength: number,
  scale: number,
  minimumScreenPx = 1,
): number {
  return scale <= 0 ? worldLength : Math.max(worldLength, minimumScreenPx / scale);
}

function snapScreenValueToDevicePixel(value: number, devicePixelRatio: number) {
  const ratio = Math.max(devicePixelRatio, 1);

  return Math.round(value * ratio) / ratio;
}

function snapScreenTransformToDevicePixels(
  transform: InfiniteCanvasScreenTransform,
  devicePixelRatio: number,
) {
  return {
    ...transform,
    x: snapScreenValueToDevicePixel(transform.x, devicePixelRatio),
    y: snapScreenValueToDevicePixel(transform.y, devicePixelRatio),
  };
}

function screenTransformToScreenRect(transform: InfiniteCanvasScreenTransform) {
  return {
    height: transform.height * transform.scale,
    left: transform.x,
    top: transform.y,
    width: transform.width * transform.scale,
  };
}

function projectWorldRectToScreen(
  camera: InfiniteCanvasCamera,
  viewport: InfiniteCanvasViewport,
  rect: InfiniteCanvasRect,
  devicePixelRatio = 1,
): InfiniteCanvasProjectedScreenRect {
  const rawScreenTransform = worldRectToScreenTransform(camera, viewport, rect);
  const screenTransform = snapScreenTransformToDevicePixels(rawScreenTransform, devicePixelRatio);

  return {
    rawScreenRect: screenTransformToScreenRect(rawScreenTransform),
    rawScreenTransform,
    screenRect: screenTransformToScreenRect(screenTransform),
    screenTransform,
  };
}

function zoomCameraAtScreenPoint(
  camera: InfiniteCanvasCamera,
  viewport: InfiniteCanvasViewport,
  anchor: InfiniteCanvasPoint,
  requestedZoom: number,
  zoomPolicy: InfiniteCanvasZoomPolicy = DEFAULT_INFINITE_CANVAS_ZOOM,
): InfiniteCanvasCamera {
  const nextZoom = getConstrainedZoom(requestedZoom, zoomPolicy);
  const anchoredWorldPoint = screenPointToWorldPoint(camera, viewport, anchor);

  return {
    center: {
      x: anchoredWorldPoint.x - (anchor.x - viewport.width / 2) / nextZoom,
      y: anchoredWorldPoint.y - (anchor.y - viewport.height / 2) / nextZoom,
    },
    zoom: nextZoom,
  };
}

function getWheelZoomFactor(
  deltaY: number,
  zoomPolicy: InfiniteCanvasZoomPolicy = DEFAULT_INFINITE_CANVAS_ZOOM,
) {
  return (
    2 **
    clamp(
      (-deltaY / WHEEL_ZOOM_DELTA_SCALE) * zoomPolicy.wheelSensitivity,
      -zoomPolicy.wheelMaxExponent,
      zoomPolicy.wheelMaxExponent,
    )
  );
}

function panCameraByScreenDelta(
  camera: InfiniteCanvasCamera,
  delta: InfiniteCanvasPoint,
): InfiniteCanvasCamera {
  return {
    ...camera,
    center: {
      x: camera.center.x + delta.x / camera.zoom,
      y: camera.center.y + delta.y / camera.zoom,
    },
  };
}

function fitCameraToWorldRect(
  viewport: InfiniteCanvasViewport,
  rect: InfiniteCanvasRect,
  paddingPx = 80,
  zoomPolicy: InfiniteCanvasZoomPolicy = DEFAULT_INFINITE_CANVAS_ZOOM,
): InfiniteCanvasCamera | null {
  if (!isUsableViewport(viewport)) {
    return null;
  }

  const availableWidth = Math.max(viewport.width - paddingPx * 2, 1);
  const availableHeight = Math.max(viewport.height - paddingPx * 2, 1);
  const requestedZoom = Math.min(
    availableWidth / Math.max(rect.width, 1),
    availableHeight / Math.max(rect.height, 1),
  );

  return {
    center: getRectCenter(rect),
    zoom: getConstrainedZoom(requestedZoom, zoomPolicy),
  };
}

function getWindowHeaderRect(
  rect: InfiniteCanvasRect,
  chrome: InfiniteCanvasChromeMetrics = DEFAULT_INFINITE_CANVAS_CHROME,
): InfiniteCanvasRect {
  return {
    height: Math.max(chrome.headerHeight - chrome.borderWidth, 0),
    width: Math.max(rect.width - chrome.borderWidth * 2, 0),
    x: chrome.borderWidth,
    y: chrome.borderWidth,
  };
}

function getWindowBodyRect(
  rect: InfiniteCanvasRect,
  chrome: InfiniteCanvasChromeMetrics = DEFAULT_INFINITE_CANVAS_CHROME,
): InfiniteCanvasRect {
  return {
    height: Math.max(rect.height - chrome.headerHeight - chrome.borderWidth, 0),
    width: Math.max(rect.width - chrome.borderWidth * 2, 0),
    x: chrome.borderWidth,
    y: chrome.headerHeight,
  };
}

function resizeRectFromHandle(
  rect: InfiniteCanvasRect,
  handle: InfiniteCanvasResizeHandle,
  delta: InfiniteCanvasPoint,
  minSize: InfiniteCanvasSize,
): InfiniteCanvasRect {
  const west = handle === "west" || handle === "north-west" || handle === "south-west";
  const east = handle === "east" || handle === "north-east" || handle === "south-east";
  const north = handle === "north" || handle === "north-east" || handle === "north-west";
  const south = handle === "south" || handle === "south-east" || handle === "south-west";
  const width = west
    ? Math.max(rect.width - delta.x, minSize.width)
    : east
      ? Math.max(rect.width + delta.x, minSize.width)
      : rect.width;
  const height = north
    ? Math.max(rect.height - delta.y, minSize.height)
    : south
      ? Math.max(rect.height + delta.y, minSize.height)
      : rect.height;

  return {
    height,
    width,
    x: west ? rect.x + (rect.width - width) : rect.x,
    y: north ? rect.y + (rect.height - height) : rect.y,
  };
}

function getVisibleWorldRect(
  camera: InfiniteCanvasCamera,
  viewport: InfiniteCanvasViewport,
  overscan = 160,
): InfiniteCanvasRect {
  const halfWidth = viewport.width / (2 * camera.zoom);
  const halfHeight = viewport.height / (2 * camera.zoom);

  return {
    height: halfHeight * 2 + overscan * 2,
    width: halfWidth * 2 + overscan * 2,
    x: camera.center.x - halfWidth - overscan,
    y: camera.center.y - halfHeight - overscan,
  };
}

function getViewportInsetWorldRect(
  camera: InfiniteCanvasCamera,
  viewport: InfiniteCanvasViewport,
  inset: number,
): InfiniteCanvasRect {
  const topLeft = screenPointToWorldPoint(camera, viewport, {
    x: inset,
    y: inset,
  });
  const bottomRight = screenPointToWorldPoint(camera, viewport, {
    x: Math.max(viewport.width - inset, inset),
    y: Math.max(viewport.height - inset, inset),
  });

  return {
    height: Math.max(bottomRight.y - topLeft.y, 1),
    width: Math.max(bottomRight.x - topLeft.x, 1),
    x: topLeft.x,
    y: topLeft.y,
  };
}

function getAdaptiveGridSpacing(zoom: number) {
  const exponent = clamp(Math.floor(Math.log2(1 / zoom)), -2, 4);

  return 80 * 2 ** exponent;
}

function buildAxisTicks(start: number, end: number, spacing: number) {
  const first = Math.floor(start / spacing) * spacing;
  const last = Math.ceil(end / spacing) * spacing;
  const count = Math.max(Math.floor((last - first) / spacing) + 1, 0);

  return Array.from({ length: count }, (_, index) => first + index * spacing);
}

function buildGridLines(
  camera: InfiniteCanvasCamera,
  viewport: InfiniteCanvasViewport,
): readonly InfiniteCanvasGridLine[] {
  if (!isUsableViewport(viewport)) {
    return [];
  }

  const visible = getVisibleWorldRect(camera, viewport);
  const spacing = getAdaptiveGridSpacing(camera.zoom);
  const majorSpacing = spacing * 4;
  const lineThickness = Math.max(1 / camera.zoom, 0.75);
  const verticalLines = buildAxisTicks(visible.x, visible.x + visible.width, spacing).map(
    (x): InfiniteCanvasGridLine => ({
      id: `v-${x}`,
      kind: Math.abs(x % majorSpacing) < 0.0001 ? "major" : "minor",
      rect: {
        height: visible.height,
        width: lineThickness,
        x: x - lineThickness / 2,
        y: visible.y,
      },
    }),
  );
  const horizontalLines = buildAxisTicks(visible.y, visible.y + visible.height, spacing).map(
    (y): InfiniteCanvasGridLine => ({
      id: `h-${y}`,
      kind: Math.abs(y % majorSpacing) < 0.0001 ? "major" : "minor",
      rect: {
        height: lineThickness,
        width: visible.width,
        x: visible.x,
        y: y - lineThickness / 2,
      },
    }),
  );

  return [...verticalLines, ...horizontalLines];
}

export {
  addPoints,
  buildGridLines,
  clamp,
  fitCameraToWorldRect,
  getAdaptiveGridSpacing,
  getConstrainedZoom,
  getRectFromPoints,
  getRectCenter,
  getViewportInsetWorldRect,
  getVisibleWorldRect,
  getWheelZoomFactor,
  getWorldLengthWithScreenFloor,
  getWindowBodyRect,
  getWindowHeaderRect,
  isUsableViewport,
  isWorldRectWithinViewport,
  panCameraByScreenDelta,
  projectWorldRectToScreen,
  rectContainsPoint,
  rectsIntersect,
  resizeRectFromHandle,
  scalePoint,
  screenPointToWorldPoint,
  screenTransformToScreenRect,
  snapScreenTransformToDevicePixels,
  snapScreenValueToDevicePixel,
  subtractPoints,
  unionRects,
  worldPointToScreenPoint,
  worldRectToScreenRect,
  worldRectToScreenTransform,
  zoomCameraAtScreenPoint,
};

export type {
  InfiniteCanvasGridLine,
  InfiniteCanvasProjectedScreenRect,
  InfiniteCanvasScreenRect,
  InfiniteCanvasScreenTransform,
};
