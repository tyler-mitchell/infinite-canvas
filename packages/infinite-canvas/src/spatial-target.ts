import { DEFAULT_INFINITE_CANVAS_CHROME } from "./constants";
import { rectContainsPoint, screenPointToWorldPoint } from "./geometry";
import { sortWindowsByStack } from "./stacking";
import type {
  InfiniteCanvasChromeMetrics,
  InfiniteCanvasPoint,
  InfiniteCanvasRect,
  InfiniteCanvasResolvedSpatialTarget,
  InfiniteCanvasResizeHandle,
  InfiniteCanvasSpatialTarget,
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

type InfiniteCanvasSpatialTargetSource<Target, Kind extends string = string> =
  | readonly Target[]
  | ((context: InfiniteCanvasSpatialTargetResolverContext<Kind>) => readonly Target[]);

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
   * Pick distance from the segment in WORLD units (not screen pixels), so
   * the effective screen-space hit area scales with zoom.
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
  context: InfiniteCanvasSpatialTargetResolverContext<Kind>,
) {
  return typeof targets === "function" ? targets(context) : targets;
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
) {
  return targets.reduce<Readonly<{
    distance: number;
    target: InfiniteCanvasSpatialEdgeTarget;
  }> | null>((nearest, target) => {
    const hitRadius = target.hitRadius ?? DEFAULT_INFINITE_CANVAS_EDGE_TARGET_HIT_RADIUS;
    const distance = getPointToSegmentDistance(point, target.start, target.end);

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
    id,
    phase,
    resolve: (context) => {
      const nearest = getNearestSpatialEdgeTarget(
        getSpatialTargetList(targets, context),
        context.worldPoint,
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
  resolveInfiniteCanvasSpatialTarget,
};

export type {
  InfiniteCanvasSpatialEdgeTarget,
  InfiniteCanvasSpatialRectTarget,
  InfiniteCanvasSpatialTargetInput,
  InfiniteCanvasSpatialTargetResolverInput,
  InfiniteCanvasSpatialTargetSource,
};
