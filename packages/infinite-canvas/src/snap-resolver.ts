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

/**
 * Snapping needs two thresholds, not one.
 *
 * With a single distance, a guide engages and releases at the same pointer
 * position: nudge one pixel across it and the window jumps to the guide, jump the
 * pointer back and it un-snaps, and it does that every frame the pointer sits on
 * the boundary. The window shivers, the guide strobes, and the user has no idea
 * what they did wrong. This is risk R3 in the register.
 *
 * A guide that has *caught* is stickier than one that has not: it holds until the
 * pointer travels `releaseThreshold` away, while an idle guide still engages at
 * `threshold`. The pointer must cross a band, not a line, and the flicker has
 * nowhere to happen. `Math.max` is not a clamp for tidiness — a `releaseThreshold`
 * below `threshold` would invert the hysteresis and make snapping *more* eager to
 * let go than to catch, which is worse than no hysteresis at all.
 */
function getCandidateThreshold(
  candidate: SnapCandidate,
  policy: InfiniteCanvasSnapPolicy,
  engagedGuideIds: ReadonlySet<string>,
) {
  const engageThreshold = candidate.kind === "gap" ? policy.gapThreshold : policy.threshold;

  return engagedGuideIds.has(candidate.id)
    ? Math.max(engageThreshold, policy.releaseThreshold)
    : engageThreshold;
}

/**
 * The guides that were holding the window last frame. `state.snapPreview` is
 * already exactly this record, and a guide's id is its candidate's id — so
 * hysteresis needs no new state to remember what it caught.
 */
function getEngagedGuideIds<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  windowId: string,
): ReadonlySet<string> {
  return state.snapPreview === null || state.snapPreview.windowId !== windowId
    ? new Set()
    : new Set(state.snapPreview.guides.map((guide) => guide.id));
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
  engagedGuideIds: ReadonlySet<string>,
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
          threshold: getCandidateThreshold(candidate, policy, engagedGuideIds),
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
  const engagedGuideIds = getEngagedGuideIds(state, windowId);
  const xAdjustment = findAxisAdjustment(
    anchors.filter((anchor) => anchor.axis === "x"),
    candidates.filter((candidate) => candidate.axis === "x"),
    policy,
    state.camera.zoom,
    engagedGuideIds,
  );
  const yAdjustment = findAxisAdjustment(
    anchors.filter((anchor) => anchor.axis === "y"),
    candidates.filter((candidate) => candidate.axis === "y"),
    policy,
    state.camera.zoom,
    engagedGuideIds,
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
  // A resize edge that has caught a guide is as sticky as a moved one. Nothing
  // about dragging a corner makes the flicker at the threshold more tolerable.
  const engagedGuideIds = getEngagedGuideIds(state, windowId);
  const xAdjustment = findAxisAdjustment(
    anchors.filter((anchor) => anchor.axis === "x"),
    candidates.filter((candidate) => candidate.axis === "x"),
    policy,
    state.camera.zoom,
    engagedGuideIds,
  );
  const yAdjustment = findAxisAdjustment(
    anchors.filter((anchor) => anchor.axis === "y"),
    candidates.filter((candidate) => candidate.axis === "y"),
    policy,
    state.camera.zoom,
    engagedGuideIds,
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
