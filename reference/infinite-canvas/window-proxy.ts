import { DEFAULT_INFINITE_CANVAS_CHROME } from "#/experiments/infinite-canvas/constants";
import { projectWorldRectToScreen } from "#/experiments/infinite-canvas/geometry";
import { isWindowSelected } from "#/experiments/infinite-canvas/selection";
import { getInfiniteCanvasWindowBodyProjection } from "#/experiments/infinite-canvas/window-scene-shell";
import type {
  InfiniteCanvasChromeMetrics,
  InfiniteCanvasPoint,
  InfiniteCanvasRect,
  InfiniteCanvasState,
  InfiniteCanvasWindow,
  InfiniteCanvasWindowProxy,
} from "#/experiments/infinite-canvas/types";

function getScenePosition(point: InfiniteCanvasPoint) {
  return [point.x, -point.y, 0] as const;
}

function getScreenRect<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  window: InfiniteCanvasWindow<Kind>,
  devicePixelRatio = 1,
): InfiniteCanvasRect {
  const projection = projectWorldRectToScreen(
    state.camera,
    state.viewport,
    window.rect,
    devicePixelRatio,
  );

  return {
    height: projection.screenRect.height,
    width: projection.screenRect.width,
    x: projection.screenRect.left,
    y: projection.screenRect.top,
  };
}

function getInfiniteCanvasWindowProxy<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  window: InfiniteCanvasWindow<Kind>,
  chrome: InfiniteCanvasChromeMetrics = DEFAULT_INFINITE_CANVAS_CHROME,
  devicePixelRatio = 1,
): InfiniteCanvasWindowProxy<Kind> {
  const bodyProjection = getInfiniteCanvasWindowBodyProjection(
    window.rect,
    state.camera,
    state.viewport,
    chrome,
    devicePixelRatio,
  );
  const center = {
    x: window.rect.x + window.rect.width / 2,
    y: window.rect.y + window.rect.height / 2,
  };
  const screenRect = getScreenRect(state, window, devicePixelRatio);
  const screenCenter = {
    x: screenRect.x + screenRect.width / 2,
    y: screenRect.y + screenRect.height / 2,
  };
  const bodyCenter = {
    x: bodyProjection.bodyWorldRect.x + bodyProjection.bodyWorldRect.width / 2,
    y: bodyProjection.bodyWorldRect.y + bodyProjection.bodyWorldRect.height / 2,
  };
  const frameScenePosition = getScenePosition(center);
  const bodyScenePosition = getScenePosition(bodyCenter);
  const screenPosition = getScenePosition(screenCenter);

  return {
    bodyLocalRect: bodyProjection.bodyLocalRect,
    bodyScenePosition,
    bodyWorldRect: bodyProjection.bodyWorldRect,
    center,
    frameScenePosition,
    frameWorldRect: window.rect,
    id: window.id,
    isActive: state.activeWindowId === window.id,
    isPinned: window.isPinned,
    isSelected: isWindowSelected(state, window.id),
    kind: window.kind,
    mode: window.mode,
    rect: window.rect,
    screenCenter,
    screenPosition,
    screenRect,
    screenSize: {
      height: screenRect.height,
      width: screenRect.width,
    },
    size: {
      height: window.rect.height,
      width: window.rect.width,
    },
    title: window.title,
    zIndex: window.zIndex,
  };
}

function getInfiniteCanvasWindowProxies<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  chrome: InfiniteCanvasChromeMetrics = DEFAULT_INFINITE_CANVAS_CHROME,
  devicePixelRatio = 1,
): readonly InfiniteCanvasWindowProxy<Kind>[] {
  return state.windows
    .filter((window) => window.mode !== "minimized")
    .map((window) => getInfiniteCanvasWindowProxy(state, window, chrome, devicePixelRatio));
}

const getInfiniteCanvasWindowSceneModel = getInfiniteCanvasWindowProxy;
const getInfiniteCanvasWindowSceneModels = getInfiniteCanvasWindowProxies;

export {
  getInfiniteCanvasWindowProxies,
  getInfiniteCanvasWindowProxy,
  getInfiniteCanvasWindowSceneModels,
  getInfiniteCanvasWindowSceneModel,
};
