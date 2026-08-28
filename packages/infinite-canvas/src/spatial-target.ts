import { DEFAULT_INFINITE_CANVAS_CHROME } from "./constants";
import { rectContainsPoint, screenPointToWorldPoint, unionRects } from "./geometry";
import { getSelectedWindowBounds, getSelectionTargets } from "./selection";
import { sortWindowsByStack } from "./stacking";
import type {
  InfiniteCanvasChromeMetrics,
  InfiniteCanvasPoint,
  InfiniteCanvasRect,
  InfiniteCanvasResolvedSpatialTarget,
  InfiniteCanvasResizeHandle,
  InfiniteCanvasSpatialTarget,
  InfiniteCanvasSpatialTargetGeometryContext,
  InfiniteCanvasSpatialTargetResolver,
  InfiniteCanvasSpatialTargetResolverContext,
  InfiniteCanvasSpatialWindowArea,
  InfiniteCanvasSelectionTarget,
  InfiniteCanvasState,
  InfiniteCanvasWindow,
} from "./types";

type InfiniteCanvasSpatialTargetInput<Kind extends string = string> = Readonly<{
  chrome?: InfiniteCanvasChromeMetrics;
  resolvers?: readonly InfiniteCanvasSpatialTargetResolver<Kind>[];
  state: InfiniteCanvasState<Kind>;
  viewportPoint: InfiniteCanvasPoint;
}>;

/**
 * Takes the pointer-free context, so the same source answers a hit test and a geometry question.
 *
 * A resolver context satisfies this, so nothing changes at the hit-testing call sites. What it
 * rules out is a source that reads `worldPoint` to decide *which* targets exist — that source could
 * not be asked where a target is without inventing a pointer position, and a target list that
 * depends on the cursor is not a list of things that are there.
 */
type InfiniteCanvasSpatialTargetSource<Target, Kind extends string = string> =
  | readonly Target[]
  | ((context: InfiniteCanvasSpatialTargetGeometryContext<Kind>) => readonly Target[]);

type InfiniteCanvasSpatialRectTarget = Readonly<{
  data?: unknown;
  id: string;
  kind: string;
  rect: InfiniteCanvasRect;
}>;

type InfiniteCanvasSpatialEdgeTarget = Readonly<{
  data?: unknown;
  end: InfiniteCanvasPoint;
  /**
   * Pick distance from the segment in **screen pixels**, so an edge is equally easy to hit at
   * every zoom.
   *
   * This was world units until 2026-08-12, and it was the framework's only threshold that was:
   * snap's `threshold` and `releaseThreshold`, the detail-level band, the offscreen inset and
   * margin, the tab-drag threshold, and the keyboard nudge step are all screen pixels mapped
   * through the camera. World units make the hit area *shrink as you zoom out* — at 25% a
   * 10-unit radius is 2.5 screen pixels, so edges become unclickable exactly when you have
   * zoomed out to see the whole graph and most want to click one, and balloon to a sloppy 40px
   * at 400%.
   *
   * That is risk R2 ("thresholds vary with zoom"), which the register records as *mitigated*
   * for snapping and which was live here, and the same defect as the low-zoom chrome stroke
   * that rendered at a tenth of a pixel. The default is unchanged at 10, so behaviour at zoom 1
   * is identical and only the zoom curve differs.
   */
  hitRadius?: number;
  id: string;
  kind: string;
  start: InfiniteCanvasPoint;
}>;

type InfiniteCanvasSpatialTargetResolverInput<Target, Kind extends string = string> = Readonly<{
  id: string;
  phase?: InfiniteCanvasSpatialTargetResolver<Kind>["phase"];
  targets: InfiniteCanvasSpatialTargetSource<Target, Kind>;
}>;

type InfiniteCanvasWindowLocalPoint = Readonly<{
  x: number;
  y: number;
}>;

const DEFAULT_INFINITE_CANVAS_EDGE_TARGET_HIT_RADIUS = 10;

function getWindowLocalPoint<Kind extends string>(
  window: InfiniteCanvasWindow<Kind>,
  worldPoint: InfiniteCanvasPoint,
): InfiniteCanvasWindowLocalPoint {
  return {
    x: worldPoint.x - window.rect.x,
    y: worldPoint.y - window.rect.y,
  };
}

function getResizeHandleAxis(
  value: number,
  min: number,
  max: number,
  hitSize: number,
): "max" | "min" | null {
  if (value <= min + hitSize) {
    return "min";
  }

  if (value >= max - hitSize) {
    return "max";
  }

  return null;
}

function getWindowResizeHandleAtPoint<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  window: InfiniteCanvasWindow<Kind>,
  localPoint: InfiniteCanvasWindowLocalPoint,
  chrome: InfiniteCanvasChromeMetrics,
): InfiniteCanvasResizeHandle | null {
  const hitSize = Math.max(chrome.resizeHandleSize / state.camera.zoom, 1);
  const xAxis = getResizeHandleAxis(localPoint.x, 0, window.rect.width, hitSize);
  const yAxis = getResizeHandleAxis(localPoint.y, 0, window.rect.height, hitSize);

  if (xAxis === null && yAxis === null) {
    return null;
  }

  if (xAxis === "min" && yAxis === "min") {
    return "north-west";
  }

  if (xAxis === "max" && yAxis === "min") {
    return "north-east";
  }

  if (xAxis === "min" && yAxis === "max") {
    return "south-west";
  }

  if (xAxis === "max" && yAxis === "max") {
    return "south-east";
  }

  if (xAxis === "min") {
    return "west";
  }

  if (xAxis === "max") {
    return "east";
  }

  return yAxis === "min" ? "north" : "south";
}

function getSpatialTargetList<Target, Kind extends string>(
  targets: InfiniteCanvasSpatialTargetSource<Target, Kind>,
  context: InfiniteCanvasSpatialTargetGeometryContext<Kind>,
) {
  return typeof targets === "function" ? targets(context) : targets;
}

/**
 * Finds the target a selection names, by the same identity the selection compares on.
 *
 * `kind` is part of it because two resolvers may both own ids from their own namespace, and `type`
 * because a resolver answers for one type only — an edge resolver asked about a scene object is
 * being asked about somebody else's target.
 */
function findSpatialTargetById<Target extends Readonly<{ id: string; kind: string }>>(
  targets: readonly Target[],
  target: InfiniteCanvasSelectionTarget,
  type: InfiniteCanvasSelectionTarget["type"],
) {
  return target.type !== type
    ? undefined
    : targets.find((candidate) => candidate.id === target.id && candidate.kind === target.kind);
}

/** A segment's bounding box. Flat for an axis-aligned edge, which `fitCameraToWorldRect` clamps. */
function getSpatialEdgeTargetRect(target: InfiniteCanvasSpatialEdgeTarget): InfiniteCanvasRect {
  return {
    height: Math.abs(target.end.y - target.start.y),
    width: Math.abs(target.end.x - target.start.x),
    x: Math.min(target.start.x, target.end.x),
    y: Math.min(target.start.y, target.end.y),
  };
}

function createSpatialRectTargetResolver<Kind extends string>({
  defaultPhase,
  id,
  targets,
  type,
  usePoint,
}: Readonly<{
  defaultPhase: InfiniteCanvasSpatialTargetResolver<Kind>["phase"];
  id: string;
  targets: InfiniteCanvasSpatialTargetSource<InfiniteCanvasSpatialRectTarget, Kind>;
  type: "overlay" | "scene-object";
  usePoint: (context: InfiniteCanvasSpatialTargetResolverContext<Kind>) => InfiniteCanvasPoint;
}>): InfiniteCanvasSpatialTargetResolver<Kind> {
  return {
    /*
     * An overlay measures in viewport pixels, so it cannot answer a world-space question and does
     * not offer to. Its targets are unselectable anyway — `getInfiniteCanvasSelectableTargetFromSpatialTarget`
     * returns null for them — so nothing can ask.
     */
    ...(type === "overlay"
      ? {}
      : {
          getTargetRect: (
            target: InfiniteCanvasSelectionTarget,
            context: InfiniteCanvasSpatialTargetGeometryContext<Kind>,
          ) =>
            findSpatialTargetById(getSpatialTargetList(targets, context), target, type)?.rect ??
            null,
        }),
    id,
    phase: defaultPhase,
    resolve: (context) => {
      const point = usePoint(context);
      const target =
        getSpatialTargetList(targets, context).find((candidate) =>
          rectContainsPoint(candidate.rect, point),
        ) ?? null;

      return target === null
        ? null
        : {
            data: target.data,
            id: target.id,
            kind: target.kind,
            type,
            viewportPoint: context.viewportPoint,
            worldPoint: context.worldPoint,
          };
    },
  };
}

function getPointToSegmentDistance(
  point: InfiniteCanvasPoint,
  start: InfiniteCanvasPoint,
  end: InfiniteCanvasPoint,
) {
  const delta = {
    x: end.x - start.x,
    y: end.y - start.y,
  };
  const lengthSquared = delta.x * delta.x + delta.y * delta.y;

  if (lengthSquared <= Number.EPSILON) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }

  const progress = Math.max(
    0,
    Math.min(1, ((point.x - start.x) * delta.x + (point.y - start.y) * delta.y) / lengthSquared),
  );
  const projectedPoint = {
    x: start.x + delta.x * progress,
    y: start.y + delta.y * progress,
  };

  return Math.hypot(point.x - projectedPoint.x, point.y - projectedPoint.y);
}

function getNearestSpatialEdgeTarget(
  targets: readonly InfiniteCanvasSpatialEdgeTarget[],
  point: InfiniteCanvasPoint,
  zoom: number,
) {
  return targets.reduce<Readonly<{
    distance: number;
    target: InfiniteCanvasSpatialEdgeTarget;
  }> | null>((nearest, target) => {
    const hitRadius = target.hitRadius ?? DEFAULT_INFINITE_CANVAS_EDGE_TARGET_HIT_RADIUS;
    // World distance, compared in screen pixels — the same conversion `snap-resolver` applies to
    // its own thresholds, so the two subsystems answer "close enough to catch" the same way.
    const distance = getPointToSegmentDistance(point, target.start, target.end) * zoom;

    return distance > hitRadius
      ? nearest
      : nearest === null || distance < nearest.distance
        ? {
            distance,
            target,
          }
        : nearest;
  }, null);
}

function createInfiniteCanvasSceneObjectTargetResolver<Kind extends string = string>({
  id,
  phase = "after-windows",
  targets,
}: InfiniteCanvasSpatialTargetResolverInput<
  InfiniteCanvasSpatialRectTarget,
  Kind
>): InfiniteCanvasSpatialTargetResolver<Kind> {
  return createSpatialRectTargetResolver({
    defaultPhase: phase,
    id,
    targets,
    type: "scene-object",
    usePoint: (context) => context.worldPoint,
  });
}

function createInfiniteCanvasOverlayTargetResolver<Kind extends string = string>({
  id,
  phase = "before-windows",
  targets,
}: InfiniteCanvasSpatialTargetResolverInput<
  InfiniteCanvasSpatialRectTarget,
  Kind
>): InfiniteCanvasSpatialTargetResolver<Kind> {
  return createSpatialRectTargetResolver({
    defaultPhase: phase,
    id,
    targets,
    type: "overlay",
    usePoint: (context) => context.viewportPoint,
  });
}

function createInfiniteCanvasEdgeTargetResolver<Kind extends string = string>({
  id,
  phase = "after-windows",
  targets,
}: InfiniteCanvasSpatialTargetResolverInput<
  InfiniteCanvasSpatialEdgeTarget,
  Kind
>): InfiniteCanvasSpatialTargetResolver<Kind> {
  return {
    getTargetRect: (target, context) => {
      const found = findSpatialTargetById(getSpatialTargetList(targets, context), target, "edge");

      return found === undefined ? null : getSpatialEdgeTargetRect(found);
    },
    id,
    phase,
    resolve: (context) => {
      const nearest = getNearestSpatialEdgeTarget(
        getSpatialTargetList(targets, context),
        context.worldPoint,
        context.state.camera.zoom,
      );

      return nearest === null
        ? null
        : {
            data: nearest.target.data,
            id: nearest.target.id,
            kind: nearest.target.kind,
            type: "edge",
            viewportPoint: context.viewportPoint,
            worldPoint: context.worldPoint,
          };
    },
  };
}

function getWindowAreaAtPoint<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  window: InfiniteCanvasWindow<Kind>,
  localPoint: InfiniteCanvasWindowLocalPoint,
  chrome: InfiniteCanvasChromeMetrics,
): Readonly<{
  area: InfiniteCanvasSpatialWindowArea;
  resizeHandle?: InfiniteCanvasResizeHandle;
}> {
  const resizeHandle = getWindowResizeHandleAtPoint(state, window, localPoint, chrome);

  if (resizeHandle !== null) {
    return {
      area: "resize-handle",
      resizeHandle,
    };
  }

  if (localPoint.y <= chrome.headerHeight) {
    return {
      area: "header",
    };
  }

  if (
    localPoint.x >= chrome.borderWidth &&
    localPoint.x <= window.rect.width - chrome.borderWidth &&
    localPoint.y >= chrome.headerHeight &&
    localPoint.y <= window.rect.height - chrome.borderWidth
  ) {
    return {
      area: "body",
    };
  }

  return {
    area: "frame",
  };
}

function getTopmostWindowAtWorldPoint<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  worldPoint: InfiniteCanvasPoint,
) {
  return (
    sortWindowsByStack(state.windows)
      .filter((window) => window.mode !== "minimized" && rectContainsPoint(window.rect, worldPoint))
      .at(-1) ?? null
  );
}

function resolveCustomSpatialTarget<Kind extends string>(
  resolvers: readonly InfiniteCanvasSpatialTargetResolver<Kind>[],
  phase: InfiniteCanvasSpatialTargetResolver<Kind>["phase"],
  context: InfiniteCanvasSpatialTargetResolverContext<Kind>,
): InfiniteCanvasResolvedSpatialTarget<Kind> | null {
  return resolvers
    .filter((resolver) => (resolver.phase ?? "after-windows") === phase)
    .reduce<InfiniteCanvasResolvedSpatialTarget<Kind> | null>(
      (target, resolver) => target ?? resolver.resolve(context),
      null,
    );
}

function resolveInfiniteCanvasSpatialTarget<Kind extends string>({
  chrome = DEFAULT_INFINITE_CANVAS_CHROME,
  resolvers = [],
  state,
  viewportPoint,
}: InfiniteCanvasSpatialTargetInput<Kind>): InfiniteCanvasSpatialTarget<Kind> {
  const worldPoint = screenPointToWorldPoint(state.camera, state.viewport, viewportPoint);
  const context = {
    chrome,
    state,
    viewportPoint,
    worldPoint,
  } satisfies InfiniteCanvasSpatialTargetResolverContext<Kind>;
  const beforeWindowTarget = resolveCustomSpatialTarget(resolvers, "before-windows", context);

  if (beforeWindowTarget !== null) {
    return beforeWindowTarget;
  }

  const window = getTopmostWindowAtWorldPoint(state, worldPoint);

  if (window !== null) {
    const localPoint = getWindowLocalPoint(window, worldPoint);
    const area = getWindowAreaAtPoint(state, window, localPoint, chrome);

    return {
      ...area,
      type: "window",
      viewportPoint,
      window,
      windowId: window.id,
      worldPoint,
    };
  }

  const afterWindowTarget = resolveCustomSpatialTarget(resolvers, "after-windows", context);

  if (afterWindowTarget !== null) {
    return afterWindowTarget;
  }

  return {
    type: "empty-world",
    viewportPoint,
    worldPoint,
  };
}

type InfiniteCanvasSelectionBoundsInput<Kind extends string = string> = Readonly<{
  chrome?: InfiniteCanvasChromeMetrics;
  resolvers?: readonly InfiniteCanvasSpatialTargetResolver<Kind>[];
  state: InfiniteCanvasState<Kind>;
}>;

/**
 * Where the selected non-window targets are, asked of the resolvers that own them.
 *
 * A target nothing answers for contributes nothing, rather than counting as the origin. That covers
 * both a resolver the consumer has unmounted and a target whose object is gone — the second being
 * why this is a lookup and not a rect stored on the selection, which would be stale the moment the
 * object moved.
 */
function getInfiniteCanvasSelectionTargetBounds<Kind extends string>({
  chrome = DEFAULT_INFINITE_CANVAS_CHROME,
  resolvers = [],
  state,
}: InfiniteCanvasSelectionBoundsInput<Kind>): InfiniteCanvasRect | null {
  const context = { chrome, state } satisfies InfiniteCanvasSpatialTargetGeometryContext<Kind>;

  return unionRects(
    getSelectionTargets(state.selection).flatMap((target) => {
      const rect = resolvers.reduce<InfiniteCanvasRect | null>(
        (found, resolver) => found ?? resolver.getTargetRect?.(target, context) ?? null,
        null,
      );

      return rect === null ? [] : [rect];
    }),
  );
}

/**
 * Everything the selection covers: the windows, and the targets the resolvers can place.
 *
 * This is what "fit the selection" means once a selection can hold things that are not windows.
 * With no resolvers it is exactly `getSelectedWindowBounds`, so a consumer that registers none is
 * unaffected.
 */
function getInfiniteCanvasSelectionBounds<Kind extends string>(
  input: InfiniteCanvasSelectionBoundsInput<Kind>,
): InfiniteCanvasRect | null {
  return unionRects(
    [getSelectedWindowBounds(input.state), getInfiniteCanvasSelectionTargetBounds(input)].flatMap(
      (rect) => (rect === null ? [] : [rect]),
    ),
  );
}

function getInfiniteCanvasSelectableTargetFromSpatialTarget<Kind extends string>(
  target: InfiniteCanvasSpatialTarget<Kind>,
): InfiniteCanvasSelectionTarget | null {
  switch (target.type) {
    case "edge":
    case "scene-object":
      return {
        data: target.data,
        id: target.id,
        kind: target.kind,
        type: target.type,
      };
    case "empty-world":
    case "overlay":
    case "window":
      return null;
  }
}

export {
  createInfiniteCanvasEdgeTargetResolver,
  createInfiniteCanvasOverlayTargetResolver,
  createInfiniteCanvasSceneObjectTargetResolver,
  getInfiniteCanvasSelectableTargetFromSpatialTarget,
  getInfiniteCanvasSelectionBounds,
  getInfiniteCanvasSelectionTargetBounds,
  resolveInfiniteCanvasSpatialTarget,
};

export type {
  InfiniteCanvasSelectionBoundsInput,
  InfiniteCanvasSpatialEdgeTarget,
  InfiniteCanvasSpatialRectTarget,
  InfiniteCanvasSpatialTargetInput,
  InfiniteCanvasSpatialTargetResolverInput,
  InfiniteCanvasSpatialTargetSource,
};
