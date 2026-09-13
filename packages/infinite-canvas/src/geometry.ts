import {
  DEFAULT_INFINITE_CANVAS_CHROME,
  DEFAULT_INFINITE_CANVAS_ZOOM,
  MIN_RENDERABLE_INFINITE_CANVAS_ZOOM,
  NO_INFINITE_CANVAS_VIEWPORT_INSETS,
  type InfiniteCanvasEdgePanPolicy,
} from "./constants";
import type {
  InfiniteCanvasCamera,
  InfiniteCanvasChromeMetrics,
  InfiniteCanvasPoint,
  InfiniteCanvasRect,
  InfiniteCanvasResizeHandle,
  InfiniteCanvasSize,
  InfiniteCanvasViewport,
  InfiniteCanvasViewportInsets,
  InfiniteCanvasViewportOccluder,
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

/**
 * Whether two rects cover the same region. Absent is a value: two absent rects
 * are the same, and one absent rect differs from any real one, so a caller
 * asking "did this change" needs no check of its own.
 */
function rectsEqual(
  left: InfiniteCanvasRect | null | undefined,
  right: InfiniteCanvasRect | null | undefined,
) {
  // Both absent is equal; one absent is not. Undefined and null are the same absence.
  if (left === null || left === undefined || right === null || right === undefined) {
    return (left ?? null) === (right ?? null);
  }

  return (
    left.x === right.x &&
    left.y === right.y &&
    left.width === right.width &&
    left.height === right.height
  );
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

/** Tests a rect against the viewport margin. An unusable viewport matches no rects. */
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

/** Converts a world width with a minimum screen-pixel width. */
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

/*
 * Both edges land on the device pixel grid, not only the origin.
 *
 * Snapping the origin alone leaves the far edge wherever a fractional extent puts it, so a window
 * whose height is 240.42 draws a crisp top border and a blurred bottom one. A resize produces such
 * a height, and a hairline is the only thing separating a surface from the canvas.
 *
 * The far edge is snapped and the extent derived from it, rather than the extent snapped on its
 * own, so rounding cannot push the two edges apart.
 */
function snapScreenTransformToDevicePixels(
  transform: InfiniteCanvasScreenTransform,
  devicePixelRatio: number,
) {
  const x = snapScreenValueToDevicePixel(transform.x, devicePixelRatio);
  const y = snapScreenValueToDevicePixel(transform.y, devicePixelRatio);

  if (transform.scale <= 0) {
    return { ...transform, x, y };
  }

  const right = snapScreenValueToDevicePixel(
    transform.x + transform.width * transform.scale,
    devicePixelRatio,
  );
  const bottom = snapScreenValueToDevicePixel(
    transform.y + transform.height * transform.scale,
    devicePixelRatio,
  );

  return {
    ...transform,
    // The extent stays in world units, because the frame is sized in them and scaled.
    height: (bottom - y) / transform.scale,
    width: (right - x) / transform.scale,
    x,
    y,
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

/**
 * Pan speed for one axis, in screen pixels per second.
 *
 * Zero until the pointer enters the band, then eased to full speed at the edge
 * and held there beyond it, so a pointer dragged outside the viewport keeps
 * travelling rather than stopping at the boundary.
 */
function getEdgePanAxisSpeed(
  position: number,
  min: number,
  max: number,
  bandPx: number,
  maxSpeedPxPerSecond: number,
) {
  const fromMin = position - min;
  const fromMax = max - position;

  if (fromMin < bandPx) {
    return -maxSpeedPxPerSecond * clamp((bandPx - fromMin) / bandPx, 0, 1);
  }

  return fromMax < bandPx ? maxSpeedPxPerSecond * clamp((bandPx - fromMax) / bandPx, 0, 1) : 0;
}

/**
 * How fast a drag held at `point` should pan the canvas, in screen pixels per
 * second, or `null` when the pointer is clear of every edge.
 *
 * Measured from the content viewport rather than the whole one: chrome covers
 * the outer edges, and a band underneath a panel is a band the pointer can
 * never reach.
 *
 * `null` rather than a zero vector, so a caller can stop its loop on the same
 * value that says there is nothing to do.
 */
function getInfiniteCanvasEdgePanVelocity(
  viewport: InfiniteCanvasViewport,
  point: InfiniteCanvasPoint,
  policy: InfiniteCanvasEdgePanPolicy,
  insets?: InfiniteCanvasViewportInsets,
): InfiniteCanvasPoint | null {
  const content = getInfiniteCanvasContentViewport(viewport, insets);
  const velocity = {
    x: getEdgePanAxisSpeed(
      point.x,
      content.x,
      content.x + content.width,
      policy.bandPx,
      policy.maxSpeedPxPerSecond,
    ),
    y: getEdgePanAxisSpeed(
      point.y,
      content.y,
      content.y + content.height,
      policy.bandPx,
      policy.maxSpeedPxPerSecond,
    ),
  };

  return velocity.x === 0 && velocity.y === 0 ? null : velocity;
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

/** Fits a world rect inside the viewport region that chrome does not cover. */
function fitCameraToWorldRect(
  viewport: InfiniteCanvasViewport,
  rect: InfiniteCanvasRect,
  paddingPx = 80,
  zoomPolicy: InfiniteCanvasZoomPolicy = DEFAULT_INFINITE_CANVAS_ZOOM,
  insets: InfiniteCanvasViewportInsets = NO_INFINITE_CANVAS_VIEWPORT_INSETS,
): InfiniteCanvasCamera | null {
  if (!isUsableViewport(viewport)) {
    return null;
  }

  const content = getInfiniteCanvasContentViewport(viewport, insets);
  const availableWidth = Math.max(content.width - paddingPx * 2, 1);
  const availableHeight = Math.max(content.height - paddingPx * 2, 1);
  const requestedZoom = Math.min(
    availableWidth / Math.max(rect.width, 1),
    availableHeight / Math.max(rect.height, 1),
  );
  const zoom = getConstrainedZoom(requestedZoom, zoomPolicy);

  return {
    center: getInfiniteCanvasInsetCameraCenter(getRectCenter(rect), zoom, insets),
    zoom,
  };
}

/*
 * Where the chrome actually sits, measured against what the frame draws.
 *
 * `headerHeight` is the header's own height, and the border is outside it on every side. The
 * header therefore starts one border in, and the body starts below the header with a second
 * border still to come at the bottom.
 *
 * These two used to spend one border between them, as though the top border were part of the
 * header. Measured on a live 240.5 window with a 2px border and a 32px header: the header draws
 * 32 tall starting 2 down, and the body draws 204.5, while the model claimed a 30 header and a
 * 206.5 body. Every consumer lays content out against that body size.
 */
function getWindowHeaderRect(
  rect: InfiniteCanvasRect,
  chrome: InfiniteCanvasChromeMetrics = DEFAULT_INFINITE_CANVAS_CHROME,
): InfiniteCanvasRect {
  return {
    height: Math.max(chrome.headerHeight, 0),
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
    height: Math.max(rect.height - chrome.headerHeight - chrome.borderWidth * 2, 0),
    width: Math.max(rect.width - chrome.borderWidth * 2, 0),
    x: chrome.borderWidth,
    y: chrome.headerHeight + chrome.borderWidth,
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

/** Returns the screen region that viewport insets do not cover. */
function getInfiniteCanvasContentViewport(
  viewport: InfiniteCanvasViewport,
  insets: InfiniteCanvasViewportInsets = NO_INFINITE_CANVAS_VIEWPORT_INSETS,
): InfiniteCanvasRect {
  return {
    height: Math.max(viewport.height - insets.top - insets.bottom, 1),
    width: Math.max(viewport.width - insets.left - insets.right, 1),
    x: insets.left,
    y: insets.top,
  };
}

/** Returns the camera center that puts a world point in the visible-region center. */
function getInfiniteCanvasInsetCameraCenter(
  center: InfiniteCanvasPoint,
  zoom: number,
  insets: InfiniteCanvasViewportInsets = NO_INFINITE_CANVAS_VIEWPORT_INSETS,
): InfiniteCanvasPoint {
  const scale = Math.max(zoom, Number.EPSILON);

  return {
    x: center.x - (insets.left - insets.right) / (2 * scale),
    y: center.y - (insets.top - insets.bottom) / (2 * scale),
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

/** Returns the visible world region after viewport insets. */
function getInfiniteCanvasContentWorldRect(
  camera: InfiniteCanvasCamera,
  viewport: InfiniteCanvasViewport,
  insets: InfiniteCanvasViewportInsets = NO_INFINITE_CANVAS_VIEWPORT_INSETS,
): InfiniteCanvasRect {
  const content = getInfiniteCanvasContentViewport(viewport, insets);
  const origin = screenPointToWorldPoint(camera, viewport, { x: content.x, y: content.y });
  const scale = Math.max(camera.zoom, Number.EPSILON);

  return {
    height: content.height / scale,
    width: content.width / scale,
    x: origin.x,
    y: origin.y,
  };
}

/** Converts in-content screen occluders to world rectangles for placement. */
function getInfiniteCanvasOccluderWorldRects(
  camera: InfiniteCanvasCamera,
  viewport: InfiniteCanvasViewport,
  occluders: readonly InfiniteCanvasViewportOccluder[],
): readonly InfiniteCanvasRect[] {
  const scale = Math.max(camera.zoom, Number.EPSILON);

  return occluders.map((occluder) => {
    const origin = screenPointToWorldPoint(camera, viewport, { x: occluder.x, y: occluder.y });

    return {
      height: occluder.height / scale,
      width: occluder.width / scale,
      x: origin.x,
      y: origin.y,
    };
  });
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
  buildGridLines,
  clamp,
  fitCameraToWorldRect,
  getAdaptiveGridSpacing,
  getConstrainedZoom,
  getInfiniteCanvasContentViewport,
  getInfiniteCanvasContentWorldRect,
  getInfiniteCanvasOccluderWorldRects,
  getInfiniteCanvasInsetCameraCenter,
  getRectFromPoints,
  getRectCenter,
  getViewportInsetWorldRect,
  getInfiniteCanvasEdgePanVelocity,
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
  rectsEqual,
  rectsIntersect,
  resizeRectFromHandle,
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
