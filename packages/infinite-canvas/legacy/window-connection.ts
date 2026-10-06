import { rectContainsPoint, worldRectToScreenRect } from "./geometry";
import { getCanvasLayout } from "./layout";
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
function getWindowScreenRect(
  rect: InfiniteCanvasRect,
  camera: InfiniteCanvasCamera,
  viewport: InfiniteCanvasViewport,
): InfiniteCanvasRect {
  const screenRect = worldRectToScreenRect(camera, viewport, rect);

  return {
    height: screenRect.height,
    width: screenRect.width,
    x: screenRect.left,
    y: screenRect.top,
  };
}

function getHandleReach(options: InfiniteCanvasConnectionHandleOptions) {
  return (
    (options.offsetPx ?? DEFAULT_CONNECTION_HANDLE_OFFSET_PX) +
    (options.radiusPx ?? DEFAULT_CONNECTION_HANDLE_RADIUS_PX)
  );
}

/** Returns one screen-space handle for each window edge. */
function getInfiniteCanvasConnectionHandles(
  { rect: windowRect, windowId }: Readonly<{ rect: InfiniteCanvasRect; windowId: string }>,
  camera: InfiniteCanvasCamera,
  viewport: InfiniteCanvasViewport,
  options: InfiniteCanvasConnectionHandleOptions = {},
): readonly InfiniteCanvasConnectionHandle[] {
  const rect = getWindowScreenRect(windowRect, camera, viewport);
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
    windowId,
  }));
}

/** Returns the screen-space halo that keeps handles visible during pointer travel. */
function getInfiniteCanvasConnectionAffordanceRect(
  window: Readonly<{ rect: InfiniteCanvasRect }>,
  camera: InfiniteCanvasCamera,
  viewport: InfiniteCanvasViewport,
  options: InfiniteCanvasConnectionHandleOptions = {},
): InfiniteCanvasRect {
  const rect = getWindowScreenRect(window.rect, camera, viewport);
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
  const canvasLayout = getCanvasLayout(state);
  const candidates = sortWindowsByStack(
    state.windows.filter((window) => canvasLayout.visibleWindowIds.has(window.id)),
  );
  const previous = candidates.find((window) => window.id === previousWindowId);

  if (previous !== undefined) {
    const rect = canvasLayout.windowRects.get(previous.id);
    if (
      rect !== undefined &&
      rectContainsPoint(
        getInfiniteCanvasConnectionAffordanceRect({ rect }, state.camera, state.viewport, options),
        viewportPoint,
      )
    ) {
      return previous.id;
    }
  }

  return (
    candidates
      .filter((window) => {
        const rect = canvasLayout.windowRects.get(window.id);
        return (
          rect !== undefined &&
          rectContainsPoint(getWindowScreenRect(rect, state.camera, state.viewport), viewportPoint)
        );
      })
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
