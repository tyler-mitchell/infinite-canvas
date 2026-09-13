import {
  applyPositionConstraints,
  applySizeConstraints,
  calcGridItemPosition,
  calcWHRaw,
  calcXY,
  calcXYRaw,
  defaultConstraints,
  getAllCollisions,
  moveElement,
  resizeItemInDirection,
  type ResizeHandleAxis,
} from "react-grid-layout/core";

import { rectContainsPoint, rectsEqual } from "./geometry";
import { updateWindowRect } from "./stacking";
import { getInfiniteCanvasVacantRect } from "./window-placement";
import {
  DEFAULT_INFINITE_CANVAS_GROUP_METRICS,
  getInfiniteCanvasGroupDockEdgeAtPoint,
  getInfiniteCanvasGroupLayout,
  getInfiniteCanvasMasonryCompactor,
  getInfiniteCanvasMasonryConstraintContext,
  getInfiniteCanvasMasonryItems,
  getInfiniteCanvasMasonryParams,
} from "./group-layout";
import {
  createInfiniteCanvasGroupWindowNode,
  dockInfiniteCanvasGroupWindow,
  equalizeInfiniteCanvasGroupChildren,
  findInfiniteCanvasGroupNode,
  getInfiniteCanvasGroupParent,
  getInfiniteCanvasGroupWindowIds,
  isInfiniteCanvasGroupContainer,
  normalizeInfiniteCanvasGroupTree,
  reorderInfiniteCanvasGroupChild,
  setInfiniteCanvasGroupActiveChild,
  setInfiniteCanvasGroupAxis,
  setInfiniteCanvasGroupChildWeights,
  setInfiniteCanvasGroupLayoutMode,
  setInfiniteCanvasGroupWindowNodeLayouts,
  undockInfiniteCanvasGroupWindow,
  type InfiniteCanvasGroupAxis,
  type InfiniteCanvasGroupContainerNode,
  type InfiniteCanvasGroupWindowNodeLayout,
  type InfiniteCanvasGroupDockEdge,
  type InfiniteCanvasGroupLayoutMode,
  type InfiniteCanvasGroupNode,
} from "./group-tree";
import type {
  InfiniteCanvasDockPreview,
  InfiniteCanvasGroup,
  InfiniteCanvasGroupMetrics,
  InfiniteCanvasPoint,
  InfiniteCanvasRect,
  InfiniteCanvasResizeHandle,
  InfiniteCanvasState,
  InfiniteCanvasWindow,
} from "./types";

/** Projects group layout onto member window rects after each group mutation. */

const DEFAULT_INFINITE_CANVAS_GROUP_TITLE = "Group";

function findInfiniteCanvasGroup<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  groupId: string,
): InfiniteCanvasGroup | null {
  return state.groups.find((group) => group.id === groupId) ?? null;
}

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

function getInfiniteCanvasGroupedWindowIds<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
): readonly string[] {
  return state.groups.flatMap((group) => getInfiniteCanvasGroupWindowIds(group.tree));
}

type InfiniteCanvasGroupProjection = Readonly<{
  /** Shell rects of masonry groups, which are as tall as their packed rows. */
  groupRects: ReadonlyMap<string, InfiniteCanvasRect>;
  /** Member ids that the current layout does not draw. */
  hiddenWindowIds: ReadonlySet<string>;
  windowRects: ReadonlyMap<string, InfiniteCanvasRect>;
}>;

const EMPTY_INFINITE_CANVAS_GROUP_PROJECTION: InfiniteCanvasGroupProjection = {
  groupRects: new Map(),
  hiddenWindowIds: new Set(),
  windowRects: new Map(),
};

/** Builds a group projection lookup without reading unrelated canvas state. */
function getInfiniteCanvasGroupProjection(
  groups: readonly InfiniteCanvasGroup[],
  metrics: InfiniteCanvasGroupMetrics = DEFAULT_INFINITE_CANVAS_GROUP_METRICS,
): InfiniteCanvasGroupProjection {
  if (groups.length === 0) {
    return EMPTY_INFINITE_CANVAS_GROUP_PROJECTION;
  }

  const groupRects = new Map<string, InfiniteCanvasRect>();
  const hiddenWindowIds = new Set<string>();
  const windowRects = new Map<string, InfiniteCanvasRect>();

  for (const group of groups) {
    const layout = getInfiniteCanvasGroupLayout(group.tree, group.rect, metrics);
    const extent = layout.masonryExtents.get(group.tree.id);

    if (extent !== undefined) {
      groupRects.set(group.id, { ...group.rect, height: extent });
    }

    for (const placement of layout.windows) {
      windowRects.set(placement.windowId, placement.rect);
    }

    // Hidden members keep their revealed rect so tear-out preserves their size.
    for (const placement of layout.hiddenWindows) {
      hiddenWindowIds.add(placement.windowId);
      windowRects.set(placement.windowId, placement.rect);
    }
  }

  return { groupRects, hiddenWindowIds, windowRects };
}

/** The masonry container that holds a window as a direct member, or null. */
function getInfiniteCanvasMasonryMembership<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  windowId: string,
): Readonly<{ container: InfiniteCanvasGroupContainerNode; group: InfiniteCanvasGroup }> | null {
  const group = getInfiniteCanvasWindowGroup(state, windowId);
  const container = group === null ? null : getInfiniteCanvasGroupParent(group.tree, windowId);

  return group === null || container === null || container.layout !== "masonry"
    ? null
    : { container, group };
}

/** Projects group rectangles while preserving the dragged masonry member's pointer position. */
function syncInfiniteCanvasGroupWindowRects<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
): InfiniteCanvasState<Kind> {
  if (state.groups.length === 0) {
    return state;
  }

  const { groupRects, windowRects } = getInfiniteCanvasGroupProjection(
    state.groups,
    state.groupMetrics,
  );
  const draggedWindowId =
    state.interaction?.kind === "move" &&
    getInfiniteCanvasMasonryMembership(state, state.interaction.windowId) !== null
      ? state.interaction.windowId
      : null;

  return {
    ...state,
    groups: state.groups.map((group) => {
      const rect = groupRects.get(group.id);

      return rect === undefined || rectsEqual(group.rect, rect) ? group : { ...group, rect };
    }),
    windows: state.windows.map((window) => {
      const rect = windowRects.get(window.id);

      // An absent rect means this window is not a group member, so it keeps its own.
      return rect === undefined || window.id === draggedWindowId || rectsEqual(window.rect, rect)
        ? window
        : { ...window, rect };
    }),
  };
}

/** A masonry member's lattice, in the grid library's terms, or null when it is on none. */
function getInfiniteCanvasMasonryGrid<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  windowId: string,
) {
  const membership = getInfiniteCanvasMasonryMembership(state, windowId);

  if (membership === null) {
    return null;
  }

  const { container, group } = membership;
  const rect =
    container === group.tree
      ? group.rect
      : getInfiniteCanvasGroupLayout(group.tree, group.rect, state.groupMetrics).containerRects.get(
          container.id,
        );
  if (rect === undefined) return null;
  const params = getInfiniteCanvasMasonryParams(container, rect);
  const layout = getInfiniteCanvasMasonryItems(container, params.cols);
  const item = layout.find((candidate) => candidate.i === windowId);

  return item === undefined
    ? null
    : {
        compactor: getInfiniteCanvasMasonryCompactor(container),
        group,
        item,
        layout,
        params,
        rect,
      };
}

export function setInfiniteCanvasWindowContentHeight<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  input: Readonly<{ windowId: string; height: number }>,
): InfiniteCanvasState<Kind> {
  const window = state.windows.find((item) => item.id === input.windowId);
  if (
    window === undefined ||
    window.heightMode === "manual" ||
    !Number.isFinite(input.height) ||
    input.height <= 0
  )
    return state;
  const grid = getInfiniteCanvasMasonryGrid(state, input.windowId);
  if (grid !== null) {
    const rows = Math.max(
      1,
      Math.ceil(
        (input.height + grid.params.margin[1]) / (grid.params.rowHeight + grid.params.margin[1]),
      ),
    );
    if (grid.item.h === rows) return state;
    return setInfiniteCanvasGroupWindowNodeLayoutsInState(state, {
      groupId: grid.group.id,
      layouts: { [input.windowId]: { rows } },
    });
  }
  if (
    isInfiniteCanvasWindowGrouped(state, input.windowId) ||
    Math.abs(window.rect.height - input.height) < 1
  )
    return state;
  return updateWindowRect(state, input.windowId, { ...window.rect, height: input.height });
}

/** Applies the grid library's position constraints and compaction to a dragged member. */
function moveInfiniteCanvasMasonryMember<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  windowId: string,
): InfiniteCanvasState<Kind> {
  const grid = getInfiniteCanvasMasonryGrid(state, windowId);
  const window = state.windows.find((candidate) => candidate.id === windowId);

  if (grid === null || window === undefined) {
    return state;
  }

  const { compactor, group, item, layout, params, rect } = grid;
  const raw = calcXYRaw(params, window.rect.y - rect.y, window.rect.x - rect.x);
  const { x, y } = applyPositionConstraints(
    defaultConstraints,
    item,
    raw.x,
    raw.y,
    getInfiniteCanvasMasonryConstraintContext(params, layout),
  );
  const moved = compactor.compact(
    moveElement(
      layout,
      item,
      x,
      y,
      true,
      compactor.preventCollision,
      compactor.type,
      params.cols,
      compactor.allowOverlap,
    ),
    params.cols,
  );

  return setInfiniteCanvasGroupWindowNodeLayoutsInState(state, {
    groupId: group.id,
    layouts: Object.fromEntries(moved.map((cells) => [cells.i, { x: cells.x, y: cells.y }])),
  });
}

/** Returns a survivor only when this operation reduced a multi-member group. */
function getInfiniteCanvasDecayedGroupMemberId(
  group: InfiniteCanvasGroup,
  tree: InfiniteCanvasGroupNode | null,
): string | null {
  if (tree === null || isInfiniteCanvasGroupContainer(tree)) {
    return null;
  }

  return getInfiniteCanvasGroupWindowIds(group.tree).length > 1 ? tree.id : null;
}

/** Replaces one group, or removes it when its tree is empty (DOCK-005). */
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

/** Gives the survivor the shell rect after a multi-member group decays. */
function dissolveInfiniteCanvasDecayedGroup<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  group: InfiniteCanvasGroup,
  memberId: string,
): InfiniteCanvasState<Kind> {
  return syncInfiniteCanvasGroupWindowRects({
    ...state,
    groups: state.groups.filter((candidate) => candidate.id !== group.id),
    windows: state.windows.map((window) =>
      window.id === memberId ? { ...window, rect: group.rect } : window,
    ),
  });
}

function getNextInfiniteCanvasGroupZIndex<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
): number {
  return state.groups.reduce((highest, group) => Math.max(highest, group.zIndex + 1), 0);
}

function getInfiniteCanvasGroupMemberTitle(titles: readonly string[]): string {
  const [first, second] = titles;

  if (first === undefined) {
    return DEFAULT_INFINITE_CANVAS_GROUP_TITLE;
  }

  if (second === undefined) {
    return first;
  }

  return titles.length === 2 ? `${first} & ${second}` : `${first} and ${titles.length - 1} more`;
}

/** A null title derives from current member titles. An empty title stays empty. */
function getInfiniteCanvasGroupTitle<Kind extends string>(
  group: InfiniteCanvasGroup,
  windows: readonly InfiniteCanvasWindow<Kind>[],
): string {
  if (group.title !== null) {
    return group.title;
  }

  return getInfiniteCanvasGroupMemberTitle(
    getInfiniteCanvasGroupWindowIds(group.tree).map(
      (windowId) =>
        windows.find((window) => window.id === windowId)?.title ??
        DEFAULT_INFINITE_CANVAS_GROUP_TITLE,
    ),
  );
}

function getInfiniteCanvasGroupableWindowIds<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  windowIds: readonly string[],
): readonly string[] {
  return windowIds.filter((windowId) => {
    const window = state.windows.find((candidate) => candidate.id === windowId);

    return (
      window !== undefined &&
      window.mode !== "minimized" &&
      !isInfiniteCanvasWindowGrouped(state, windowId)
    );
  });
}

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

  const members = getInfiniteCanvasGroupableWindowIds(state, windowIds);

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
        // `null` rather than a snapshot of the members' names: a group nobody named is named after
        // what is in it, and `getInfiniteCanvasGroupTitle` answers that from current membership so
        // the name follows a rename or a departure instead of going stale the moment it is written.
        title: title ?? null,
        tree: normalized,
        zIndex: getNextInfiniteCanvasGroupZIndex(state),
      },
    ],
  });
}

function renameInfiniteCanvasGroup<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  input: Readonly<{ groupId: string; title: string }>,
): InfiniteCanvasState<Kind> {
  const title = input.title.trim();
  const target = findInfiniteCanvasGroup(state, input.groupId);

  if (title === "" || target === null || target.title === title) {
    return state;
  }

  return {
    ...state,
    groups: state.groups.map((group) => (group.id === input.groupId ? { ...group, title } : group)),
  };
}

/** Bounds released members around the shell, not the viewport. */
function getInfiniteCanvasRoomAround(shell: InfiniteCanvasRect): InfiniteCanvasRect {
  return {
    height: shell.height * 3,
    width: shell.width * 3,
    x: shell.x - shell.width,
    y: shell.y - shell.height,
  };
}

/** Vacancy placement separates tab members that share one rect. */
function closeInfiniteCanvasGroup<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  groupId: string,
): InfiniteCanvasState<Kind> {
  const group = findInfiniteCanvasGroup(state, groupId);

  if (group === null) {
    return state;
  }

  const bounds = getInfiniteCanvasRoomAround(group.rect);
  const freedIds = new Set(getInfiniteCanvasGroupWindowIds(group.tree));
  const dissolved = { ...state, groups: state.groups.filter((entry) => entry.id !== groupId) };
  // Only the first released member can reuse the shell rect.
  const settled: InfiniteCanvasRect[] = dissolved.windows
    .filter((window) => !freedIds.has(window.id) && window.mode !== "minimized")
    .map((window) => window.rect);

  return {
    ...dissolved,
    windows: dissolved.windows.map((window) => {
      if (!freedIds.has(window.id)) {
        return window;
      }

      const rect = getInfiniteCanvasVacantRect({
        bounds,
        occupied: settled,
        preferred: window.rect,
      });

      settled.push(rect);

      return { ...window, rect };
    }),
  };
}

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

/** Uses the drawn rect unless the tear-out gesture supplies a new rect. */
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

/** Dissolves a multi-member group that loses all but one member. */
function detachInfiniteCanvasWindowFromGroups<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  windowId: string,
): InfiniteCanvasState<Kind> {
  const group = getInfiniteCanvasWindowGroup(state, windowId);

  if (group === null) {
    return state;
  }

  const tree = undockInfiniteCanvasGroupWindow(group.tree, windowId);
  const decayedMemberId = getInfiniteCanvasDecayedGroupMemberId(group, tree);

  return decayedMemberId === null
    ? withInfiniteCanvasGroupTree(state, group.id, tree)
    : dissolveInfiniteCanvasDecayedGroup(state, group, decayedMemberId);
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

function setInfiniteCanvasGroupAxisInState<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  input: Readonly<{ axis: InfiniteCanvasGroupAxis; containerId: string; groupId: string }>,
): InfiniteCanvasState<Kind> {
  const group = findInfiniteCanvasGroup(state, input.groupId);

  if (group === null) {
    return state;
  }

  return withInfiniteCanvasGroupTree(
    state,
    group.id,
    setInfiniteCanvasGroupAxis(group.tree, { axis: input.axis, containerId: input.containerId }),
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

function setInfiniteCanvasGroupWindowNodeLayoutsInState<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  input: Readonly<{
    groupId: string;
    layouts: Readonly<Record<string, InfiniteCanvasGroupWindowNodeLayout>>;
  }>,
): InfiniteCanvasState<Kind> {
  const group = findInfiniteCanvasGroup(state, input.groupId);
  if (group === null) return state;
  const tree = setInfiniteCanvasGroupWindowNodeLayouts(group.tree, input.layouts);
  return tree === group.tree ? state : withInfiniteCanvasGroupTree(state, group.id, tree);
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

/** Removes invalid or duplicate members and empty groups. */
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
  // A survivor inherits the rect of its removed group.
  const freedRects = new Map<string, InfiniteCanvasRect>();

  for (const group of state.groups) {
    let tree: InfiniteCanvasGroupNode | null = group.tree;

    for (const windowId of getInfiniteCanvasGroupWindowIds(group.tree)) {
      // The first group keeps a duplicate member claim.
      const isClaimable = liveWindowIds.has(windowId) && !claimedWindowIds.has(windowId);

      if (isClaimable) {
        claimedWindowIds.add(windowId);
        continue;
      }

      tree = tree === null ? null : undockInfiniteCanvasGroupWindow(tree, windowId);
    }

    // Only groups that lose members in this pass can decay. Existing one-member groups stay.
    const decayedMemberId = getInfiniteCanvasDecayedGroupMemberId(group, tree);

    if (decayedMemberId !== null) {
      freedRects.set(decayedMemberId, group.rect);
      continue;
    }

    if (tree !== null) {
      groups.push({ ...group, tree });
    }
  }

  return syncInfiniteCanvasGroupWindowRects({
    ...state,
    groups,
    windows: state.windows.map((window) => {
      const rect = freedRects.get(window.id);

      return rect === undefined ? window : { ...window, rect };
    }),
  });
}

/** Stable IDs make docking deterministic for undo replay. */
function getInfiniteCanvasDockContainerId(targetId: string, edge: string): string {
  return `${targetId}::${edge}`;
}

function getInfiniteCanvasDockGroupId(targetWindowId: string): string {
  return `${targetWindowId}::group`;
}

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

/** Finds the topmost valid dock target and returns its preview. */
function resolveInfiniteCanvasDockPreview<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  worldPoint: InfiniteCanvasPoint,
  draggedWindowId: string,
): InfiniteCanvasDockPreview | null {
  if (isInfiniteCanvasWindowGrouped(state, draggedWindowId)) {
    return null;
  }

  // A lattice takes the drop as cells, not as a split beside one of its members.
  const lattice = resolveInfiniteCanvasLatticeDropPreview(state, worldPoint, draggedWindowId);

  if (lattice !== null) {
    return lattice;
  }

  const groupsByDepth = [...state.groups].sort((left, right) => right.zIndex - left.zIndex);

  for (const group of groupsByDepth) {
    const layout = getInfiniteCanvasGroupLayout(group.tree, group.rect, state.groupMetrics);

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

/** Builds the same dock preview for a named target and edge. */
function resolveInfiniteCanvasDockPreviewForTarget<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  input: Readonly<{
    edge: InfiniteCanvasGroupDockEdge;
    targetId: string;
    windowId: string;
  }>,
): InfiniteCanvasDockPreview | null {
  const { edge, targetId, windowId } = input;

  // Grouped windows move through reorder or tear-out operations.
  if (targetId === windowId || isInfiniteCanvasWindowGrouped(state, windowId)) {
    return null;
  }

  const group = getInfiniteCanvasWindowGroup(state, targetId);
  const target = state.windows.find((window) => window.id === targetId);

  if (target === undefined || target.mode === "minimized") {
    return null;
  }

  // The group layout is the authority for a grouped target rect.
  const targetRect =
    group === null
      ? target.rect
      : (getInfiniteCanvasGroupProjection([group], state.groupMetrics).windowRects.get(targetId) ??
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

/** Applies grid constraints and collision policy before resizing a member. */
function resizeInfiniteCanvasMasonryMember<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  windowId: string,
  rect: InfiniteCanvasRect,
  handle: ResizeHandleAxis,
): InfiniteCanvasState<Kind> {
  const grid = getInfiniteCanvasMasonryGrid(state, windowId);

  if (grid === null) {
    return state;
  }

  const { compactor, group, item, layout: currentLayout, params } = grid;
  const { cols } = params;
  const compactType = compactor.type;
  const allowOverlap = compactor.allowOverlap;
  const preventCollision = compactor.preventCollision ?? false;

  const position = calcGridItemPosition(params, item.x, item.y, item.w, item.h);
  const updatedSize = resizeItemInDirection(
    handle,
    position,
    { ...position, height: rect.height, width: rect.width },
    params.containerWidth,
  );
  const rawSize = calcWHRaw(params, updatedSize.width, updatedSize.height);
  const { w: newW, h: newH } = applySizeConstraints(
    defaultConstraints,
    item,
    rawSize.w,
    rawSize.h,
    handle,
    getInfiniteCanvasMasonryConstraintContext(params, currentLayout),
  );

  const rawX = handle.includes("w") ? item.x + item.w - newW : item.x;
  const rawY = handle.includes("n") ? item.y + item.h - newH : item.y;
  const x = Math.max(0, rawX);
  const y = Math.max(0, rawY);
  const resized = { ...item, w: rawX < 0 ? item.w : newW, h: rawY < 0 ? item.h : newH };
  if (
    preventCollision &&
    !allowOverlap &&
    getAllCollisions(currentLayout, { ...resized, x, y }).some(
      (candidate) => candidate.i !== windowId,
    )
  )
    return state;
  const layout = currentLayout.map((candidate) => (candidate.i === windowId ? resized : candidate));
  const finalLayout =
    x === item.x && y === item.y
      ? layout
      : moveElement(layout, resized, x, y, true, preventCollision, compactType, cols, allowOverlap);

  return setInfiniteCanvasGroupWindowNodeLayoutsInState(state, {
    groupId: group.id,
    layouts: Object.fromEntries(
      compactor
        .compact(finalLayout, cols)
        .map((cells) => [cells.i, { rows: cells.h, span: cells.w, x: cells.x, y: cells.y }]),
    ),
  });
}

/** The grid library's name for a resize handle. */
const MASONRY_RESIZE_HANDLE_AXIS: Record<InfiniteCanvasResizeHandle, ResizeHandleAxis> = {
  east: "e",
  north: "n",
  "north-east": "ne",
  "north-west": "nw",
  south: "s",
  "south-east": "se",
  "south-west": "sw",
  west: "w",
};

/** Projects a floating window into the grid under the pointer. */
function resolveInfiniteCanvasLatticeDropPreview<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  worldPoint: InfiniteCanvasPoint,
  draggedWindowId: string,
): InfiniteCanvasDockPreview | null {
  const window = state.windows.find((candidate) => candidate.id === draggedWindowId);

  if (window === undefined || isInfiniteCanvasWindowGrouped(state, draggedWindowId)) {
    return null;
  }

  const group = [...state.groups]
    .sort((left, right) => right.zIndex - left.zIndex)
    .find(
      (candidate) =>
        isInfiniteCanvasGroupContainer(candidate.tree) &&
        candidate.tree.layout === "masonry" &&
        rectContainsPoint(candidate.rect, worldPoint),
    );

  if (group === undefined || !isInfiniteCanvasGroupContainer(group.tree)) {
    return null;
  }

  const params = getInfiniteCanvasMasonryParams(group.tree, group.rect);
  const size = calcWHRaw(params, window.rect.width, window.rect.height);
  const { w: span, h: rows } = applySizeConstraints(
    defaultConstraints,
    { i: window.id, x: 0, y: 0, ...size },
    size.w,
    size.h,
    "se",
    getInfiniteCanvasMasonryConstraintContext(params, []),
  );
  const { x, y } = calcXY(
    params,
    window.rect.y - group.rect.y,
    window.rect.x - group.rect.x,
    span,
    rows,
  );
  const position = calcGridItemPosition(params, x, y, span, rows);

  return {
    containerId: group.tree.id,
    edge: "center",
    groupId: group.id,
    layout: { rows, span, x, y },
    rect: {
      height: position.height,
      width: position.width,
      x: group.rect.x + position.left,
      y: group.rect.y + position.top,
    },
    targetId: group.tree.id,
    windowId: draggedWindowId,
  };
}

function applyInfiniteCanvasDockPreview<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  preview: InfiniteCanvasDockPreview,
): InfiniteCanvasState<Kind> {
  if (preview.groupId !== null) {
    const docked = dockInfiniteCanvasWindowIntoGroup(state, {
      containerId: preview.containerId,
      edge: preview.edge,
      groupId: preview.groupId,
      targetId: preview.targetId,
      windowId: preview.windowId,
    });

    return preview.layout === undefined
      ? docked
      : setInfiniteCanvasGroupWindowNodeLayoutsInState(docked, {
          groupId: preview.groupId,
          layouts: { [preview.windowId]: preview.layout },
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
    // A null title derives after the second member docks.
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

/** Activates each ancestor between the window and the group root. */
function revealInfiniteCanvasGroupWindow<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  windowId: string,
): InfiniteCanvasState<Kind> {
  const group = getInfiniteCanvasWindowGroup(state, windowId);

  if (group === null) {
    return state;
  }

  const chain: { childId: string; containerId: string }[] = [];

  for (
    let childId = windowId, parent = getInfiniteCanvasGroupParent(group.tree, childId);
    parent !== null;
    childId = parent.id, parent = getInfiniteCanvasGroupParent(group.tree, childId)
  ) {
    chain.push({ childId, containerId: parent.id });
  }

  return chain.reduce(
    (next, step) => setInfiniteCanvasGroupActiveChildInState(next, { ...step, groupId: group.id }),
    state,
  );
}

type InfiniteCanvasGroupTabLabelContext = Readonly<{
  childId: string;
  group: InfiniteCanvasGroup;
  /** Window payloads do not require a generic kind here. */
  windows: readonly InfiniteCanvasWindow[];
}>;

type InfiniteCanvasGroupTabLabel = (context: InfiniteCanvasGroupTabLabelContext) => string;

function getInfiniteCanvasGroupTabLabel(context: InfiniteCanvasGroupTabLabelContext): string {
  const node = findInfiniteCanvasGroupNode(context.group.tree, context.childId);

  if (node === null) {
    return getInfiniteCanvasGroupTitle(context.group, context.windows);
  }

  if (node.kind === "window") {
    return context.windows.find((window) => window.id === node.id)?.title ?? node.id;
  }

  return node.activeChildId === null
    ? getInfiniteCanvasGroupTitle(context.group, context.windows)
    : getInfiniteCanvasGroupTabLabel({ ...context, childId: node.activeChildId });
}

export {
  DEFAULT_INFINITE_CANVAS_GROUP_TITLE,
  MASONRY_RESIZE_HANDLE_AXIS,
  applyInfiniteCanvasDockPreview,
  closeInfiniteCanvasGroup,
  createInfiniteCanvasGroup,
  detachInfiniteCanvasWindowFromGroups,
  getInfiniteCanvasGroupTitle,
  dockInfiniteCanvasWindowIntoGroup,
  equalizeInfiniteCanvasGroupChildrenInState,
  findInfiniteCanvasGroup,
  getInfiniteCanvasGroupProjection,
  getInfiniteCanvasGroupTabLabel,
  getInfiniteCanvasGroupableWindowIds,
  getInfiniteCanvasGroupedWindowIds,
  getInfiniteCanvasMasonryMembership,
  getInfiniteCanvasMasonryGrid,
  // Not in the barrel: shared with `window.undock`, which frees a member the same way.
  getInfiniteCanvasRoomAround,
  getInfiniteCanvasWindowGroup,
  isInfiniteCanvasWindowGrouped,
  moveInfiniteCanvasMasonryMember,
  reconcileInfiniteCanvasGroups,
  renameInfiniteCanvasGroup,
  revealInfiniteCanvasGroupWindow,
  reorderInfiniteCanvasGroupChildInState,
  resizeInfiniteCanvasMasonryMember,
  resolveInfiniteCanvasDockPreview,
  resolveInfiniteCanvasDockPreviewForTarget,
  resolveInfiniteCanvasLatticeDropPreview,
  setInfiniteCanvasGroupActiveChildInState,
  setInfiniteCanvasGroupAxisInState,
  setInfiniteCanvasGroupChildWeightsInState,
  setInfiniteCanvasGroupLayoutModeInState,
  setInfiniteCanvasGroupRect,
  setInfiniteCanvasGroupWindowNodeLayoutsInState,
  syncInfiniteCanvasGroupWindowRects,
  undockInfiniteCanvasWindowFromGroup,
};
export type {
  InfiniteCanvasGroupProjection,
  InfiniteCanvasGroupTabLabel,
  InfiniteCanvasGroupTabLabelContext,
};
