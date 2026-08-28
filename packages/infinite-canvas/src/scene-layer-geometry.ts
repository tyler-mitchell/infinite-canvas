import { rectsIntersect } from "./geometry";
import type {
  InfiniteCanvasPoint,
  InfiniteCanvasRect,
  InfiniteCanvasSceneLayerSpace,
  InfiniteCanvasSceneVector3,
  InfiniteCanvasViewport,
  InfiniteCanvasWindowProxy,
} from "./types";

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

type ParametricSpan = Readonly<{ from: number; to: number }>;

/**
 * Where along a segment it passes through a rect, as a `0…1` span, or `null` if it never does.
 *
 * Liang–Barsky: four half-plane constraints, one per rect edge, each bounding entry or exit by the
 * sign of the direction. A zero denominator means the segment is parallel to that pair of edges,
 * so it is wholly inside or wholly outside that band and there is nothing to clip.
 */
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

/** The complement of a set of spans within `0…1`, with overlaps merged as it goes. */
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

/**
 * The parts of a path no rect covers, per input segment.
 *
 * A connector between two windows that nearly touch is almost entirely behind them, so a label
 * anchored at the path's midpoint lands inside a window. Use this to find somewhere visible.
 *
 * Rects are treated as opaque occluders rather than as windows, so a consumer can pass anything
 * that covers the line: windows, overlays, a HUD panel's world footprint.
 */
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

/**
 * The parts of a path that fall inside a rect. The inverse of
 * `getInfiniteCanvasUnoccludedSegments`, which removes what is covered.
 *
 * Use this for a region a consumer wants to stay within, such as the content area left by
 * `viewportInsets`. Chrome bands are not occluders; the region that remains is what to clip to.
 */
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

/** Clipping is float arithmetic, so a closed joint lands slightly apart rather than exactly. */
const RUN_JOIN_TOLERANCE = 0.001;

/**
 * The contiguous unoccluded runs of a path, as `WorldPath`s. `getInfiniteCanvasUnoccludedSegments`
 * answers per input segment, so an elbow comes back in pieces even where nothing covers the corner.
 */
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

/**
 * The longest contiguous run, or `null` when the whole path is covered. Anchor a label with
 * `getInfiniteCanvasWorldPathPointAtProgress(run, 0.5)`; a clipped run is not symmetric, so
 * walking it and averaging its ends give different points.
 */
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

/**
 * The longest single unoccluded segment. Cheaper than the run query and gives the same answer only
 * on a straight line; use `getInfiniteCanvasLongestUnoccludedRun` for a routed path.
 */
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
  getInfiniteCanvasLongestUnoccludedRun,
  getInfiniteCanvasLongestUnoccludedSegment,
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
