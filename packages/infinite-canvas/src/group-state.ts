import { getInfiniteCanvasVacantRect } from "./window-placement";
import {
  DEFAULT_INFINITE_CANVAS_GROUP_METRICS,
  getInfiniteCanvasGroupDockEdgeAtPoint,
  getInfiniteCanvasGroupLayout,
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
  undockInfiniteCanvasGroupWindow,
  type InfiniteCanvasGroupAxis,
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
  InfiniteCanvasState,
  InfiniteCanvasWindow,
} from "./types";

/**
 * Groups, projected onto canvas state.
 *
 * The rule for this file: the group is the source of truth and a member window's `rect` is its
 * projection. After every mutation that can move a member,
 * `syncInfiniteCanvasGroupWindowRects` re-solves every group and writes the result onto
 * `window.rect`. Snapping, selection bounds, camera framing, the window layer, persistence, and
 * the scene-layer proxies then all read `window.rect` without knowing groups exist.
 *
 * A window hidden behind an inactive tab or a collapsed fold is still solved, taking the rect it
 * would occupy if revealed. Nothing renders it, but a tear-out frees it at its own size, and
 * anything unioning window rects gets a current value rather than a pre-dock one.
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
 * Solves every group and flattens the result into a lookup. Takes `groups` rather than the whole
 * state so a caller can memoize on exactly what it reads, and a camera tick does not re-solve.
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
 * Re-projects every group onto its members' rects. Every mutation in this file ends here, so
 * `window.rect` cannot disagree with the tree.
 */
function syncInfiniteCanvasGroupWindowRects<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
): InfiniteCanvasState<Kind> {
  if (state.groups.length === 0) {
    return state;
  }

  const { windowRects } = getInfiniteCanvasGroupProjection(state.groups, state.groupMetrics);

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

/**
 * The window a group has decayed to, or `null` if it has not decayed. Decay is more than one
 * member before and one after; a group deliberately created around a single window is supported
 * and not decay, which is why this compares against the group as it stands.
 *
 * A tabs container with one child is still a container and never reaches this, since it keeps a
 * strip that can be dropped onto.
 */
function getInfiniteCanvasDecayedGroupMemberId(
  group: InfiniteCanvasGroup,
  tree: InfiniteCanvasGroupNode | null,
): string | null {
  if (tree === null || isInfiniteCanvasGroupContainer(tree)) {
    return null;
  }

  return getInfiniteCanvasGroupWindowIds(group.tree).length > 1 ? tree.id : null;
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

/**
 * Dissolves a shell left holding one member. The survivor takes the group's rect, matching what
 * `group.dissolve` does; keeping the pane rect would leave it at half the sized footprint.
 */
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

/**
 * Composes a group's name from its members' titles, so unnamed groups do not all render the same
 * placeholder. Two titles are joined; beyond that the first is named and the rest counted.
 * `DEFAULT_INFINITE_CANVAS_GROUP_TITLE` is used when there is nothing to name.
 */
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

/**
 * A group's name: the one it was given, or one derived from its current members. This is the only
 * read for a group's name, and why `title` can be `null`.
 *
 * A given name is returned untouched, including an empty string, which means "draw no label"
 * rather than "derive". A `null` name is recomputed from the tree, so it follows renames and
 * docking with no invalidation step.
 *
 * The `find` per member is deliberate. Measured at 0.004 ms/frame with 20 windows, 0.233 ms with
 * 1000 windows and 50 groups of 8 — 1.4% of a 16.7 ms frame at the worst. An index rebuilt each
 * render would cost more than it saves.
 */
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

/**
 * Which of these windows `createInfiniteCanvasGroup` would take, in the order given, so a "group
 * these" control can decide whether to enable itself. Missing, minimized, and already-grouped
 * windows are dropped rather than stolen.
 */
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

/**
 * Builds a group from floating windows, laid out as one horizontal split in the order given,
 * sharing the shell equally. Applies the same filtering as
 * `getInfiniteCanvasGroupableWindowIds`.
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

/** Renames a shell, under the same rule window renames follow. */
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

/**
 * Room to place freed members into, bounded around the shell rather than the camera. Bounding by
 * the viewport would pull a window that was legitimately off screen back into view.
 */
function getInfiniteCanvasRoomAround(shell: InfiniteCanvasRect): InfiniteCanvasRect {
  return {
    height: shell.height * 3,
    width: shell.width * 3,
    x: shell.x - shell.width,
    y: shell.y - shell.height,
  };
}

/**
 * Breaks up a shell and places its members through vacancy. Tab members all carry the shell's
 * content rect, so releasing them unchanged would stack them at identical coordinates. A split's
 * panes are already clear of one another and are left alone.
 */
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
  // The shell's footprint is free, but only for the first member to claim it.
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
 * Tears a window out of whatever group holds it. It lands on `rect`, or stays where it was drawn
 * when no rect is supplied, so a tear-out gesture does not make the window jump before the drag
 * begins. Removing the last member destroys the shell.
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
 * Drops a window out of every group that claims it, without giving it a rect. Closing and
 * minimizing both need this, since neither can keep occupying a layout slot.
 *
 * A shell left holding one member dissolves here but not in `undock`. Undocking is rearrangement
 * and keeping the shell is what lets another window be dropped back in, which `DOCK-006` asserts.
 * Detaching is not: the window was closed or minimized and nobody touched the group.
 */
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
 * Drops group members that no longer name a live, non-minimized window, and drops groups that
 * empty out. Hydration and registry normalization both need it: a persisted tree can name a window
 * whose `kind` is no longer registered.
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
  /** Survivors of a shell that decayed here, and the footprint each inherits. */
  const freedRects = new Map<string, InfiniteCanvasRect>();

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

    /*
     * The same rule `detach` applies, for the same reason and on the same cause.
     *
     * Reconciliation runs when a window a tree names is gone — dead on hydration because its kind
     * left the registry, minimized into the dock, or claimed by an earlier group. Nobody touched
     * the group in any of those, so a shell left holding one member is residue here exactly as it
     * is there.
     *
     * **What this cannot reach, stated because the obvious reading of it is wrong.** Decay is
     * "more than one member before, one after", and `before` is `group.tree` as this pass received
     * it. So the rule fires for a tree that loses a member *here* and never for a tree that arrived
     * already collapsed to one. A canvas saved that way therefore reopens exactly as it was saved,
     * and no predicate in this pass can change that: `serializeInfiniteCanvasState` writes an
     * undocked shell as `{"tree":{"id":"east","kind":"window","weight":1}}`, which is the same
     * bytes a decayed one writes. The document has no signal to read.
     *
     * That is a boundary rather than a bug, and dissolving every single-member group here would be
     * the wrong repair: `undock` produces this shape deliberately under DOCK-006 and it is a real
     * part of a saved arrangement. `group-decay.test.ts` pins both directions.
     */
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

/**
 * Docking, resolved from the group tree and the window list rather than by hit-testing the DOM. A
 * target read from `getBoundingClientRect` would disagree with the tree under any transform,
 * scroll, or zoom, dropping the window somewhere other than the overlay showed.
 */

/**
 * Container and group ids are derived from the target rather than generated, so the operation is
 * pure and an undo replay rebuilds the identical tree. Ids collide only if two containers wrap the
 * same node on the same edge, and node ids are window ids, which are canvas-unique.
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
 * Where a window would land if the drag ended now, or `null` over empty canvas. Groups are
 * searched before floating windows, both topmost-first, matching the visible stacking order. The
 * dragged window and anything already grouped are never targets.
 */
function resolveInfiniteCanvasDockPreview<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  worldPoint: InfiniteCanvasPoint,
  draggedWindowId: string,
): InfiniteCanvasDockPreview | null {
  if (isInfiniteCanvasWindowGrouped(state, draggedWindowId)) {
    return null;
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

/**
 * The same preview, resolved from a named target rather than a pointer, so docking is reachable
 * without a mouse. Produces the same `InfiniteCanvasDockPreview`, so both gestures commit through
 * `applyInfiniteCanvasDockPreview` and cannot diverge.
 *
 * The caller supplies the edge: a drag reads which half of the target the pointer is over, a
 * keyboard gesture takes the side the window arrives from.
 */
function resolveInfiniteCanvasDockPreviewForTarget<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  input: Readonly<{
    edge: InfiniteCanvasGroupDockEdge;
    targetId: string;
    windowId: string;
  }>,
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

/**
 * Commits a resolved preview. Docking onto a floating window wraps that window in a group
 * occupying the rect it already had, then docks against it, so the pair lands where the target was
 * and nothing else shifts (DOCK-001).
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
    // No title here on purpose. The group is minted with one member and gains the second on the
    // very next line, so any name chosen now is a name for half of it — this passed `target.title`
    // and left a pair called after whichever window was stood on.
    windowIds: [target.id],
  });
  /*
   * No naming step. The group is minted `title: null` and stays that way, so it is named after
   * whatever it holds whenever somebody reads it.
   *
   * This used to re-derive and write a name here, *after* the dock had settled, because the group
   * is created with one member and gains the second on the very next line — so anything written at
   * creation named half of it. That ordering problem is what a stored derived name always turns
   * into, and it does not exist once the name is computed on read instead of chosen on write.
   */
  return dockInfiniteCanvasWindowIntoGroup(seeded, {
    containerId: preview.containerId,
    edge: preview.edge,
    groupId,
    targetId: preview.targetId,
    windowId: preview.windowId,
  });
}

/**
 * Makes every container between a window and its group's root show that window. Activating only
 * the innermost container is not enough: a window nested two levels down becomes its parent's
 * active child while that parent stays the hidden sibling.
 *
 * Walks the chain from the original tree before writing, since only `activeChildId` changes and
 * the structure stays valid for every step.
 */
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

/** What a tab or accordion header is called. Replace via the desktop's `groupTabLabel`. */
type InfiniteCanvasGroupTabLabelContext = Readonly<{
  /** A window node, or a container nested inside a tab. */
  childId: string;
  group: InfiniteCanvasGroup;
  /**
   * Not generic in `Kind`. Making it so would let a labeller switch exhaustively on `window.kind`,
   * at the cost of genericising five `group-layer` components that have no other reason to be —
   * and window payloads are read through `getInfiniteCanvasWindowData`, not through `kind`.
   */
  windows: readonly InfiniteCanvasWindow[];
}>;

type InfiniteCanvasGroupTabLabel = (context: InfiniteCanvasGroupTabLabelContext) => string;

/** Window: its title. Nested tabs/accordion: what it is showing. Split: the group's title. */
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
  // Not in the barrel: shared with `window.undock`, which frees a member the same way.
  getInfiniteCanvasRoomAround,
  getInfiniteCanvasWindowGroup,
  isInfiniteCanvasWindowGrouped,
  reconcileInfiniteCanvasGroups,
  renameInfiniteCanvasGroup,
  revealInfiniteCanvasGroupWindow,
  reorderInfiniteCanvasGroupChildInState,
  resolveInfiniteCanvasDockPreview,
  resolveInfiniteCanvasDockPreviewForTarget,
  setInfiniteCanvasGroupActiveChildInState,
  setInfiniteCanvasGroupAxisInState,
  setInfiniteCanvasGroupChildWeightsInState,
  setInfiniteCanvasGroupLayoutModeInState,
  setInfiniteCanvasGroupRect,
  syncInfiniteCanvasGroupWindowRects,
  undockInfiniteCanvasWindowFromGroup,
};
export type {
  InfiniteCanvasGroupProjection,
  InfiniteCanvasGroupTabLabel,
  InfiniteCanvasGroupTabLabelContext,
};
