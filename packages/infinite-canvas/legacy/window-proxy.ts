import { DEFAULT_INFINITE_CANVAS_CHROME } from "./constants";
import { getWindowBodyRect, projectWorldRectToScreen } from "./geometry";
import type { CanvasLayout } from "./layout";
import { isSelectionTargetSelected } from "./selection";
import type {
  InfiniteCanvasChromeMetrics,
  InfiniteCanvasRect,
  InfiniteCanvasState,
  InfiniteCanvasWindow,
  InfiniteCanvasWindowProxy,
} from "./types";

function getInfiniteCanvasWindowProxy<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  window: InfiniteCanvasWindow<Kind>,
  rect: InfiniteCanvasRect,
  chrome: InfiniteCanvasChromeMetrics = DEFAULT_INFINITE_CANVAS_CHROME,
  devicePixelRatio = 1,
): InfiniteCanvasWindowProxy<Kind> {
  const bodyLocalRect = getWindowBodyRect(rect, chrome);
  const bodyWorldRect = {
    ...bodyLocalRect,
    x: rect.x + bodyLocalRect.x,
    y: rect.y + bodyLocalRect.y,
  };
  const center = {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
  };
  const { screenRect: bounds } = projectWorldRectToScreen(
    state.camera,
    state.viewport,
    rect,
    devicePixelRatio,
  );
  const screenRect = { height: bounds.height, width: bounds.width, x: bounds.left, y: bounds.top };
  const screenCenter = {
    x: screenRect.x + screenRect.width / 2,
    y: screenRect.y + screenRect.height / 2,
  };
  return {
    bodyLocalRect,
    bodyWorldRect,
    center,
    frameWorldRect: rect,
    id: window.id,
    isActive: state.activeWindowId === window.id,
    isPinned: window.isPinned,
    isSelected: isSelectionTargetSelected(state.selection, { type: "window", id: window.id }),
    kind: window.kind,
    mode: window.mode,
    rect,
    screenCenter,
    screenRect,
    screenSize: {
      height: screenRect.height,
      width: screenRect.width,
    },
    size: {
      height: rect.height,
      width: rect.width,
    },
    title: window.title,
    zIndex: window.zIndex,
  };
}

function getInfiniteCanvasWindowProxies<Kind extends string>({
  chrome = DEFAULT_INFINITE_CANVAS_CHROME,
  devicePixelRatio = 1,
  canvasLayout,
  state,
}: Readonly<{
  chrome?: InfiniteCanvasChromeMetrics;
  devicePixelRatio?: number;
  canvasLayout: CanvasLayout;
  state: InfiniteCanvasState<Kind>;
}>): readonly InfiniteCanvasWindowProxy<Kind>[] {
  return state.windows.flatMap((window) => {
    const rect = canvasLayout.windowRects.get(window.id);
    if (rect === undefined) return [];
    return [getInfiniteCanvasWindowProxy(state, window, rect, chrome, devicePixelRatio)];
  });
}

export { getInfiniteCanvasWindowProxies };
