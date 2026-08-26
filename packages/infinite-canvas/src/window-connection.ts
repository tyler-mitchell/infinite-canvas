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

/**
 * Dragging from one window to another to declare a relationship between them.
 *
 * The canvas owns this rather than a consumer, for the same reason it owns marquee and pan: it is a
 * pointer gesture over windows, and every part that is hard to get right — where the affordance
 * sits, when it appears, when it must *not* disappear, what the far end is at this instant — is a
 * question about windows and a camera, not about whatever the consumer intends to record. A
 * consumer supplies only two things: whether a given pair may be joined, and what to write when it
 * is. Nothing here knows what a connection means.
 *
 * Screen pixels throughout for the affordance itself, which is the framework's convention for
 * anything a pointer must hit: an offset expressed in world units shrinks as you zoom out, so the
 * handle would become unclickable exactly when you have zoomed out to see the whole graph and most
 * want to use it. The connector *path* stays in world space, because that is scenery.
 */

/** Screen pixels from a window's edge to a handle's centre. */
const DEFAULT_CONNECTION_HANDLE_OFFSET_PX = 14;

/** Screen pixels from a handle's centre to its rim. */
const DEFAULT_CONNECTION_HANDLE_RADIUS_PX = 7;

type InfiniteCanvasConnectionEdge = "east" | "north" | "south" | "west";

type InfiniteCanvasConnectionHandle = Readonly<{
  edge: InfiniteCanvasConnectionEdge;
  /** Centre, in viewport coordinates. */
  point: InfiniteCanvasPoint;
  radiusPx: number;
  windowId: string;
}>;

type InfiniteCanvasConnectionHandleOptions = Readonly<{
  offsetPx?: number;
  radiusPx?: number;
}>;

/**
 * A window's screen rect as a rect the geometry helpers accept.
 *
 * `worldRectToScreenRect` reports `left`/`top` because it describes something being positioned in
 * CSS, while `rectContainsPoint` reads `x`/`y`. Handing one to the other silently compares against
 * `undefined` and answers "not inside" for every point on screen — which is not a type error, and
 * is exactly the shape of bug this module exists to stop shipping.
 */
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

/**
 * A window's connection handles, one per edge, in viewport coordinates.
 *
 * Four rather than one, because a connection has a direction you already have in mind before you
 * start dragging, and making every gesture begin on the same arbitrary side turns "join these two"
 * into "go to the right edge first, then join these two".
 */
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

/**
 * The region in which a window keeps its handles shown: its screen rect plus the ring they sit in.
 *
 * This is the whole reason this function exists. A handle drawn *outside* a window, with visibility
 * driven by "is the pointer over the window", vanishes the instant you move toward it — the pointer
 * leaves the rect on its way to the thing the rect revealed, and the affordance unmounts under the
 * cursor. It is not a rare race; it is every single attempt, and it makes the gesture feel broken
 * in a way no amount of styling recovers.
 *
 * A halo rather than the exact union of the rect and the four handle boxes: the union leaves gaps
 * on the diagonals, so a pointer travelling from a corner toward an edge handle passes through dead
 * space and the affordance flickers. The halo has no gaps, and being slightly forgiving at the
 * boundary is the correct bias for a reveal-on-approach affordance anyway.
 */
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

/**
 * Which window should be showing its handles, given where the pointer is and which window was
 * showing them a moment ago.
 *
 * Sticky, and asymmetric on purpose. Keeping the previous window requires only that the pointer is
 * still within its halo — that is what lets you reach a handle. Taking the affordance *from* it
 * requires the pointer to be properly inside another window's rect, not merely near it, so passing
 * close to a neighbour on the way to a handle does not hand the affordance away mid-reach.
 *
 * Minimized windows are excluded: they have no rect on the canvas to drag from.
 */
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

/**
 * The connector a drag is currently proposing, in world space.
 *
 * The far end is a rect when the pointer is over a window and the bare pointer otherwise, and both
 * go through the same routing — a zero-extent rect *is* a point to this geometry, since its centre
 * is the point and the edge anchor computed for a zero half-size scales back onto that centre. So
 * the preview is not a separate drawing that resembles the result; it is the result, drawn early.
 */
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
