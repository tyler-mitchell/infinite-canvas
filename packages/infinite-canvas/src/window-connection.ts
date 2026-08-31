import { rectContainsPoint, worldRectToScreenRect } from "./geometry";
import {
  getInfiniteCanvasRectConnectorPath,
  type InfiniteCanvasWindowConnectorPathOptions,
} from "./scene-layer-geometry";
import { sortWindowsByStack } from "./stacking";
import type {
  InfiniteCanvasCamera,
  InfiniteCanvasPoint,
  InfiniteCanvasRect,
  InfiniteCanvasState,
  InfiniteCanvasViewport,
  InfiniteCanvasWindow,
} from "./types";

/** Defines screen-space connection handles and world-space preview paths. */
/** Screen pixels from a window edge to a handle center. */
const DEFAULT_CONNECTION_HANDLE_OFFSET_PX = 14;

/** Screen pixels from a handle center to its rim. */
const DEFAULT_CONNECTION_HANDLE_RADIUS_PX = 7;

type InfiniteCanvasConnectionEdge = "east" | "north" | "south" | "west";

type InfiniteCanvasConnectionHandle = Readonly<{
  edge: InfiniteCanvasConnectionEdge;
  /** Center in viewport coordinates. */
  point: InfiniteCanvasPoint;
  radiusPx: number;
  windowId: string;
}>;

type InfiniteCanvasConnectionHandleOptions = Readonly<{
  offsetPx?: number;
  radiusPx?: number;
}>;

/** Converts the CSS projection shape to an `InfiniteCanvasRect`. */
function getWindowScreenRect<Kind extends string>(
  window: InfiniteCanvasWindow<Kind>,
  camera: InfiniteCanvasCamera,
  viewport: InfiniteCanvasViewport,
): InfiniteCanvasRect {
  const rect = worldRectToScreenRect(camera, viewport, window.rect);

  return { height: rect.height, width: rect.width, x: rect.left, y: rect.top };
}

function getHandleReach(options: InfiniteCanvasConnectionHandleOptions) {
  return (
    (options.offsetPx ?? DEFAULT_CONNECTION_HANDLE_OFFSET_PX) +
    (options.radiusPx ?? DEFAULT_CONNECTION_HANDLE_RADIUS_PX)
  );
}

/** Returns one screen-space handle for each window edge. */
function getInfiniteCanvasConnectionHandles<Kind extends string>(
  window: InfiniteCanvasWindow<Kind>,
  camera: InfiniteCanvasCamera,
  viewport: InfiniteCanvasViewport,
  options: InfiniteCanvasConnectionHandleOptions = {},
): readonly InfiniteCanvasConnectionHandle[] {
  const rect = getWindowScreenRect(window, camera, viewport);
  const offsetPx = options.offsetPx ?? DEFAULT_CONNECTION_HANDLE_OFFSET_PX;
  const radiusPx = options.radiusPx ?? DEFAULT_CONNECTION_HANDLE_RADIUS_PX;
  const midX = rect.x + rect.width / 2;
  const midY = rect.y + rect.height / 2;
  const points: Readonly<Record<InfiniteCanvasConnectionEdge, InfiniteCanvasPoint>> = {
    east: { x: rect.x + rect.width + offsetPx, y: midY },
    north: { x: midX, y: rect.y - offsetPx },
    south: { x: midX, y: rect.y + rect.height + offsetPx },
    west: { x: rect.x - offsetPx, y: midY },
  };

  return (["north", "east", "south", "west"] as const).map((edge) => ({
    edge,
    point: points[edge],
    radiusPx,
    windowId: window.id,
  }));
}

/** Returns the screen-space halo that keeps handles visible during pointer travel. */
function getInfiniteCanvasConnectionAffordanceRect<Kind extends string>(
  window: InfiniteCanvasWindow<Kind>,
  camera: InfiniteCanvasCamera,
  viewport: InfiniteCanvasViewport,
  options: InfiniteCanvasConnectionHandleOptions = {},
): InfiniteCanvasRect {
  const rect = getWindowScreenRect(window, camera, viewport);
  const reach = getHandleReach(options);

  return {
    height: rect.height + reach * 2,
    width: rect.width + reach * 2,
    x: rect.x - reach,
    y: rect.y - reach,
  };
}

/** Keeps the prior halo until the pointer enters another window. */
function getInfiniteCanvasConnectionAffordanceWindowId<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  viewportPoint: InfiniteCanvasPoint,
  previousWindowId: string | null = null,
  options: InfiniteCanvasConnectionHandleOptions = {},
): string | null {
  const candidates = sortWindowsByStack(state.windows).filter(
    (window) => window.mode !== "minimized",
  );
  const previous = candidates.find((window) => window.id === previousWindowId);

  if (
    previous !== undefined &&
    rectContainsPoint(
      getInfiniteCanvasConnectionAffordanceRect(previous, state.camera, state.viewport, options),
      viewportPoint,
    )
  ) {
    return previous.id;
  }

  return (
    candidates
      .filter((window) =>
        rectContainsPoint(getWindowScreenRect(window, state.camera, state.viewport), viewportPoint),
      )
      .at(-1)?.id ?? null
  );
}

/** Returns the proposed world-space connector path. */
function getInfiniteCanvasConnectionPreviewPath(
  sourceRect: InfiniteCanvasRect,
  target: InfiniteCanvasPoint | InfiniteCanvasRect,
  options: InfiniteCanvasWindowConnectorPathOptions = {},
) {
  return getInfiniteCanvasRectConnectorPath(
    sourceRect,
    "width" in target ? target : { height: 0, width: 0, x: target.x, y: target.y },
    options,
  );
}

export {
  DEFAULT_CONNECTION_HANDLE_OFFSET_PX,
  DEFAULT_CONNECTION_HANDLE_RADIUS_PX,
  getInfiniteCanvasConnectionAffordanceRect,
  getInfiniteCanvasConnectionAffordanceWindowId,
  getInfiniteCanvasConnectionHandles,
  getInfiniteCanvasConnectionPreviewPath,
};

export type {
  InfiniteCanvasConnectionEdge,
  InfiniteCanvasConnectionHandle,
  InfiniteCanvasConnectionHandleOptions,
};
