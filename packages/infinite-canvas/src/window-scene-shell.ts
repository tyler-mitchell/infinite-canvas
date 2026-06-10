import { projectWorldRectToScreen, worldRectToScreenTransform } from "./geometry";
import type {
  InfiniteCanvasCamera,
  InfiniteCanvasChromeMetrics,
  InfiniteCanvasPoint,
  InfiniteCanvasRect,
  InfiniteCanvasResizeHandle,
  InfiniteCanvasViewport,
} from "./types";

type InfiniteCanvasScenePlane = Readonly<{
  center: InfiniteCanvasPoint;
  height: number;
  width: number;
}>;

type InfiniteCanvasWindowSceneChromeMetrics = InfiniteCanvasChromeMetrics &
  Readonly<{
    activeCornerInset: number;
    activeCornerStrokeWidth: number;
    activeCornerSize: number;
    headerPaddingX: number;
    layoutBorderWidth: number;
    shadowOffset: number;
  }>;

type InfiniteCanvasWindowSceneHandle = Readonly<{
  cursor: string;
  handle: InfiniteCanvasResizeHandle;
  rect: InfiniteCanvasRect;
}>;

type InfiniteCanvasWindowSceneShellLayout = Readonly<{
  activeCornerRects: readonly InfiniteCanvasRect[];
  bodyPlane: InfiniteCanvasScenePlane;
  bodyRect: InfiniteCanvasRect;
  edgeRects: readonly InfiniteCanvasRect[];
  headerAccentRect: InfiniteCanvasRect;
  headerPlane: InfiniteCanvasScenePlane;
  headerRect: InfiniteCanvasRect;
  resizeHandles: readonly InfiniteCanvasWindowSceneHandle[];
}>;

type InfiniteCanvasWindowSceneShell = Readonly<{
  chromeMetrics: InfiniteCanvasWindowSceneChromeMetrics;
  frameLocalRect: InfiniteCanvasRect;
  shellLayout: InfiniteCanvasWindowSceneShellLayout;
}>;

type InfiniteCanvasScreenTransform = ReturnType<typeof worldRectToScreenTransform>;

type InfiniteCanvasWindowBodyProjection = InfiniteCanvasWindowSceneShell &
  Readonly<{
    bodyLocalRect: InfiniteCanvasRect;
    bodyScreenTransform: InfiniteCanvasScreenTransform;
    bodyWorldRect: InfiniteCanvasRect;
    frameScreenTransform: InfiniteCanvasScreenTransform;
  }>;

function getMinimumWorldLength(zoom: number, baseLength: number, minimumScreenLength: number) {
  return zoom <= 0 ? baseLength : Math.max(baseLength, minimumScreenLength / zoom);
}

function getInfiniteCanvasWindowSceneChromeMetrics(
  chrome: InfiniteCanvasChromeMetrics,
  zoom: number,
): InfiniteCanvasWindowSceneChromeMetrics {
  return {
    ...chrome,
    activeCornerInset: getMinimumWorldLength(zoom, 8, 4),
    activeCornerSize: getMinimumWorldLength(zoom, chrome.cornerSize + 2, 6),
    activeCornerStrokeWidth: getMinimumWorldLength(zoom, 1, 1),
    borderWidth: getMinimumWorldLength(zoom, chrome.borderWidth, 1),
    headerAccentHeight: getMinimumWorldLength(zoom, chrome.headerAccentHeight, 1.5),
    headerPaddingX: getMinimumWorldLength(zoom, 12, 6),
    layoutBorderWidth: chrome.borderWidth,
    resizeHandleSize: getMinimumWorldLength(zoom, chrome.resizeHandleSize, 10),
    shadowOffset: getMinimumWorldLength(zoom, 12, 4),
  };
}

function createInfiniteCanvasWindowLocalFrameRect(
  windowRect: Pick<InfiniteCanvasRect, "height" | "width">,
): InfiniteCanvasRect {
  return {
    height: windowRect.height,
    width: windowRect.width,
    x: 0,
    y: 0,
  };
}

function frameLocalPointToScenePoint(
  frameRect: Pick<InfiniteCanvasRect, "height" | "width">,
  point: InfiniteCanvasPoint,
): InfiniteCanvasPoint {
  return {
    x: -frameRect.width / 2 + point.x,
    y: frameRect.height / 2 - point.y,
  };
}

function frameLocalRectToScenePlane(
  frameRect: Pick<InfiniteCanvasRect, "height" | "width">,
  localRect: InfiniteCanvasRect,
): InfiniteCanvasScenePlane {
  return {
    center: frameLocalPointToScenePoint(frameRect, {
      x: localRect.x + localRect.width / 2,
      y: localRect.y + localRect.height / 2,
    }),
    height: localRect.height,
    width: localRect.width,
  };
}

function getWindowLocalHeaderRect(
  frameRect: InfiniteCanvasRect,
  chromeMetrics: Pick<InfiniteCanvasWindowSceneChromeMetrics, "headerHeight" | "layoutBorderWidth">,
): InfiniteCanvasRect {
  return {
    height: Math.max(chromeMetrics.headerHeight - chromeMetrics.layoutBorderWidth, 0),
    width: Math.max(frameRect.width - chromeMetrics.layoutBorderWidth * 2, 0),
    x: chromeMetrics.layoutBorderWidth,
    y: chromeMetrics.layoutBorderWidth,
  };
}

function getWindowLocalBodyRect(
  frameRect: InfiniteCanvasRect,
  chromeMetrics: Pick<InfiniteCanvasWindowSceneChromeMetrics, "headerHeight" | "layoutBorderWidth">,
): InfiniteCanvasRect {
  return {
    height: Math.max(
      frameRect.height - chromeMetrics.headerHeight - chromeMetrics.layoutBorderWidth,
      0,
    ),
    width: Math.max(frameRect.width - chromeMetrics.layoutBorderWidth * 2, 0),
    x: chromeMetrics.layoutBorderWidth,
    y: chromeMetrics.headerHeight,
  };
}

function createEdgeRects(
  frameRect: InfiniteCanvasRect,
  borderWidth: number,
): readonly InfiniteCanvasRect[] {
  return [
    {
      height: borderWidth,
      width: frameRect.width,
      x: 0,
      y: 0,
    },
    {
      height: frameRect.height,
      width: borderWidth,
      x: 0,
      y: 0,
    },
    {
      height: borderWidth,
      width: frameRect.width,
      x: 0,
      y: frameRect.height - borderWidth,
    },
    {
      height: frameRect.height,
      width: borderWidth,
      x: frameRect.width - borderWidth,
      y: 0,
    },
  ];
}

function createActiveCornerRects(
  frameRect: InfiniteCanvasRect,
  inset: number,
  size: number,
  strokeWidth: number,
): readonly InfiniteCanvasRect[] {
  const rightX = frameRect.width - inset - size;
  const bottomY = frameRect.height - inset - size;

  return [
    { height: strokeWidth, width: size, x: inset, y: inset },
    { height: size, width: strokeWidth, x: inset, y: inset },
    { height: strokeWidth, width: size, x: rightX, y: inset },
    { height: size, width: strokeWidth, x: rightX + size - strokeWidth, y: inset },
    { height: strokeWidth, width: size, x: inset, y: bottomY + size - strokeWidth },
    { height: size, width: strokeWidth, x: inset, y: bottomY },
    { height: strokeWidth, width: size, x: rightX, y: bottomY + size - strokeWidth },
    { height: size, width: strokeWidth, x: rightX + size - strokeWidth, y: bottomY },
  ];
}

function createSceneHandle(
  handle: InfiniteCanvasResizeHandle,
  cursor: string,
  rect: InfiniteCanvasRect,
): InfiniteCanvasWindowSceneHandle {
  return {
    cursor,
    handle,
    rect,
  };
}

function getWindowLocalSceneResizeHandles(
  frameRect: InfiniteCanvasRect,
  handleSize: number,
): readonly InfiniteCanvasWindowSceneHandle[] {
  const halfHandleSize = handleSize / 2;

  return [
    createSceneHandle("north", "ns-resize", {
      height: handleSize,
      width: Math.max(frameRect.width - handleSize * 2, 0),
      x: handleSize,
      y: -halfHandleSize,
    }),
    createSceneHandle("south", "ns-resize", {
      height: handleSize,
      width: Math.max(frameRect.width - handleSize * 2, 0),
      x: handleSize,
      y: frameRect.height - halfHandleSize,
    }),
    createSceneHandle("east", "ew-resize", {
      height: Math.max(frameRect.height - handleSize * 2, 0),
      width: handleSize,
      x: frameRect.width - halfHandleSize,
      y: handleSize,
    }),
    createSceneHandle("west", "ew-resize", {
      height: Math.max(frameRect.height - handleSize * 2, 0),
      width: handleSize,
      x: -halfHandleSize,
      y: handleSize,
    }),
    createSceneHandle("north-east", "nesw-resize", {
      height: handleSize,
      width: handleSize,
      x: frameRect.width - halfHandleSize,
      y: -halfHandleSize,
    }),
    createSceneHandle("north-west", "nwse-resize", {
      height: handleSize,
      width: handleSize,
      x: -halfHandleSize,
      y: -halfHandleSize,
    }),
    createSceneHandle("south-east", "nwse-resize", {
      height: handleSize,
      width: handleSize,
      x: frameRect.width - halfHandleSize,
      y: frameRect.height - halfHandleSize,
    }),
    createSceneHandle("south-west", "nesw-resize", {
      height: handleSize,
      width: handleSize,
      x: -halfHandleSize,
      y: frameRect.height - halfHandleSize,
    }),
  ];
}

function getInfiniteCanvasWindowSceneShellLayout(
  frameRect: InfiniteCanvasRect,
  chromeMetrics: InfiniteCanvasWindowSceneChromeMetrics,
): InfiniteCanvasWindowSceneShellLayout {
  const headerRect = getWindowLocalHeaderRect(frameRect, chromeMetrics);
  const bodyRect = getWindowLocalBodyRect(frameRect, chromeMetrics);
  const headerAccentRect = {
    height: chromeMetrics.headerAccentHeight,
    width: headerRect.width,
    x: headerRect.x,
    y: headerRect.y + headerRect.height - chromeMetrics.headerAccentHeight,
  };

  return {
    activeCornerRects: createActiveCornerRects(
      frameRect,
      chromeMetrics.activeCornerInset,
      chromeMetrics.activeCornerSize,
      chromeMetrics.activeCornerStrokeWidth,
    ),
    bodyPlane: frameLocalRectToScenePlane(frameRect, bodyRect),
    bodyRect,
    edgeRects: createEdgeRects(frameRect, chromeMetrics.borderWidth),
    headerAccentRect,
    headerPlane: frameLocalRectToScenePlane(frameRect, headerRect),
    headerRect,
    resizeHandles: getWindowLocalSceneResizeHandles(frameRect, chromeMetrics.resizeHandleSize),
  };
}

function getInfiniteCanvasWindowSceneShell(
  windowRect: InfiniteCanvasRect,
  chrome: InfiniteCanvasChromeMetrics,
  zoom: number,
): InfiniteCanvasWindowSceneShell {
  const frameLocalRect = createInfiniteCanvasWindowLocalFrameRect(windowRect);
  const chromeMetrics = getInfiniteCanvasWindowSceneChromeMetrics(chrome, zoom);

  return {
    chromeMetrics,
    frameLocalRect,
    shellLayout: getInfiniteCanvasWindowSceneShellLayout(frameLocalRect, chromeMetrics),
  };
}

function toInfiniteCanvasWindowWorldRect(
  windowRect: InfiniteCanvasRect,
  localRect: InfiniteCanvasRect,
): InfiniteCanvasRect {
  return {
    height: localRect.height,
    width: localRect.width,
    x: windowRect.x + localRect.x,
    y: windowRect.y + localRect.y,
  };
}

function getInfiniteCanvasWindowBodyProjection(
  windowRect: InfiniteCanvasRect,
  camera: InfiniteCanvasCamera,
  viewport: InfiniteCanvasViewport,
  chrome: InfiniteCanvasChromeMetrics,
  devicePixelRatio = 1,
): InfiniteCanvasWindowBodyProjection {
  const sceneShell = getInfiniteCanvasWindowSceneShell(windowRect, chrome, camera.zoom);
  const bodyLocalRect = sceneShell.shellLayout.bodyRect;
  const bodyWorldRect = toInfiniteCanvasWindowWorldRect(windowRect, bodyLocalRect);
  const frameProjection = projectWorldRectToScreen(camera, viewport, windowRect, devicePixelRatio);
  const bodyProjection = projectWorldRectToScreen(
    camera,
    viewport,
    bodyWorldRect,
    devicePixelRatio,
  );

  return {
    ...sceneShell,
    bodyLocalRect,
    bodyScreenTransform: bodyProjection.screenTransform,
    bodyWorldRect,
    frameScreenTransform: frameProjection.screenTransform,
  };
}

export {
  createInfiniteCanvasWindowLocalFrameRect,
  frameLocalPointToScenePoint,
  frameLocalRectToScenePlane,
  getInfiniteCanvasWindowBodyProjection,
  getInfiniteCanvasWindowSceneChromeMetrics,
  getInfiniteCanvasWindowSceneShell,
  getInfiniteCanvasWindowSceneShellLayout,
  getMinimumWorldLength,
  toInfiniteCanvasWindowWorldRect,
};
export type {
  InfiniteCanvasScenePlane,
  InfiniteCanvasWindowBodyProjection,
  InfiniteCanvasWindowSceneChromeMetrics,
  InfiniteCanvasWindowSceneHandle,
  InfiniteCanvasWindowSceneShell,
  InfiniteCanvasWindowSceneShellLayout,
};
