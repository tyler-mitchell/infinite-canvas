import { DEFAULT_INFINITE_CANVAS_SNAP_POLICY } from "./constants";
import { buildSnapCandidates, getMoveSnapAnchors, getResizeSnapAnchors } from "./snap-candidates";
import type { SnapAdjustment, SnapAnchor, SnapCandidate } from "./snap-types";
import type {
  InfiniteCanvasRect,
  InfiniteCanvasResizeHandle,
  InfiniteCanvasSize,
  InfiniteCanvasSnapGuide,
  InfiniteCanvasSnapPolicy,
  InfiniteCanvasSnapPreview,
  InfiniteCanvasState,
} from "./types";

type SnapMatch = Readonly<{
  candidate: SnapCandidate;
  delta: number;
  distancePx: number;
  guide: InfiniteCanvasSnapGuide;
  sourceAnchor: SnapAnchor["sourceAnchor"];
  threshold: number;
}>;

const SNAP_DELTA_EPSILON = 0.000001;

function isCompatibleCandidate(anchor: SnapAnchor, candidate: SnapCandidate) {
  if (anchor.axis !== candidate.axis) {
    return false;
  }

  if (candidate.kind === "gap") {
    return anchor.sourceAnchor === "left" || anchor.sourceAnchor === "top";
  }

  return anchor.kind === candidate.kind;
}

function nearlyEqual(left: number, right: number) {
  return Math.abs(left - right) <= SNAP_DELTA_EPSILON;
}

function getCandidateThreshold(candidate: SnapCandidate, policy: InfiniteCanvasSnapPolicy) {
  return candidate.kind === "gap" ? policy.gapThreshold : policy.threshold;
}

function toGuide(anchor: SnapAnchor, candidate: SnapCandidate): InfiniteCanvasSnapGuide {
  return {
    axis: candidate.axis,
    from: candidate.from,
    id: candidate.id,
    kind: candidate.kind,
    position: candidate.position,
    sourceAnchor: anchor.sourceAnchor,
  };
}

function chooseBetterAdjustment(
  best: SnapAdjustment | null,
  candidate: SnapAdjustment,
  zoom: number,
) {
  if (best === null) {
    return candidate;
  }

  const bestDistance = Math.abs(best.delta * zoom);
  const candidateDistance = Math.abs(candidate.delta * zoom);

  return candidateDistance < bestDistance ||
    (candidateDistance === bestDistance && candidate.priority < best.priority)
    ? candidate
    : best;
}

function findAxisAdjustment(
  anchors: readonly SnapAnchor[],
  candidates: readonly SnapCandidate[],
  policy: InfiniteCanvasSnapPolicy,
  zoom: number,
): SnapAdjustment | null {
  const matches: readonly SnapMatch[] = anchors.flatMap((anchor) =>
    candidates
      .filter((candidate) => isCompatibleCandidate(anchor, candidate))
      .map(
        (candidate): SnapMatch => ({
          candidate,
          delta: candidate.position - anchor.position,
          distancePx: Math.abs((candidate.position - anchor.position) * zoom),
          guide: toGuide(anchor, candidate),
          sourceAnchor: anchor.sourceAnchor,
          threshold: getCandidateThreshold(candidate, policy),
        }),
      ),
  );
  const reachableMatches = matches.filter((match) => match.distancePx <= match.threshold);
  const best = reachableMatches.reduce<SnapAdjustment | null>(
    (currentBest, match) =>
      chooseBetterAdjustment(
        currentBest,
        {
          delta: match.delta,
          guides: [match.guide],
          priority: match.candidate.priority,
          sourceAnchor: match.sourceAnchor,
        },
        zoom,
      ),
    null,
  );

  return best === null
    ? null
    : {
        ...best,
        guides: reachableMatches
          .filter(
            (match) =>
              match.candidate.priority === best.priority && nearlyEqual(match.delta, best.delta),
          )
          .map((match) => match.guide),
      };
}

function createSnapPreview(
  windowId: string,
  rect: InfiniteCanvasRect,
  guides: readonly InfiniteCanvasSnapGuide[],
): InfiniteCanvasSnapPreview | null {
  return guides.length === 0
    ? null
    : {
        guides,
        rect,
        windowId,
      };
}

function applySnapToRect<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  windowId: string,
  rect: InfiniteCanvasRect,
  policy: InfiniteCanvasSnapPolicy = DEFAULT_INFINITE_CANVAS_SNAP_POLICY,
  excludedWindowIds: readonly string[] = [windowId],
): Readonly<{
  preview: InfiniteCanvasSnapPreview | null;
  rect: InfiniteCanvasRect;
}> {
  if (!policy.enabled) {
    return {
      preview: null,
      rect,
    };
  }

  const candidates = buildSnapCandidates(state, windowId, rect, policy, excludedWindowIds);
  const anchors = getMoveSnapAnchors(rect, policy);
  const xAdjustment = findAxisAdjustment(
    anchors.filter((anchor) => anchor.axis === "x"),
    candidates.filter((candidate) => candidate.axis === "x"),
    policy,
    state.camera.zoom,
  );
  const yAdjustment = findAxisAdjustment(
    anchors.filter((anchor) => anchor.axis === "y"),
    candidates.filter((candidate) => candidate.axis === "y"),
    policy,
    state.camera.zoom,
  );
  const snappedRect = {
    ...rect,
    x: rect.x + (xAdjustment?.delta ?? 0),
    y: rect.y + (yAdjustment?.delta ?? 0),
  };
  const guides = [xAdjustment, yAdjustment].flatMap((adjustment) => adjustment?.guides ?? []);

  return {
    preview: createSnapPreview(windowId, snappedRect, guides),
    rect: snappedRect,
  };
}

function applyResizeAxisAdjustment(
  rect: InfiniteCanvasRect,
  adjustment: SnapAdjustment | null,
  minSize: InfiniteCanvasSize,
): Readonly<{
  guides: readonly InfiniteCanvasSnapGuide[];
  rect: InfiniteCanvasRect;
}> {
  if (adjustment === null) {
    return {
      guides: [],
      rect,
    };
  }

  switch (adjustment.sourceAnchor) {
    case "left": {
      const width = rect.width - adjustment.delta;

      return width < minSize.width
        ? {
            guides: [],
            rect,
          }
        : {
            guides: adjustment.guides,
            rect: {
              ...rect,
              width,
              x: rect.x + adjustment.delta,
            },
          };
    }
    case "right": {
      const width = rect.width + adjustment.delta;

      return width < minSize.width
        ? {
            guides: [],
            rect,
          }
        : {
            guides: adjustment.guides,
            rect: {
              ...rect,
              width,
            },
          };
    }
    case "top": {
      const height = rect.height - adjustment.delta;

      return height < minSize.height
        ? {
            guides: [],
            rect,
          }
        : {
            guides: adjustment.guides,
            rect: {
              ...rect,
              height,
              y: rect.y + adjustment.delta,
            },
          };
    }
    case "bottom": {
      const height = rect.height + adjustment.delta;

      return height < minSize.height
        ? {
            guides: [],
            rect,
          }
        : {
            guides: adjustment.guides,
            rect: {
              ...rect,
              height,
            },
          };
    }
    case "center":
    case "middle":
      return {
        guides: [],
        rect,
      };
  }
}

function applyResizeSnapToRect<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  windowId: string,
  rect: InfiniteCanvasRect,
  handle: InfiniteCanvasResizeHandle,
  minSize: InfiniteCanvasSize,
  policy: InfiniteCanvasSnapPolicy = DEFAULT_INFINITE_CANVAS_SNAP_POLICY,
): Readonly<{
  preview: InfiniteCanvasSnapPreview | null;
  rect: InfiniteCanvasRect;
}> {
  if (!policy.enabled) {
    return {
      preview: null,
      rect,
    };
  }

  const candidates = buildSnapCandidates(state, windowId, rect, policy).filter(
    (candidate) => candidate.kind !== "gap",
  );
  const anchors = getResizeSnapAnchors(rect, handle);
  const xAdjustment = findAxisAdjustment(
    anchors.filter((anchor) => anchor.axis === "x"),
    candidates.filter((candidate) => candidate.axis === "x"),
    policy,
    state.camera.zoom,
  );
  const yAdjustment = findAxisAdjustment(
    anchors.filter((anchor) => anchor.axis === "y"),
    candidates.filter((candidate) => candidate.axis === "y"),
    policy,
    state.camera.zoom,
  );
  const xApplied = applyResizeAxisAdjustment(rect, xAdjustment, minSize);
  const yApplied = applyResizeAxisAdjustment(xApplied.rect, yAdjustment, minSize);
  const guides = [...xApplied.guides, ...yApplied.guides];

  return {
    preview: createSnapPreview(windowId, yApplied.rect, guides),
    rect: yApplied.rect,
  };
}

export { applyResizeSnapToRect, applySnapToRect };
