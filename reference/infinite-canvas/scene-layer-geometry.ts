import { rectsIntersect } from "#/experiments/infinite-canvas/geometry";
import type {
  InfiniteCanvasPoint,
  InfiniteCanvasRect,
  InfiniteCanvasSceneLayerSpace,
  InfiniteCanvasSceneVector3,
  InfiniteCanvasViewport,
  InfiniteCanvasWindowProxy,
} from "#/experiments/infinite-canvas/types";

type InfiniteCanvasWindowConnectorOptions = Readonly<{
  padding?: number;
}>;

type InfiniteCanvasWindowConnectorRoute = "orthogonal" | "straight";

type InfiniteCanvasWindowConnectorPathOptions = InfiniteCanvasWindowConnectorOptions &
  Readonly<{
    route?: InfiniteCanvasWindowConnectorRoute;
  }>;

type InfiniteCanvasWorldSegment = Readonly<{
  angle: number;
  delta: InfiniteCanvasPoint;
  end: InfiniteCanvasPoint;
  length: number;
  midpoint: InfiniteCanvasPoint;
  start: InfiniteCanvasPoint;
}>;

type InfiniteCanvasSceneSegmentTransform = Readonly<{
  length: number;
  position: InfiniteCanvasSceneVector3;
  rotation: InfiniteCanvasSceneVector3;
}>;

type InfiniteCanvasWorldPath = Readonly<{
  bounds: InfiniteCanvasRect | null;
  length: number;
  points: readonly InfiniteCanvasPoint[];
  segments: readonly InfiniteCanvasWorldSegment[];
}>;

type InfiniteCanvasSceneLayerCullingSpace = InfiniteCanvasSceneLayerSpace;

function getFiniteScale(value: number) {
  return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
}

function getRectCenter(rect: InfiniteCanvasRect): InfiniteCanvasPoint {
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
  };
}

function getInfiniteCanvasRectConnectorPoint(
  rect: InfiniteCanvasRect,
  target: InfiniteCanvasPoint,
  options: InfiniteCanvasWindowConnectorOptions = {},
): InfiniteCanvasPoint {
  const padding = options.padding ?? 0;
  const center = getRectCenter(rect);
  const delta = {
    x: target.x - center.x,
    y: target.y - center.y,
  };
  const halfSize = {
    height: rect.height / 2 + padding,
    width: rect.width / 2 + padding,
  };
  const xScale = delta.x === 0 ? Number.POSITIVE_INFINITY : halfSize.width / Math.abs(delta.x);
  const yScale = delta.y === 0 ? Number.POSITIVE_INFINITY : halfSize.height / Math.abs(delta.y);
  const scale = Math.min(getFiniteScale(xScale), getFiniteScale(yScale), 1);

  return {
    x: center.x + delta.x * scale,
    y: center.y + delta.y * scale,
  };
}

function getInfiniteCanvasWindowConnectorPoint<Kind extends string>(
  window: InfiniteCanvasWindowProxy<Kind>,
  target: InfiniteCanvasPoint,
  options: InfiniteCanvasWindowConnectorOptions = {},
): InfiniteCanvasPoint {
  return getInfiniteCanvasRectConnectorPoint(window.rect, target, options);
}

function getInfiniteCanvasWorldSegment(
  start: InfiniteCanvasPoint,
  end: InfiniteCanvasPoint,
): InfiniteCanvasWorldSegment {
  const delta = {
    x: end.x - start.x,
    y: end.y - start.y,
  };
  const length = Math.max(Math.hypot(delta.x, delta.y), 1);

  return {
    angle: Math.atan2(delta.y, delta.x),
    delta,
    end,
    length,
    midpoint: {
      x: start.x + delta.x / 2,
      y: start.y + delta.y / 2,
    },
    start,
  };
}

function areWorldPointsEqual(left: InfiniteCanvasPoint, right: InfiniteCanvasPoint) {
  return left.x === right.x && left.y === right.y;
}

function compactWorldPathPoints(points: readonly InfiniteCanvasPoint[]) {
  return points.reduce<readonly InfiniteCanvasPoint[]>((compactedPoints, point) => {
    const previousPoint = compactedPoints.at(-1);

    return previousPoint === undefined || !areWorldPointsEqual(previousPoint, point)
      ? [...compactedPoints, point]
      : compactedPoints;
  }, []);
}

function getPointBounds(points: readonly InfiniteCanvasPoint[]): InfiniteCanvasRect | null {
  return points.reduce<InfiniteCanvasRect | null>((bounds, point) => {
    if (bounds === null) {
      return {
        height: 0,
        width: 0,
        x: point.x,
        y: point.y,
      };
    }

    const x = Math.min(bounds.x, point.x);
    const y = Math.min(bounds.y, point.y);
    const right = Math.max(bounds.x + bounds.width, point.x);
    const bottom = Math.max(bounds.y + bounds.height, point.y);

    return {
      height: bottom - y,
      width: right - x,
      x,
      y,
    };
  }, null);
}

function getInfiniteCanvasWorldPath(
  points: readonly InfiniteCanvasPoint[],
): InfiniteCanvasWorldPath {
  const pathPoints = compactWorldPathPoints(points);
  const segments = pathPoints
    .slice(0, -1)
    .map((point, index) => getInfiniteCanvasWorldSegment(point, pathPoints[index + 1] ?? point));

  return {
    bounds: getPointBounds(pathPoints),
    length: segments.reduce((totalLength, segment) => totalLength + segment.length, 0),
    points: pathPoints,
    segments,
  };
}

function clampProgress(progress: number) {
  return Math.min(Math.max(progress, 0), 1);
}

function interpolatePoint(
  start: InfiniteCanvasPoint,
  end: InfiniteCanvasPoint,
  progress: number,
): InfiniteCanvasPoint {
  return {
    x: start.x + (end.x - start.x) * progress,
    y: start.y + (end.y - start.y) * progress,
  };
}

function getInfiniteCanvasWorldPathPointAtProgress(
  path: InfiniteCanvasWorldPath,
  progress: number,
): InfiniteCanvasPoint {
  const fallback = path.points.at(-1) ?? {
    x: 0,
    y: 0,
  };
  const targetLength = path.length * clampProgress(progress);
  const located = path.segments.reduce<
    Readonly<{
      distance: number;
      point: InfiniteCanvasPoint | null;
    }>
  >(
    (state, segment) => {
      if (state.point !== null) {
        return state;
      }

      const nextDistance = state.distance + segment.length;

      return targetLength <= nextDistance
        ? {
            distance: nextDistance,
            point: interpolatePoint(
              segment.start,
              segment.end,
              segment.length === 0 ? 0 : (targetLength - state.distance) / segment.length,
            ),
          }
        : {
            distance: nextDistance,
            point: null,
          };
    },
    {
      distance: 0,
      point: null,
    },
  );

  return located.point ?? fallback;
}

function getInfiniteCanvasWindowConnectorSegment<Kind extends string>(
  from: InfiniteCanvasWindowProxy<Kind>,
  to: InfiniteCanvasWindowProxy<Kind>,
  options: InfiniteCanvasWindowConnectorOptions = {},
) {
  return getInfiniteCanvasRectConnectorSegment(from.rect, to.rect, options);
}

function getInfiniteCanvasRectConnectorSegment(
  fromRect: InfiniteCanvasRect,
  toRect: InfiniteCanvasRect,
  options: InfiniteCanvasWindowConnectorOptions = {},
) {
  const fromCenter = getRectCenter(fromRect);
  const toCenter = getRectCenter(toRect);

  return getInfiniteCanvasWorldSegment(
    getInfiniteCanvasRectConnectorPoint(fromRect, toCenter, options),
    getInfiniteCanvasRectConnectorPoint(toRect, fromCenter, options),
  );
}

function getOrthogonalConnectorPathPoints(segment: InfiniteCanvasWorldSegment) {
  const midX = segment.start.x + segment.delta.x / 2;
  const midY = segment.start.y + segment.delta.y / 2;

  return Math.abs(segment.delta.x) >= Math.abs(segment.delta.y)
    ? [
        segment.start,
        {
          x: midX,
          y: segment.start.y,
        },
        {
          x: midX,
          y: segment.end.y,
        },
        segment.end,
      ]
    : [
        segment.start,
        {
          x: segment.start.x,
          y: midY,
        },
        {
          x: segment.end.x,
          y: midY,
        },
        segment.end,
      ];
}

function getInfiniteCanvasWindowConnectorPath<Kind extends string>(
  from: InfiniteCanvasWindowProxy<Kind>,
  to: InfiniteCanvasWindowProxy<Kind>,
  options: InfiniteCanvasWindowConnectorPathOptions = {},
) {
  return getInfiniteCanvasRectConnectorPath(from.rect, to.rect, options);
}

function getInfiniteCanvasRectConnectorPath(
  fromRect: InfiniteCanvasRect,
  toRect: InfiniteCanvasRect,
  options: InfiniteCanvasWindowConnectorPathOptions = {},
) {
  const segment = getInfiniteCanvasRectConnectorSegment(fromRect, toRect, options);

  return getInfiniteCanvasWorldPath(
    options.route === "orthogonal"
      ? getOrthogonalConnectorPathPoints(segment)
      : [segment.start, segment.end],
  );
}

function getInfiniteCanvasWorldSegmentSceneTransform(
  segment: InfiniteCanvasWorldSegment,
  z = 0,
): InfiniteCanvasSceneSegmentTransform {
  return {
    length: segment.length,
    position: [segment.midpoint.x, -segment.midpoint.y, z],
    rotation: [0, 0, -segment.angle],
  };
}

function getInfiniteCanvasWorldPathSceneTransforms(path: InfiniteCanvasWorldPath, z = 0) {
  return path.segments.map((segment) => getInfiniteCanvasWorldSegmentSceneTransform(segment, z));
}

function getInfiniteCanvasViewportScreenRect(viewport: InfiniteCanvasViewport): InfiniteCanvasRect {
  return {
    height: viewport.height,
    width: viewport.width,
    x: 0,
    y: 0,
  };
}

function getInfiniteCanvasWindowProxyCullingRect<Kind extends string>(
  window: InfiniteCanvasWindowProxy<Kind>,
  space: InfiniteCanvasSceneLayerCullingSpace = "world",
): InfiniteCanvasRect {
  return space === "screen" ? window.screenRect : window.rect;
}

function getVisibleInfiniteCanvasWindowProxies<Kind extends string>(
  windows: readonly InfiniteCanvasWindowProxy<Kind>[],
  rect: InfiniteCanvasRect,
  space: InfiniteCanvasSceneLayerCullingSpace = "world",
) {
  return windows.filter((window) =>
    rectsIntersect(getInfiniteCanvasWindowProxyCullingRect(window, space), rect),
  );
}

export {
  getInfiniteCanvasRectConnectorPath,
  getInfiniteCanvasRectConnectorPoint,
  getInfiniteCanvasRectConnectorSegment,
  getInfiniteCanvasViewportScreenRect,
  getInfiniteCanvasWindowConnectorPoint,
  getInfiniteCanvasWindowConnectorPath,
  getInfiniteCanvasWindowConnectorSegment,
  getInfiniteCanvasWindowProxyCullingRect,
  getInfiniteCanvasWorldPath,
  getInfiniteCanvasWorldPathPointAtProgress,
  getInfiniteCanvasWorldPathSceneTransforms,
  getInfiniteCanvasWorldSegment,
  getInfiniteCanvasWorldSegmentSceneTransform,
  getVisibleInfiniteCanvasWindowProxies,
};

export type {
  InfiniteCanvasSceneLayerCullingSpace,
  InfiniteCanvasSceneSegmentTransform,
  InfiniteCanvasWindowConnectorOptions,
  InfiniteCanvasWindowConnectorPathOptions,
  InfiniteCanvasWindowConnectorRoute,
  InfiniteCanvasWorldPath,
  InfiniteCanvasWorldSegment,
};
