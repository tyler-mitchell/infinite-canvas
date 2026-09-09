import { rectsIntersect } from "./geometry";
import type {
  InfiniteCanvasPoint,
  InfiniteCanvasRect,
  InfiniteCanvasSceneLayerSpace,
  InfiniteCanvasViewport,
  InfiniteCanvasWindowProxy,
} from "./types";

type InfiniteCanvasWindowConnectorOptions = Readonly<{
  padding?: number;
}>;

type InfiniteCanvasWindowConnectorRoute = "orthogonal" | "straight";

type InfiniteCanvasRectFacing = "east" | "north" | "south" | "west";

type InfiniteCanvasPathDataOptions = Readonly<{
  /** In the same unit as the points. Zero, the default, keeps corners sharp. */
  cornerRadius?: number;
}>;

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

type ParametricSpan = Readonly<{ from: number; to: number }>;

/** Returns the part of a segment inside a rect as a 0..1 span. */
function getSegmentRectSpan(
  segment: InfiniteCanvasWorldSegment,
  rect: InfiniteCanvasRect,
): ParametricSpan | null {
  return [
    { denominator: -segment.delta.x, distance: segment.start.x - rect.x },
    { denominator: segment.delta.x, distance: rect.x + rect.width - segment.start.x },
    { denominator: -segment.delta.y, distance: segment.start.y - rect.y },
    { denominator: segment.delta.y, distance: rect.y + rect.height - segment.start.y },
  ].reduce<ParametricSpan | null>(
    (span, { denominator, distance }) => {
      if (span === null) {
        return null;
      }

      if (denominator === 0) {
        return distance < 0 ? null : span;
      }

      const crossing = distance / denominator;

      return denominator < 0
        ? crossing > span.to
          ? null
          : { from: Math.max(span.from, crossing), to: span.to }
        : crossing < span.from
          ? null
          : { from: span.from, to: Math.min(span.to, crossing) };
    },
    { from: 0, to: 1 },
  );
}

/** Returns uncovered 0..1 spans after merge. */
function getUncoveredSpans(covered: readonly ParametricSpan[]): readonly ParametricSpan[] {
  const merged = [...covered]
    .sort((left, right) => left.from - right.from)
    .reduce<Readonly<{ cursor: number; spans: readonly ParametricSpan[] }>>(
      (state, span) =>
        span.to <= state.cursor
          ? state
          : {
              cursor: span.to,
              spans:
                span.from > state.cursor
                  ? [...state.spans, { from: state.cursor, to: span.from }]
                  : state.spans,
            },
      { cursor: 0, spans: [] },
    );

  return merged.cursor < 1 ? [...merged.spans, { from: merged.cursor, to: 1 }] : merged.spans;
}

/** Returns path segments that no occluder covers. */
function getInfiniteCanvasUnoccludedSegments(
  segments: readonly InfiniteCanvasWorldSegment[],
  occluders: readonly InfiniteCanvasRect[],
): readonly InfiniteCanvasWorldSegment[] {
  return segments.flatMap((segment) => {
    const covered = occluders.flatMap((rect) => {
      const span = getSegmentRectSpan(segment, rect);

      return span === null || span.to <= span.from ? [] : [span];
    });

    return getUncoveredSpans(covered).map((span) =>
      getInfiniteCanvasWorldSegment(
        interpolatePoint(segment.start, segment.end, span.from),
        interpolatePoint(segment.start, segment.end, span.to),
      ),
    );
  });
}

/** Returns path segments inside the given rect. */
function getInfiniteCanvasSegmentsWithinRect(
  segments: readonly InfiniteCanvasWorldSegment[],
  bounds: InfiniteCanvasRect,
): readonly InfiniteCanvasWorldSegment[] {
  return segments.flatMap((segment) => {
    const span = getSegmentRectSpan(segment, bounds);

    return span === null || span.to <= span.from
      ? []
      : [
          getInfiniteCanvasWorldSegment(
            interpolatePoint(segment.start, segment.end, span.from),
            interpolatePoint(segment.start, segment.end, span.to),
          ),
        ];
  });
}

// Allows small floating-point gaps at clipped joints.
const RUN_JOIN_TOLERANCE = 0.001;

/** Joins adjacent unoccluded segments into paths. */
function getInfiniteCanvasUnoccludedRuns(
  segments: readonly InfiniteCanvasWorldSegment[],
  occluders: readonly InfiniteCanvasRect[],
): readonly InfiniteCanvasWorldPath[] {
  const runs: InfiniteCanvasPoint[][] = [];

  for (const piece of getInfiniteCanvasUnoccludedSegments(segments, occluders)) {
    const open = runs.at(-1);
    const joint = open?.at(-1);
    const joins =
      joint !== undefined &&
      Math.abs(joint.x - piece.start.x) <= RUN_JOIN_TOLERANCE &&
      Math.abs(joint.y - piece.start.y) <= RUN_JOIN_TOLERANCE;

    if (open !== undefined && joins) {
      open.push(piece.end);
    } else {
      runs.push([piece.start, piece.end]);
    }
  }

  return runs.map((points) => getInfiniteCanvasWorldPath(points));
}

/** Returns the longest unoccluded path or null. */
function getInfiniteCanvasLongestUnoccludedRun(
  segments: readonly InfiniteCanvasWorldSegment[],
  occluders: readonly InfiniteCanvasRect[],
): InfiniteCanvasWorldPath | null {
  return getInfiniteCanvasUnoccludedRuns(
    segments,
    occluders,
  ).reduce<InfiniteCanvasWorldPath | null>(
    (longest, run) => (longest === null || run.length > longest.length ? run : longest),
    null,
  );
}

/** Returns the longest unoccluded segment or null. */
function getInfiniteCanvasLongestUnoccludedSegment(
  segments: readonly InfiniteCanvasWorldSegment[],
  occluders: readonly InfiniteCanvasRect[],
): InfiniteCanvasWorldSegment | null {
  return getInfiniteCanvasUnoccludedSegments(
    segments,
    occluders,
  ).reduce<InfiniteCanvasWorldSegment | null>(
    (longest, segment) => (longest === null || segment.length > longest.length ? segment : longest),
    null,
  );
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

function movePointToward(
  from: InfiniteCanvasPoint,
  to: InfiniteCanvasPoint,
  distance: number,
): InfiniteCanvasPoint {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  const ratio = length === 0 ? 0 : Math.min(distance / length, 1);

  return {
    x: from.x + (to.x - from.x) * ratio,
    y: from.y + (to.y - from.y) * ratio,
  };
}

const formatPathCoordinate = (value: number) => String(Math.round(value * 100) / 100);

const formatPathPoint = (point: InfiniteCanvasPoint) =>
  `${formatPathCoordinate(point.x)} ${formatPathCoordinate(point.y)}`;

/**
 * An SVG path through the points, with corners rounded by `cornerRadius`.
 *
 * A polyline can only draw sharp corners, so an orthogonal route arrives as right angles. The
 * points are unitless: a consumer that converts to screen space first gets a corner that stays the
 * same size at any zoom, which is the reason this takes points rather than a world path.
 *
 * Each corner is one quadratic curve whose control point is the corner itself. The reach shrinks to
 * half of the shorter adjacent segment, so a short segment bends instead of overshooting its
 * neighbour.
 */
function getInfiniteCanvasPathData(
  points: readonly InfiniteCanvasPoint[],
  options: InfiniteCanvasPathDataOptions = {},
): string {
  const path = compactWorldPathPoints(points);
  const start = path[0];
  const cornerRadius = options.cornerRadius ?? 0;

  if (start === undefined) {
    return "";
  }

  return path.slice(1).reduce(
    (data, point, index) => {
      const previous = path[index];
      const next = path[index + 2];

      if (previous === undefined || next === undefined || cornerRadius <= 0) {
        return `${data} L ${formatPathPoint(point)}`;
      }

      const reach = Math.min(
        cornerRadius,
        Math.hypot(point.x - previous.x, point.y - previous.y) / 2,
        Math.hypot(next.x - point.x, next.y - point.y) / 2,
      );

      return `${data} L ${formatPathPoint(movePointToward(point, previous, reach))} Q ${formatPathPoint(
        point,
      )} ${formatPathPoint(movePointToward(point, next, reach))}`;
    },
    `M ${formatPathPoint(start)}`,
  );
}

/** Which face of `fromRect` points at `toRect`, by the larger of the two centre offsets. */
function getRectFacing(
  fromRect: InfiniteCanvasRect,
  toRect: InfiniteCanvasRect,
): InfiniteCanvasRectFacing {
  const from = getRectCenter(fromRect);
  const to = getRectCenter(toRect);
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? "east" : "west";
  }

  return dy >= 0 ? "south" : "north";
}

/** The midpoint of one face. */
function getRectFacePoint(
  rect: InfiniteCanvasRect,
  facing: InfiniteCanvasRectFacing,
): InfiniteCanvasPoint {
  const center = getRectCenter(rect);
  const points: Readonly<Record<InfiniteCanvasRectFacing, InfiniteCanvasPoint>> = {
    east: { x: rect.x + rect.width, y: center.y },
    north: { x: center.x, y: rect.y },
    south: { x: center.x, y: rect.y + rect.height },
    west: { x: rect.x, y: center.y },
  };

  return points[facing];
}

const OPPOSITE_FACING: Readonly<Record<InfiniteCanvasRectFacing, InfiniteCanvasRectFacing>> = {
  east: "west",
  north: "south",
  south: "north",
  west: "east",
};

/**
 * One path per target, with every target on the same face sharing one anchor and one trunk.
 *
 * `getInfiniteCanvasRectConnectorPath` routes a pair in isolation, so a rect with five connectors
 * meets them at five different boundary points and the fan reads as five unrelated lines. Routing
 * the set together lets them leave through a single point, turn onto a shared trunk, and branch to
 * each target — which is what makes a hub look like a hub.
 *
 * Targets are grouped by which face they sit off, so a target behind the source gets the trunk on
 * its own side rather than a line doubling back through the rect. Each group's trunk sits midway
 * between the source face and the nearest target in that group.
 *
 * Returns paths in the order the targets were given.
 */
function getInfiniteCanvasRectBundledConnectorPaths(
  fromRect: InfiniteCanvasRect,
  toRects: readonly InfiniteCanvasRect[],
  options: InfiniteCanvasWindowConnectorOptions = {},
): readonly InfiniteCanvasWorldPath[] {
  const padding = options.padding ?? 0;
  const facings = toRects.map((toRect) => getRectFacing(fromRect, toRect));

  return toRects.map((toRect, index) => {
    const facing = facings[index] ?? "east";
    const horizontal = facing === "east" || facing === "west";
    const start = getRectFacePoint(fromRect, facing);
    const end = getRectFacePoint(toRect, OPPOSITE_FACING[facing]);
    const sign = facing === "east" || facing === "south" ? 1 : -1;
    // The nearest facing edge among the targets sharing this face, so one trunk serves the group.
    const nearest = toRects
      .filter((_, other) => facings[other] === facing)
      .map((rect) => {
        const face = getRectFacePoint(rect, OPPOSITE_FACING[facing]);

        return horizontal ? face.x : face.y;
      })
      .reduce((closest, edge) => (sign * edge < sign * closest ? edge : closest), Infinity * sign);
    const origin = horizontal ? start.x : start.y;
    const trunk = origin + (nearest - origin) / 2 + padding * sign;

    return getInfiniteCanvasWorldPath(
      horizontal
        ? [start, { x: trunk, y: start.y }, { x: trunk, y: end.y }, end]
        : [start, { x: start.x, y: trunk }, { x: end.x, y: trunk }, end],
    );
  });
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
  getInfiniteCanvasLongestUnoccludedRun,
  getInfiniteCanvasLongestUnoccludedSegment,
  getInfiniteCanvasPathData,
  getInfiniteCanvasRectBundledConnectorPaths,
  getInfiniteCanvasRectConnectorPath,
  getInfiniteCanvasRectConnectorPoint,
  getInfiniteCanvasRectConnectorSegment,
  getInfiniteCanvasSegmentsWithinRect,
  getInfiniteCanvasUnoccludedRuns,
  getInfiniteCanvasUnoccludedSegments,
  getInfiniteCanvasViewportScreenRect,
  getInfiniteCanvasWindowConnectorPoint,
  getInfiniteCanvasWindowConnectorPath,
  getInfiniteCanvasWindowConnectorSegment,
  getInfiniteCanvasWindowProxyCullingRect,
  getInfiniteCanvasWorldPath,
  getInfiniteCanvasWorldPathPointAtProgress,
  getInfiniteCanvasWorldSegment,
  getVisibleInfiniteCanvasWindowProxies,
};

export type {
  InfiniteCanvasPathDataOptions,
  InfiniteCanvasRectFacing,
  InfiniteCanvasSceneLayerCullingSpace,
  InfiniteCanvasWindowConnectorOptions,
  InfiniteCanvasWindowConnectorPathOptions,
  InfiniteCanvasWindowConnectorRoute,
  InfiniteCanvasWorldPath,
  InfiniteCanvasWorldSegment,
};
