import { getViewportInsetWorldRect } from "./geometry";
import type { SnapAnchor, SnapCandidate, WindowSnapSource } from "./snap-types";
import type {
  InfiniteCanvasRect,
  InfiniteCanvasResizeHandle,
  InfiniteCanvasSnapPolicy,
  InfiniteCanvasState,
} from "./types";

function getMoveSnapAnchors(
  rect: InfiniteCanvasRect,
  policy: InfiniteCanvasSnapPolicy,
): readonly SnapAnchor[] {
  const edgeAnchors = [
    {
      axis: "x",
      kind: "edge",
      position: rect.x,
      sourceAnchor: "left",
    },
    {
      axis: "x",
      kind: "edge",
      position: rect.x + rect.width,
      sourceAnchor: "right",
    },
    {
      axis: "y",
      kind: "edge",
      position: rect.y,
      sourceAnchor: "top",
    },
    {
      axis: "y",
      kind: "edge",
      position: rect.y + rect.height,
      sourceAnchor: "bottom",
    },
  ] satisfies readonly SnapAnchor[];
  const centerAnchors = policy.snapToCenters
    ? ([
        {
          axis: "x",
          kind: "center",
          position: rect.x + rect.width / 2,
          sourceAnchor: "center",
        },
        {
          axis: "y",
          kind: "center",
          position: rect.y + rect.height / 2,
          sourceAnchor: "middle",
        },
      ] satisfies readonly SnapAnchor[])
    : [];

  return [...edgeAnchors, ...centerAnchors];
}

function getResizeSnapAnchors(
  rect: InfiniteCanvasRect,
  handle: InfiniteCanvasResizeHandle,
): readonly SnapAnchor[] {
  const west = handle === "west" || handle === "north-west" || handle === "south-west";
  const east = handle === "east" || handle === "north-east" || handle === "south-east";
  const north = handle === "north" || handle === "north-east" || handle === "north-west";
  const south = handle === "south" || handle === "south-east" || handle === "south-west";

  return [
    west
      ? {
          axis: "x",
          kind: "edge",
          position: rect.x,
          sourceAnchor: "left",
        }
      : null,
    east
      ? {
          axis: "x",
          kind: "edge",
          position: rect.x + rect.width,
          sourceAnchor: "right",
        }
      : null,
    north
      ? {
          axis: "y",
          kind: "edge",
          position: rect.y,
          sourceAnchor: "top",
        }
      : null,
    south
      ? {
          axis: "y",
          kind: "edge",
          position: rect.y + rect.height,
          sourceAnchor: "bottom",
        }
      : null,
  ].filter((anchor): anchor is SnapAnchor => anchor !== null);
}

function getVisibleWindowSnapSources<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  excludedWindowIds: readonly string[],
): readonly WindowSnapSource[] {
  return state.windows
    .filter((window) => !excludedWindowIds.includes(window.id) && window.mode !== "minimized")
    .map((window) => ({
      id: window.id,
      rect: window.rect,
    }));
}

function buildViewportSnapCandidates<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  policy: InfiniteCanvasSnapPolicy,
): readonly SnapCandidate[] {
  if (!policy.snapToViewport) {
    return [];
  }

  const viewportRect = getViewportInsetWorldRect(state.camera, state.viewport, policy.edgeInset);
  const edgeCandidates = [
    {
      axis: "x",
      from: "viewport",
      id: "viewport-left",
      kind: "edge",
      position: viewportRect.x,
      priority: 3,
    },
    {
      axis: "x",
      from: "viewport",
      id: "viewport-right",
      kind: "edge",
      position: viewportRect.x + viewportRect.width,
      priority: 3,
    },
    {
      axis: "y",
      from: "viewport",
      id: "viewport-top",
      kind: "edge",
      position: viewportRect.y,
      priority: 3,
    },
    {
      axis: "y",
      from: "viewport",
      id: "viewport-bottom",
      kind: "edge",
      position: viewportRect.y + viewportRect.height,
      priority: 3,
    },
  ] satisfies readonly SnapCandidate[];
  const centerCandidates = policy.snapToCenters
    ? ([
        {
          axis: "x",
          from: "viewport",
          id: "viewport-center-x",
          kind: "center",
          position: viewportRect.x + viewportRect.width / 2,
          priority: 4,
        },
        {
          axis: "y",
          from: "viewport",
          id: "viewport-center-y",
          kind: "center",
          position: viewportRect.y + viewportRect.height / 2,
          priority: 4,
        },
      ] satisfies readonly SnapCandidate[])
    : [];

  return [...edgeCandidates, ...centerCandidates];
}

function buildWindowSnapCandidates(
  sources: readonly WindowSnapSource[],
  policy: InfiniteCanvasSnapPolicy,
): readonly SnapCandidate[] {
  if (!policy.snapToWindows) {
    return [];
  }

  return sources.flatMap((source) => {
    const edgeCandidates = [
      {
        axis: "x",
        from: "window",
        id: `${source.id}-left`,
        kind: "edge",
        position: source.rect.x,
        priority: 1,
      },
      {
        axis: "x",
        from: "window",
        id: `${source.id}-right`,
        kind: "edge",
        position: source.rect.x + source.rect.width,
        priority: 1,
      },
      {
        axis: "y",
        from: "window",
        id: `${source.id}-top`,
        kind: "edge",
        position: source.rect.y,
        priority: 1,
      },
      {
        axis: "y",
        from: "window",
        id: `${source.id}-bottom`,
        kind: "edge",
        position: source.rect.y + source.rect.height,
        priority: 1,
      },
    ] satisfies readonly SnapCandidate[];
    const centerCandidates = policy.snapToCenters
      ? ([
          {
            axis: "x",
            from: "window",
            id: `${source.id}-center-x`,
            kind: "center",
            position: source.rect.x + source.rect.width / 2,
            priority: 2,
          },
          {
            axis: "y",
            from: "window",
            id: `${source.id}-center-y`,
            kind: "center",
            position: source.rect.y + source.rect.height / 2,
            priority: 2,
          },
        ] satisfies readonly SnapCandidate[])
      : [];

    return [...edgeCandidates, ...centerCandidates];
  });
}

function rangesOverlap(leftStart: number, leftEnd: number, rightStart: number, rightEnd: number) {
  return Math.min(leftEnd, rightEnd) > Math.max(leftStart, rightStart);
}

function buildGapSnapCandidates(
  sources: readonly WindowSnapSource[],
  rect: InfiniteCanvasRect,
  policy: InfiniteCanvasSnapPolicy,
): readonly SnapCandidate[] {
  if (!policy.snapToGaps || sources.length < 2) {
    return [];
  }

  return sources.flatMap((source, sourceIndex) =>
    sources.slice(sourceIndex + 1).flatMap((otherSource) => {
      const left = source.rect.x <= otherSource.rect.x ? source : otherSource;
      const right = source.rect.x <= otherSource.rect.x ? otherSource : source;
      const top = source.rect.y <= otherSource.rect.y ? source : otherSource;
      const bottom = source.rect.y <= otherSource.rect.y ? otherSource : source;
      const horizontalGap = right.rect.x - (left.rect.x + left.rect.width);
      const verticalGap = bottom.rect.y - (top.rect.y + top.rect.height);
      const horizontalCandidate =
        horizontalGap >= rect.width &&
        rangesOverlap(rect.y, rect.y + rect.height, left.rect.y, left.rect.y + left.rect.height) &&
        rangesOverlap(rect.y, rect.y + rect.height, right.rect.y, right.rect.y + right.rect.height)
          ? ([
              {
                axis: "x",
                from: "window",
                id: `gap-x-${left.id}-${right.id}`,
                kind: "gap",
                position: left.rect.x + left.rect.width + (horizontalGap - rect.width) / 2,
                priority: 5,
              },
            ] satisfies readonly SnapCandidate[])
          : [];
      const verticalCandidate =
        verticalGap >= rect.height &&
        rangesOverlap(rect.x, rect.x + rect.width, top.rect.x, top.rect.x + top.rect.width) &&
        rangesOverlap(rect.x, rect.x + rect.width, bottom.rect.x, bottom.rect.x + bottom.rect.width)
          ? ([
              {
                axis: "y",
                from: "window",
                id: `gap-y-${top.id}-${bottom.id}`,
                kind: "gap",
                position: top.rect.y + top.rect.height + (verticalGap - rect.height) / 2,
                priority: 5,
              },
            ] satisfies readonly SnapCandidate[])
          : [];

      return [...horizontalCandidate, ...verticalCandidate];
    }),
  );
}

function buildSnapCandidates<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  windowId: string,
  rect: InfiniteCanvasRect,
  policy: InfiniteCanvasSnapPolicy,
  excludedWindowIds: readonly string[] = [windowId],
): readonly SnapCandidate[] {
  const sources = getVisibleWindowSnapSources(state, excludedWindowIds);

  return [
    ...buildViewportSnapCandidates(state, policy),
    ...buildWindowSnapCandidates(sources, policy),
    ...buildGapSnapCandidates(sources, rect, policy),
  ];
}

export { buildSnapCandidates, getMoveSnapAnchors, getResizeSnapAnchors };
