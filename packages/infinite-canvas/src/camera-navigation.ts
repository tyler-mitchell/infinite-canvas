import { DEFAULT_INFINITE_CANVAS_ZOOM } from "./constants";
import {
  fitCameraToWorldRect,
  getConstrainedZoom,
  getInfiniteCanvasInsetCameraCenter,
  getRectCenter,
  isUsableViewport,
} from "./geometry";
import { getSelectedWindowBounds, getVisibleWindowBounds } from "./selection";
import type {
  InfiniteCanvasCamera,
  InfiniteCanvasCameraNavigationBehavior,
  InfiniteCanvasCameraNavigationRequest,
  InfiniteCanvasCameraNavigationTarget,
  InfiniteCanvasRect,
  InfiniteCanvasState,
  InfiniteCanvasWindow,
  InfiniteCanvasZoomPolicy,
} from "./types";

type InfiniteCanvasWindowNavigationInput = Readonly<{
  behavior?: InfiniteCanvasCameraNavigationBehavior;
  windowId: string;
}>;

const DEFAULT_INFINITE_CANVAS_CAMERA_NAVIGATION_BEHAVIOR = {
  type: "center",
} satisfies InfiniteCanvasCameraNavigationBehavior;

function getFiniteNumberOrFallback(value: number | undefined, fallback: number) {
  return value === undefined || !Number.isFinite(value) ? fallback : value;
}

function getNavigableWindow<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  windowId: string,
): InfiniteCanvasWindow<Kind> | null {
  return (
    state.windows.find((window) => window.id === windowId && window.mode !== "minimized") ?? null
  );
}

/** Optional bounds for selected targets that are not windows. */
function getCameraNavigationTargetRect<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  target: InfiniteCanvasCameraNavigationTarget,
  selectionBounds?: InfiniteCanvasRect | null,
): InfiniteCanvasRect | null {
  switch (target.type) {
    case "point":
      return {
        height: 1,
        width: 1,
        x: target.point.x - 0.5,
        y: target.point.y - 0.5,
      };
    case "rect":
      return target.rect;
    case "selection":
      return selectionBounds ?? getSelectedWindowBounds(state);
    case "visibleWindows":
      return getVisibleWindowBounds(state);
    case "window":
      return getNavigableWindow(state, target.windowId)?.rect ?? null;
  }
}

function getFitCamera(
  state: InfiniteCanvasState,
  rect: InfiniteCanvasRect,
  behavior: Extract<InfiniteCanvasCameraNavigationBehavior, { type: "fit" }>,
  zoomPolicy: InfiniteCanvasZoomPolicy,
): InfiniteCanvasCamera | null {
  const fitCamera = fitCameraToWorldRect(
    state.viewport,
    rect,
    behavior.paddingPx ?? 80,
    zoomPolicy,
    state.viewportInsets,
  );
  const maxZoom = getFiniteNumberOrFallback(behavior.maxZoom, Number.POSITIVE_INFINITY);

  return fitCamera === null
    ? null
    : {
        ...fitCamera,
        zoom: Math.min(fitCamera.zoom, getConstrainedZoom(maxZoom, zoomPolicy)),
      };
}

function getCameraNavigationFrame(
  state: InfiniteCanvasState,
  rect: InfiniteCanvasRect,
  behavior: InfiniteCanvasCameraNavigationBehavior = DEFAULT_INFINITE_CANVAS_CAMERA_NAVIGATION_BEHAVIOR,
  zoomPolicy: InfiniteCanvasZoomPolicy = DEFAULT_INFINITE_CANVAS_ZOOM,
): InfiniteCanvasCamera | null {
  // Center in the visible region with inset offsets at the target zoom.
  const center = getRectCenter(rect);

  switch (behavior.type) {
    case "center":
      return {
        ...state.camera,
        center: getInfiniteCanvasInsetCameraCenter(center, state.camera.zoom, state.viewportInsets),
      };
    case "centerAtZoom": {
      const zoom = getConstrainedZoom(
        getFiniteNumberOrFallback(behavior.zoom, state.camera.zoom),
        zoomPolicy,
      );

      return {
        center: getInfiniteCanvasInsetCameraCenter(center, zoom, state.viewportInsets),
        zoom,
      };
    }
    case "fit":
      return getFitCamera(state, rect, behavior, zoomPolicy);
  }
}

function isCameraNavigationAvailable<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  request: InfiniteCanvasCameraNavigationRequest,
  selectionBounds?: InfiniteCanvasRect | null,
) {
  const rect = getCameraNavigationTargetRect(state, request.target, selectionBounds);
  const behavior = request.behavior ?? DEFAULT_INFINITE_CANVAS_CAMERA_NAVIGATION_BEHAVIOR;

  return rect !== null && (behavior.type !== "fit" || isUsableViewport(state.viewport));
}

function navigateCamera<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  request: InfiniteCanvasCameraNavigationRequest,
  zoomPolicy: InfiniteCanvasZoomPolicy = DEFAULT_INFINITE_CANVAS_ZOOM,
  selectionBounds?: InfiniteCanvasRect | null,
): InfiniteCanvasState<Kind> {
  const rect = getCameraNavigationTargetRect(state, request.target, selectionBounds);
  const camera =
    rect === null
      ? null
      : getCameraNavigationFrame(
          state,
          rect,
          request.behavior ?? DEFAULT_INFINITE_CANVAS_CAMERA_NAVIGATION_BEHAVIOR,
          zoomPolicy,
        );

  return camera === null
    ? state
    : {
        ...state,
        camera,
        interaction: null,
        snapPreview: null,
      };
}

function navigateCameraToWindow<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  input: InfiniteCanvasWindowNavigationInput,
  zoomPolicy: InfiniteCanvasZoomPolicy = DEFAULT_INFINITE_CANVAS_ZOOM,
) {
  return navigateCamera(
    state,
    {
      behavior: input.behavior,
      target: {
        type: "window",
        windowId: input.windowId,
      },
    },
    zoomPolicy,
  );
}

export {
  DEFAULT_INFINITE_CANVAS_CAMERA_NAVIGATION_BEHAVIOR,
  getCameraNavigationFrame,
  getCameraNavigationTargetRect,
  getNavigableWindow,
  isCameraNavigationAvailable,
  navigateCamera,
  navigateCameraToWindow,
};

export type { InfiniteCanvasWindowNavigationInput };
