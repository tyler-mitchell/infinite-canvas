import { DEFAULT_INFINITE_CANVAS_CHROME } from "./constants";
import {
  getWindowBodyRect,
  getWindowHeaderRect,
  rectContainsPoint,
  screenPointToWorldPoint,
  unionRects,
} from "./geometry";
import { getWindowLayoutMembership } from "./group-state";
import { isInfiniteCanvasWindowCapable } from "./window-capabilities";
import { getCanvasLayout } from "./layout";
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

/** Supplies target geometry without a pointer position. */
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
  /** Pick radius in screen pixels. */
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

function getWindowLocalPoint(
  rect: InfiniteCanvasRect,
  worldPoint: InfiniteCanvasPoint,
): InfiniteCanvasWindowLocalPoint {
  return {
    x: worldPoint.x - rect.x,
    y: worldPoint.y - rect.y,
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

function getWindowResizeHandleAtPoint(
  state: InfiniteCanvasState,
  rect: InfiniteCanvasRect,
  localPoint: InfiniteCanvasWindowLocalPoint,
  chrome: InfiniteCanvasChromeMetrics,
): InfiniteCanvasResizeHandle | null {
  if (chrome.resizeHandleSize <= 0) return null;
  const hitSize = Math.max(chrome.resizeHandleSize / state.camera.zoom, 1);
  const xAxis = getResizeHandleAxis(localPoint.x, 0, rect.width, hitSize);
  const yAxis = getResizeHandleAxis(localPoint.y, 0, rect.height, hitSize);

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

/** Finds a target by type, ID, and kind. */
function findSpatialTargetById<Target extends Readonly<{ id: string; kind: string }>>(
  targets: readonly Target[],
  target: InfiniteCanvasSelectionTarget,
  type: InfiniteCanvasSelectionTarget["type"],
) {
  return target.type !== type
    ? undefined
    : targets.find(
        (candidate) =>
          candidate.id === target.id && "kind" in target && candidate.kind === target.kind,
      );
}

/** Returns the segment bounding box. */
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
    // Overlay targets use viewport pixels and have no world rect.
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
    // Compare world distance in screen pixels.
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

function getWindowAreaAtPoint({
  state,
  window,
  rect,
  localPoint,
  chrome,
}: Readonly<{
  state: InfiniteCanvasState;
  window: InfiniteCanvasWindow;
  rect: InfiniteCanvasRect;
  localPoint: InfiniteCanvasWindowLocalPoint;
  chrome: InfiniteCanvasChromeMetrics;
}>): Readonly<{
  area: InfiniteCanvasSpatialWindowArea;
  resizeHandle?: InfiniteCanvasResizeHandle;
}> {
  const membership = getWindowLayoutMembership(state, window.id);
  const resizable =
    isInfiniteCanvasWindowCapable(window, "resizable") &&
    (membership === null || membership.operations?.resize !== undefined);
  const resizeHandle = resizable
    ? getWindowResizeHandleAtPoint(state, rect, localPoint, chrome)
    : null;

  if (resizeHandle !== null) {
    return {
      area: "resize-handle",
      resizeHandle,
    };
  }

  if (chrome.headerHeight > 0 && rectContainsPoint(getWindowHeaderRect(rect, chrome), localPoint)) {
    return {
      area: "header",
    };
  }

  if (rectContainsPoint(getWindowBodyRect(rect, chrome), localPoint)) {
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
  const canvasLayout = getCanvasLayout(state);
  return (
    sortWindowsByStack(
      state.windows.filter((window) => canvasLayout.visibleWindowIds.has(window.id)),
    )
      .flatMap((window) => {
        const rect = canvasLayout.windowRects.get(window.id);
        if (rect === undefined || !rectContainsPoint(rect, worldPoint)) return [];
        return [{ rect, window }];
      })
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

  const target = getTopmostWindowAtWorldPoint(state, worldPoint);

  if (target !== null) {
    const localPoint = getWindowLocalPoint(target.rect, worldPoint);
    const area = getWindowAreaAtPoint({ state, ...target, localPoint, chrome });

    return {
      ...area,
      rect: target.rect,
      type: "window",
      viewportPoint,
      window: target.window,
      windowId: target.window.id,
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

/** Returns world bounds for the selection. */
function getInfiniteCanvasSelectionBounds<Kind extends string>({
  chrome = DEFAULT_INFINITE_CANVAS_CHROME,
  resolvers = [],
  state,
}: InfiniteCanvasSelectionBoundsInput<Kind>): InfiniteCanvasRect | null {
  const context = { chrome, state } satisfies InfiniteCanvasSpatialTargetGeometryContext<Kind>;
  const { groupRects, windowRects } = getCanvasLayout(state);

  return unionRects(
    state.selection.targets.flatMap((target) => {
      if (target.type === "group" || target.type === "window") {
        const rect = (target.type === "group" ? groupRects : windowRects).get(target.id) ?? null;
        return rect === null ? [] : [rect];
      }
      const rect = resolvers.reduce<InfiniteCanvasRect | null>(
        (found, resolver) => found ?? resolver.getTargetRect?.(target, context) ?? null,
        null,
      );

      return rect === null ? [] : [rect];
    }),
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
