import { DEFAULT_INFINITE_CANVAS_ZOOM } from "./constants";
import {
  fitCameraToWorldRect,
  getConstrainedZoom,
  getInfiniteCanvasInsetCameraCenter,
  getInfiniteCanvasContentViewport,
  getRectCenter,
  isUsableViewport,
  getVisibleWorldRect,
  rectsEqual,
  unionRects,
} from "./geometry";
import { getCanvasLayout, getVisibleWindowBounds } from "./layout";

import { getInfiniteCanvasSelectionBounds } from "./spatial-target";
import type {
  CameraComposition,
  InfiniteCanvasCamera,
  InfiniteCanvasCameraNavigationBehavior,
  InfiniteCanvasCameraNavigationRequest,
  InfiniteCanvasCameraNavigationTarget,
  InfiniteCanvasRect,
  InfiniteCanvasState,
  InfiniteCanvasWindow,
  InfiniteCanvasZoomPolicy,
  DocumentContent,
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

/*
 * Optional bounds for selected targets that are not windows.
 *
 * The default keeps the declared `| null` true at runtime. This switch covers every declared
 * target, so the compiler treats the end as unreachable and a caller outside TypeScript gets
 * `undefined` instead. That value passes a `=== null` guard.
 */
function getCameraNavigationTargetRect<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  target: InfiniteCanvasCameraNavigationTarget,
  selectionBounds?: InfiniteCanvasRect | null,
): InfiniteCanvasRect | null {
  switch (target.type) {
    default:
      return null;
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
      return selectionBounds ?? getInfiniteCanvasSelectionBounds({ state });
    case "visibleWindows":
      return getVisibleWindowBounds(state);
    case "group":
      return getCanvasLayout(state).groupRects.get(target.groupId) ?? null;
    case "window":
      if (getNavigableWindow(state, target.windowId) === null) return null;
      return getCanvasLayout(state).windowRects.get(target.windowId) ?? null;
  }
}

function getCameraNavigationFrame({
  state,
  rect,
  behavior = DEFAULT_INFINITE_CANVAS_CAMERA_NAVIGATION_BEHAVIOR,
  zoomPolicy = DEFAULT_INFINITE_CANVAS_ZOOM,
  composition,
}: Readonly<{
  state: InfiniteCanvasState;
  rect: InfiniteCanvasRect;
  behavior?: InfiniteCanvasCameraNavigationBehavior;
  zoomPolicy?: InfiniteCanvasZoomPolicy;
  composition?: CameraComposition;
}>): InfiniteCanvasCamera | null {
  const target = getRectCenter(rect);
  const content = getInfiniteCanvasContentViewport(state.viewport, state.viewportInsets);
  const frameAtZoom = (zoom: number): InfiniteCanvasCamera => {
    const center = getInfiniteCanvasInsetCameraCenter(target, zoom, state.viewportInsets);
    return {
      zoom,
      center: {
        x:
          center.x +
          (composition?.targetOffset?.x ?? 0) -
          (((composition?.screenPosition?.x ?? 0.5) - 0.5) * content.width) / zoom,
        y:
          center.y +
          (composition?.targetOffset?.y ?? 0) -
          (((composition?.screenPosition?.y ?? 0.5) - 0.5) * content.height) / zoom,
      },
    };
  };

  // The default carries the same runtime guarantee as the target switch above.
  switch (behavior.type) {
    default:
      return null;
    case "center":
      return frameAtZoom(state.camera.zoom);
    case "centerAtZoom": {
      const zoom = getConstrainedZoom(
        getFiniteNumberOrFallback(behavior.zoom, state.camera.zoom),
        zoomPolicy,
      );

      return frameAtZoom(zoom);
    }
    case "fit": {
      const camera = fitCameraToWorldRect({
        viewport: state.viewport,
        rect,
        zoomPolicy,
        insets: state.viewportInsets,
        paddingPx: behavior.paddingPx,
        framingMode: behavior.framingMode,
        framingSize: behavior.framingSize,
      });
      if (camera === null) return null;
      const maxZoom = getFiniteNumberOrFallback(behavior.maxZoom, Number.POSITIVE_INFINITY);
      return frameAtZoom(Math.min(camera.zoom, getConstrainedZoom(maxZoom, zoomPolicy)));
    }
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
      : getCameraNavigationFrame({
          state,
          rect,
          behavior: request.behavior,
          composition: request.composition,
          zoomPolicy,
        });

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

export function getDocumentChangeRect<Kind extends string>({
  state,
  before,
  after,
}: Readonly<{
  state: InfiniteCanvasState<Kind>;
  before: DocumentContent<Kind>;
  after: DocumentContent<Kind>;
}>): InfiniteCanvasRect | null {
  const from = getCanvasLayout({ ...state, ...before, interaction: null });
  const to = getCanvasLayout({ ...state, ...after, interaction: null });
  return unionRects(
    (["windowRects", "groupRects"] as const).flatMap((field) =>
      [...new Set([...from[field].keys(), ...to[field].keys()])].flatMap((id) => {
        const left = from[field].get(id);
        const right = to[field].get(id);
        if (left === undefined) return right === undefined ? [] : [right];
        if (right === undefined) return [left];
        return rectsEqual(left, right) ? [] : [left, right];
      }),
    ),
  );
}

export function revealDocumentChange<Kind extends string>({
  state,
  before,
  after,
}: Readonly<{
  state: InfiniteCanvasState<Kind>;
  before: DocumentContent<Kind>;
  after: DocumentContent<Kind>;
}>): InfiniteCanvasState<Kind> {
  const rect = getDocumentChangeRect({ state, before, after });
  if (rect === null) return state;
  const revealed = {
    ...state,
    revealedChange: { rect, token: (state.revealedChange?.token ?? 0) + 1 },
  };
  const visible = getVisibleWorldRect(state.camera, state.viewport);
  if (
    rect.x - 80 >= visible.x &&
    rect.y - 80 >= visible.y &&
    rect.x + rect.width + 80 <= visible.x + visible.width &&
    rect.y + rect.height + 80 <= visible.y + visible.height
  )
    return revealed;
  const camera = getCameraNavigationFrame({
    state,
    rect,
    behavior: { maxZoom: 1, paddingPx: 96, type: "fit" },
  });
  return camera === null ? revealed : { ...revealed, camera };
}
