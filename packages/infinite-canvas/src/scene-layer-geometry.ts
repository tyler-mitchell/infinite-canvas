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
 * Liang–Barsky: the segment is inside on the intersection of four half-plane constraints, one per
 * rect edge, each of which either bounds the entry or the exit depending on the sign of the
 * direction. A zero denominator means the segment is parallel to that pair of edges, in which case
 * it is either wholly within that band or wholly outside it — no clipping to do either way.
 *
 * The low-level-mathematics exception to this codebase's no-`let` rule applies here, which is why
 * the accumulation is a `reduce` rather than a loop with mutable bounds. `null` short-circuits.
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
 * The parts of a path no rect covers.
 *
 * Answers "which of this line can actually be seen", which a consumer drawing connectors beneath
 * windows cannot answer for itself without re-deriving geometry the canvas already owns — it holds
 * both the path segments and the window rects, and they must not be computed twice.
 *
 * The case that motivated it: a connector between two windows that nearly touch is almost entirely
 * behind them, and anything anchored at the path's midpoint — a label, a grab target — lands inside
 * a window and is invisible. The midpoint is the obvious anchor and the wrong one. The longest run
 * returned here is the right one, and it is a different query.
 *
 * Rects are consumed as opaque occluders rather than as windows, so a consumer can pass whatever
 * actually covers the line: windows, its own overlays, a HUD panel's world footprint.
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
 * The parts of a path that fall inside a rect — the other half of "can this be seen".
 *
 * `getInfiniteCanvasUnoccludedSegments` removes what is covered; this keeps what is within. A
 * consumer needs both, because a line is invisible either by having something on top of it or by
 * being somewhere nobody is looking, and those are different geometry.
 *
 * The case that asked for it: a canvas whose chrome reserves bands along its edges through
 * `viewportInsets`. A connector anchor landing in one of those bands is behind a panel just as
 * surely as behind a window, but a band is not an occluder — it is the complement of the region
 * that remains, and clipping to that region is the operation that expresses it.
 *
 * Uses the same parametric span as the occlusion clip, taken the other way round: there the span
 * inside the rect is the hole, here it is the whole answer.
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

/**
 * The longest run of a path that nothing covers, or `null` when every part of it is hidden.
 *
 * What a consumer almost always wants from the above: one place to put the thing that has to be
 * seen or hit. Returning the whole set and leaving each caller to sort it would have every caller
 * write the same three lines and eventually disagree about ties.
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
  getInfiniteCanvasLongestUnoccludedSegment,
  getInfiniteCanvasRectConnectorPath,
  getInfiniteCanvasRectConnectorPoint,
  getInfiniteCanvasRectConnectorSegment,
  getInfiniteCanvasSegmentsWithinRect,
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
