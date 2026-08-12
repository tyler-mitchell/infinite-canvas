import {
  DEFAULT_INFINITE_CANVAS_GROUP_METRICS,
  getInfiniteCanvasGroupDockEdgeAtPoint,
  getInfiniteCanvasGroupLayout,
  type InfiniteCanvasGroupMetrics,
} from "./group-layout";
import {
  createInfiniteCanvasGroupWindowNode,
  dockInfiniteCanvasGroupWindow,
  equalizeInfiniteCanvasGroupChildren,
  findInfiniteCanvasGroupNode,
  getInfiniteCanvasGroupWindowIds,
  normalizeInfiniteCanvasGroupTree,
  reorderInfiniteCanvasGroupChild,
  setInfiniteCanvasGroupActiveChild,
  setInfiniteCanvasGroupChildWeights,
  setInfiniteCanvasGroupLayoutMode,
  undockInfiniteCanvasGroupWindow,
  type InfiniteCanvasGroupDockEdge,
  type InfiniteCanvasGroupLayoutMode,
  type InfiniteCanvasGroupNode,
} from "./group-tree";
import type {
  InfiniteCanvasDockPreview,
  InfiniteCanvasGroup,
  InfiniteCanvasPoint,
  InfiniteCanvasRect,
  InfiniteCanvasState,
} from "./types";

/**
 * Groups, projected onto canvas state.
 *
 * One rule governs this file: **the group is the source of truth, and a member
 * window's `rect` is its projection.** After every mutation that can move a
 * member — docking, undocking, retitling a tab as active, dragging a gutter,
 * moving the shell — `syncInfiniteCanvasGroupWindowRects` re-solves every group
 * and writes the result back onto `window.rect`.
 *
 * That is what keeps the rest of the framework group-blind. Snapping, selection
 * bounds, camera framing, the window layer, persistence, and the scene-layer
 * window proxies all read `window.rect` and none of them need to learn what a
 * group is. The alternative — teaching each of them to ask "are you grouped?" —
 * is how a window manager grows a dozen places that can disagree about where a
 * window actually is.
 *
 * A window hidden behind an inactive tab or a collapsed fold is still solved — it
 * takes the rect it would occupy if revealed. Nothing renders it, but a tear-out
 * frees it at its own size rather than swelling it to fill the shell, and
 * anything that unions window rects (fit-all, selection bounds) sees the truth
 * instead of a stale rect from before it was docked.
 */

const DEFAULT_INFINITE_CANVAS_GROUP_TITLE = "Group";

function findInfiniteCanvasGroup<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  groupId: string,
): InfiniteCanvasGroup | null {
  return state.groups.find((group) => group.id === groupId) ?? null;
}

/** The group holding `windowId`, or `null` when it floats free. */
function getInfiniteCanvasWindowGroup<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  windowId: string,
): InfiniteCanvasGroup | null {
  return (
    state.groups.find((group) => findInfiniteCanvasGroupNode(group.tree, windowId) !== null) ?? null
  );
}

function isInfiniteCanvasWindowGrouped<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  windowId: string,
): boolean {
  return getInfiniteCanvasWindowGroup(state, windowId) !== null;
}

/** Every window id claimed by any group, in group order. */
function getInfiniteCanvasGroupedWindowIds<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
): readonly string[] {
  return state.groups.flatMap((group) => getInfiniteCanvasGroupWindowIds(group.tree));
}

type InfiniteCanvasGroupProjection = Readonly<{
  /** Members with no rect: behind an inactive tab or a collapsed fold. */
  hiddenWindowIds: ReadonlySet<string>;
  windowRects: ReadonlyMap<string, InfiniteCanvasRect>;
}>;

const EMPTY_INFINITE_CANVAS_GROUP_PROJECTION: InfiniteCanvasGroupProjection = {
  hiddenWindowIds: new Set(),
  windowRects: new Map(),
};

/**
 * Solve every group and flatten the answer into a lookup.
 *
 * Takes `groups` rather than the whole state so a caller can memoize on exactly
 * what it reads — a camera tick must not re-solve a layout that cannot have
 * changed.
 */
function getInfiniteCanvasGroupProjection(
  groups: readonly InfiniteCanvasGroup[],
  metrics: InfiniteCanvasGroupMetrics = DEFAULT_INFINITE_CANVAS_GROUP_METRICS,
): InfiniteCanvasGroupProjection {
  if (groups.length === 0) {
    return EMPTY_INFINITE_CANVAS_GROUP_PROJECTION;
  }

  const hiddenWindowIds = new Set<string>();
  const windowRects = new Map<string, InfiniteCanvasRect>();

  for (const group of groups) {
    const layout = getInfiniteCanvasGroupLayout(group.tree, group.rect, metrics);

    for (const placement of layout.windows) {
      windowRects.set(placement.windowId, placement.rect);
    }

    // Hidden members carry the rect they would occupy if revealed, so a tear-out
    // frees them at their own size and anything unioning rects sees the truth.
    for (const placement of layout.hiddenWindows) {
      hiddenWindowIds.add(placement.windowId);
      windowRects.set(placement.windowId, placement.rect);
    }
  }

  return { hiddenWindowIds, windowRects };
}

/**
 * Re-project every group onto its members' rects. Every mutation in this file
 * ends here, so `window.rect` is never allowed to disagree with the tree.
 */
function syncInfiniteCanvasGroupWindowRects<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  metrics?: InfiniteCanvasGroupMetrics,
): InfiniteCanvasState<Kind> {
  if (state.groups.length === 0) {
    return state;
  }

  const { windowRects } = getInfiniteCanvasGroupProjection(state.groups, metrics);

  return {
    ...state,
    windows: state.windows.map((window) => {
      const rect = windowRects.get(window.id);

      return rect === undefined || isSameRect(window.rect, rect) ? window : { ...window, rect };
    }),
  };
}

function isSameRect(left: InfiniteCanvasRect, right: InfiniteCanvasRect): boolean {
  return (
    left.x === right.x &&
    left.y === right.y &&
    left.width === right.width &&
    left.height === right.height
  );
}

/** Replace one group, or drop it when its tree emptied out (DOCK-005). */
function withInfiniteCanvasGroupTree<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  groupId: string,
  tree: InfiniteCanvasGroupNode | null,
): InfiniteCanvasState<Kind> {
  const groups =
    tree === null
      ? state.groups.filter((group) => group.id !== groupId)
      : state.groups.map((group) => (group.id === groupId ? { ...group, tree } : group));

  return syncInfiniteCanvasGroupWindowRects({ ...state, groups });
}

function getNextInfiniteCanvasGroupZIndex<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
): number {
  return state.groups.reduce((highest, group) => Math.max(highest, group.zIndex + 1), 0);
}

/**
 * Build a group from floating windows. Members are laid out as one horizontal
 * split, in the order given, sharing the shell equally.
 *
 * Windows that are missing, minimized, or already inside another group are
 * dropped rather than stolen — a window lives in at most one tree, and grouping
 * is a user gesture, not a place to throw.
 */
function createInfiniteCanvasGroup<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  input: Readonly<{
    groupId: string;
    rect: InfiniteCanvasRect;
    title?: string;
    windowIds: readonly string[];
  }>,
): InfiniteCanvasState<Kind> {
  const { groupId, rect, title, windowIds } = input;

  if (findInfiniteCanvasGroup(state, groupId) !== null) {
    return state;
  }

  const members = windowIds.filter((windowId) => {
    const window = state.windows.find((candidate) => candidate.id === windowId);

    return (
      window !== undefined &&
      window.mode !== "minimized" &&
      !isInfiniteCanvasWindowGrouped(state, windowId)
    );
  });

  if (members.length === 0) {
    return state;
  }

  const [onlyMember] = members;
  const tree: InfiniteCanvasGroupNode =
    members.length === 1 && onlyMember !== undefined
      ? createInfiniteCanvasGroupWindowNode(onlyMember)
      : {
          activeChildId: null,
          axis: "horizontal",
          children: members.map((windowId) => createInfiniteCanvasGroupWindowNode(windowId)),
          id: groupId,
          kind: "container",
          layout: "split",
          weight: 1,
        };
  const normalized = normalizeInfiniteCanvasGroupTree(tree);

  if (normalized === null) {
    return state;
  }

  return syncInfiniteCanvasGroupWindowRects({
    ...state,
    groups: [
      ...state.groups,
      {
        id: groupId,
        rect,
        title: title ?? DEFAULT_INFINITE_CANVAS_GROUP_TITLE,
        tree: normalized,
        zIndex: getNextInfiniteCanvasGroupZIndex(state),
      },
    ],
  });
}

/**
 * Dissolve a group, leaving its members floating exactly where they were drawn.
 * Their rects are already the solved ones — that is the invariant — so there is
 * nothing to restore and nothing jumps.
 */
function closeInfiniteCanvasGroup<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  groupId: string,
): InfiniteCanvasState<Kind> {
  if (findInfiniteCanvasGroup(state, groupId) === null) {
    return state;
  }

  return { ...state, groups: state.groups.filter((group) => group.id !== groupId) };
}

/** Move or resize a shell. Its members follow, because they are re-solved. */
function setInfiniteCanvasGroupRect<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  input: Readonly<{ groupId: string; rect: InfiniteCanvasRect }>,
): InfiniteCanvasState<Kind> {
  const { groupId, rect } = input;

  if (findInfiniteCanvasGroup(state, groupId) === null) {
    return state;
  }

  return syncInfiniteCanvasGroupWindowRects({
    ...state,
    groups: state.groups.map((group) => (group.id === groupId ? { ...group, rect } : group)),
  });
}

function dockInfiniteCanvasWindowIntoGroup<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  input: Readonly<{
    containerId: string;
    edge: InfiniteCanvasGroupDockEdge;
    groupId: string;
    targetId: string;
    windowId: string;
  }>,
): InfiniteCanvasState<Kind> {
  const { containerId, edge, groupId, targetId, windowId } = input;
  const group = findInfiniteCanvasGroup(state, groupId);
  const window = state.windows.find((candidate) => candidate.id === windowId);

  if (
    group === null ||
    window === undefined ||
    window.mode === "minimized" ||
    isInfiniteCanvasWindowGrouped(state, windowId)
  ) {
    return state;
  }

  return withInfiniteCanvasGroupTree(
    state,
    groupId,
    dockInfiniteCanvasGroupWindow(group.tree, { containerId, edge, targetId, windowId }),
  );
}

/**
 * Tear a window out of whatever group holds it. It lands on `rect`, or — with no
 * rect supplied — stays exactly where it was drawn, which is what a tear-out
 * gesture wants: the window does not jump before the user starts dragging it.
 *
 * Removing the last member destroys the shell.
 */
function undockInfiniteCanvasWindowFromGroup<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  input: Readonly<{ rect?: InfiniteCanvasRect; windowId: string }>,
): InfiniteCanvasState<Kind> {
  const { rect, windowId } = input;
  const group = getInfiniteCanvasWindowGroup(state, windowId);

  if (group === null) {
    return state;
  }

  const detached = withInfiniteCanvasGroupTree(
    state,
    group.id,
    undockInfiniteCanvasGroupWindow(group.tree, windowId),
  );

  if (rect === undefined) {
    return detached;
  }

  return {
    ...detached,
    windows: detached.windows.map((window) =>
      window.id === windowId ? { ...window, rect } : window,
    ),
  };
}

/**
 * Drop a window out of every group that claims it, without giving it a rect.
 * Closing and minimizing both need this: a window that is gone, or collapsed to
 * the dock, cannot keep occupying a layout slot.
 */
function detachInfiniteCanvasWindowFromGroups<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  windowId: string,
): InfiniteCanvasState<Kind> {
  const group = getInfiniteCanvasWindowGroup(state, windowId);

  if (group === null) {
    return state;
  }

  return withInfiniteCanvasGroupTree(
    state,
    group.id,
    undockInfiniteCanvasGroupWindow(group.tree, windowId),
  );
}

function setInfiniteCanvasGroupActiveChildInState<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  input: Readonly<{ childId: string; containerId: string; groupId: string }>,
): InfiniteCanvasState<Kind> {
  const group = findInfiniteCanvasGroup(state, input.groupId);

  if (group === null) {
    return state;
  }

  return withInfiniteCanvasGroupTree(
    state,
    group.id,
    setInfiniteCanvasGroupActiveChild(group.tree, {
      childId: input.childId,
      containerId: input.containerId,
    }),
  );
}

function setInfiniteCanvasGroupLayoutModeInState<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  input: Readonly<{
    containerId: string;
    groupId: string;
    layout: InfiniteCanvasGroupLayoutMode;
  }>,
): InfiniteCanvasState<Kind> {
  const group = findInfiniteCanvasGroup(state, input.groupId);

  if (group === null) {
    return state;
  }

  return withInfiniteCanvasGroupTree(
    state,
    group.id,
    setInfiniteCanvasGroupLayoutMode(group.tree, {
      containerId: input.containerId,
      layout: input.layout,
    }),
  );
}

function equalizeInfiniteCanvasGroupChildrenInState<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  input: Readonly<{ containerId: string; groupId: string }>,
): InfiniteCanvasState<Kind> {
  const group = findInfiniteCanvasGroup(state, input.groupId);

  if (group === null) {
    return state;
  }

  return withInfiniteCanvasGroupTree(
    state,
    group.id,
    equalizeInfiniteCanvasGroupChildren(group.tree, input.containerId),
  );
}

function setInfiniteCanvasGroupChildWeightsInState<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  input: Readonly<{
    containerId: string;
    groupId: string;
    weights: Readonly<Record<string, number>>;
  }>,
): InfiniteCanvasState<Kind> {
  const group = findInfiniteCanvasGroup(state, input.groupId);

  if (group === null) {
    return state;
  }

  return withInfiniteCanvasGroupTree(
    state,
    group.id,
    setInfiniteCanvasGroupChildWeights(group.tree, {
      containerId: input.containerId,
      weights: input.weights,
    }),
  );
}

function reorderInfiniteCanvasGroupChildInState<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  input: Readonly<{ childId: string; groupId: string; toIndex: number }>,
): InfiniteCanvasState<Kind> {
  const group = findInfiniteCanvasGroup(state, input.groupId);

  if (group === null) {
    return state;
  }

  return withInfiniteCanvasGroupTree(
    state,
    group.id,
    reorderInfiniteCanvasGroupChild(group.tree, {
      childId: input.childId,
      toIndex: input.toIndex,
    }),
  );
}

/**
 * Drop group members that no longer name a live, non-minimized window, and drop
 * groups that empty out. Hydration and registry normalization both need this:
 * a persisted tree can name a window whose `kind` was since removed from the
 * registry, and a tree that outlives its windows would lay out ghosts.
 */
function reconcileInfiniteCanvasGroups<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
): InfiniteCanvasState<Kind> {
  if (state.groups.length === 0) {
    return state;
  }

  const liveWindowIds = new Set(
    state.windows.filter((window) => window.mode !== "minimized").map((window) => window.id),
  );
  const groups: InfiniteCanvasGroup[] = [];
  const claimedWindowIds = new Set<string>();

  for (const group of state.groups) {
    let tree: InfiniteCanvasGroupNode | null = group.tree;

    for (const windowId of getInfiniteCanvasGroupWindowIds(group.tree)) {
      // A window may be claimed by only one tree; the first group to name it wins.
      const isClaimable = liveWindowIds.has(windowId) && !claimedWindowIds.has(windowId);

      if (isClaimable) {
        claimedWindowIds.add(windowId);
        continue;
      }

      tree = tree === null ? null : undockInfiniteCanvasGroupWindow(tree, windowId);
    }

    if (tree !== null) {
      groups.push({ ...group, tree });
    }
  }

  return syncInfiniteCanvasGroupWindowRects({ ...state, groups });
}

/**
 * Docking, resolved from the canonical model.
 *
 * A drop target is found by asking the group solver where its members are and
 * the window list where the floating ones are — never by hit-testing the DOM. A
 * target read from `getBoundingClientRect` would disagree with the tree the
 * moment a transform, a scroll, or a zoom got involved, and the user would drop
 * a window somewhere other than where the overlay promised.
 */

/**
 * Container and group ids are derived from the target rather than generated, so
 * the operation stays pure and an undo replay rebuilds the identical tree. Two
 * live containers can never share an id: a container is named for the node it
 * wraps and the edge it wraps it on, and node ids are window ids, which are
 * unique across the canvas.
 */
function getInfiniteCanvasDockContainerId(targetId: string, edge: string): string {
  return `${targetId}::${edge}`;
}

function getInfiniteCanvasDockGroupId(targetWindowId: string): string {
  return `${targetWindowId}::group`;
}

/** The region a drop would fill: half the target on that edge, or all of it for a tab merge. */
function getInfiniteCanvasDockRegionRect(
  rect: InfiniteCanvasRect,
  edge: InfiniteCanvasGroupDockEdge,
): InfiniteCanvasRect {
  const halfWidth = rect.width / 2;
  const halfHeight = rect.height / 2;

  switch (edge) {
    case "center":
      return rect;
    case "east":
      return { height: rect.height, width: halfWidth, x: rect.x + halfWidth, y: rect.y };
    case "north":
      return { height: halfHeight, width: rect.width, x: rect.x, y: rect.y };
    case "south":
      return { height: halfHeight, width: rect.width, x: rect.x, y: rect.y + halfHeight };
    case "west":
      return { height: rect.height, width: halfWidth, x: rect.x, y: rect.y };
  }
}

function rectContainsPoint(rect: InfiniteCanvasRect, point: InfiniteCanvasPoint): boolean {
  return (
    point.x >= rect.x &&
    point.y >= rect.y &&
    point.x <= rect.x + rect.width &&
    point.y <= rect.y + rect.height
  );
}

/**
 * Where a window would land if the drag ended now, or `null` over empty canvas.
 *
 * Groups are searched before floating windows, and both topmost-first, so the
 * answer matches what the user sees stacked under the cursor. The dragged window
 * and anything already grouped are never targets.
 */
function resolveInfiniteCanvasDockPreview<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  worldPoint: InfiniteCanvasPoint,
  draggedWindowId: string,
  metrics: InfiniteCanvasGroupMetrics = DEFAULT_INFINITE_CANVAS_GROUP_METRICS,
): InfiniteCanvasDockPreview | null {
  if (isInfiniteCanvasWindowGrouped(state, draggedWindowId)) {
    return null;
  }

  const groupsByDepth = [...state.groups].sort((left, right) => right.zIndex - left.zIndex);

  for (const group of groupsByDepth) {
    const layout = getInfiniteCanvasGroupLayout(group.tree, group.rect, metrics);

    for (const placement of layout.windows) {
      if (!rectContainsPoint(placement.rect, worldPoint)) {
        continue;
      }

      const edge = getInfiniteCanvasGroupDockEdgeAtPoint(placement.rect, worldPoint);

      return {
        containerId: getInfiniteCanvasDockContainerId(placement.windowId, edge),
        edge,
        groupId: group.id,
        rect: getInfiniteCanvasDockRegionRect(placement.rect, edge),
        targetId: placement.windowId,
        windowId: draggedWindowId,
      };
    }
  }

  const floatingByDepth = [...state.windows]
    .filter(
      (window) =>
        window.id !== draggedWindowId &&
        window.mode !== "minimized" &&
        !isInfiniteCanvasWindowGrouped(state, window.id),
    )
    .sort((left, right) => right.zIndex - left.zIndex);

  for (const window of floatingByDepth) {
    if (!rectContainsPoint(window.rect, worldPoint)) {
      continue;
    }

    const edge = getInfiniteCanvasGroupDockEdgeAtPoint(window.rect, worldPoint);

    return {
      containerId: getInfiniteCanvasDockContainerId(window.id, edge),
      edge,
      groupId: null,
      rect: getInfiniteCanvasDockRegionRect(window.rect, edge),
      targetId: window.id,
      windowId: draggedWindowId,
    };
  }

  return null;
}

/**
 * The same preview, resolved from a named target rather than from a pointer.
 *
 * Docking was pointer-only until 2026-08-12: `resolveInfiniteCanvasDockPreview` reads a
 * world point, so the whole group model — the library's largest feature — was unreachable
 * without a mouse. This is the second targeting policy, and it deliberately produces the
 * *same* `InfiniteCanvasDockPreview` so both gestures commit through
 * `applyInfiniteCanvasDockPreview`. A keyboard dock and a dropped drag are then the same
 * operation by construction, rather than two implementations that have to be kept agreeing.
 *
 * The caller supplies the edge, because the two policies derive it differently: a drag
 * reads which half of the target the pointer is over, while a keyboard gesture takes the
 * side the window arrives from.
 */
function resolveInfiniteCanvasDockPreviewForTarget<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  input: Readonly<{
    edge: InfiniteCanvasGroupDockEdge;
    targetId: string;
    windowId: string;
  }>,
  metrics: InfiniteCanvasGroupMetrics = DEFAULT_INFINITE_CANVAS_GROUP_METRICS,
): InfiniteCanvasDockPreview | null {
  const { edge, targetId, windowId } = input;

  // A window already in a tree is moved by reordering or by tearing out, never by docking
  // it somewhere else — the same refusal the pointer path makes.
  if (targetId === windowId || isInfiniteCanvasWindowGrouped(state, windowId)) {
    return null;
  }

  const group = getInfiniteCanvasWindowGroup(state, targetId);
  const target = state.windows.find((window) => window.id === targetId);

  if (target === undefined || target.mode === "minimized") {
    return null;
  }

  // A grouped target's own `rect` is a projection and may lag its tree; the solver is the
  // authority, exactly as it is for the pointer path.
  const targetRect =
    group === null
      ? target.rect
      : (getInfiniteCanvasGroupProjection([group], metrics).windowRects.get(targetId) ??
        target.rect);

  return {
    containerId: getInfiniteCanvasDockContainerId(targetId, edge),
    edge,
    groupId: group?.id ?? null,
    rect: getInfiniteCanvasDockRegionRect(targetRect, edge),
    targetId,
    windowId,
  };
}

/**
 * Commit a resolved preview. Docking onto a floating window first wraps that
 * window in a group occupying exactly the rect it already had, then docks the
 * dragged window against it — so the pair lands where the target was standing
 * and nothing else on the canvas shifts (DOCK-001).
 */
function applyInfiniteCanvasDockPreview<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  preview: InfiniteCanvasDockPreview,
): InfiniteCanvasState<Kind> {
  if (preview.groupId !== null) {
    return dockInfiniteCanvasWindowIntoGroup(state, {
      containerId: preview.containerId,
      edge: preview.edge,
      groupId: preview.groupId,
      targetId: preview.targetId,
      windowId: preview.windowId,
    });
  }

  const target = state.windows.find((window) => window.id === preview.targetId);

  if (target === undefined) {
    return state;
  }

  const groupId = getInfiniteCanvasDockGroupId(target.id);
  const seeded = createInfiniteCanvasGroup(state, {
    groupId,
    rect: target.rect,
    title: target.title,
    windowIds: [target.id],
  });

  return dockInfiniteCanvasWindowIntoGroup(seeded, {
    containerId: preview.containerId,
    edge: preview.edge,
    groupId,
    targetId: preview.targetId,
    windowId: preview.windowId,
  });
}

export {
  DEFAULT_INFINITE_CANVAS_GROUP_TITLE,
  applyInfiniteCanvasDockPreview,
  closeInfiniteCanvasGroup,
  createInfiniteCanvasGroup,
  detachInfiniteCanvasWindowFromGroups,
  dockInfiniteCanvasWindowIntoGroup,
  equalizeInfiniteCanvasGroupChildrenInState,
  findInfiniteCanvasGroup,
  getInfiniteCanvasGroupProjection,
  getInfiniteCanvasGroupedWindowIds,
  getInfiniteCanvasWindowGroup,
  isInfiniteCanvasWindowGrouped,
  reconcileInfiniteCanvasGroups,
  reorderInfiniteCanvasGroupChildInState,
  resolveInfiniteCanvasDockPreview,
  resolveInfiniteCanvasDockPreviewForTarget,
  setInfiniteCanvasGroupActiveChildInState,
  setInfiniteCanvasGroupChildWeightsInState,
  setInfiniteCanvasGroupLayoutModeInState,
  setInfiniteCanvasGroupRect,
  syncInfiniteCanvasGroupWindowRects,
  undockInfiniteCanvasWindowFromGroup,
};
export type { InfiniteCanvasGroupProjection };
