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
 * The window a group has decayed to, or `null` if it has not decayed.
 *
 * A group is a container for more than one window. Take it down to a single member and the
 * container is gone — `normalizeInfiniteCanvasGroupTree` collapses a one-child split to its child —
 * and what is left is one window wearing a shell: a border, eight resize handles, a label, and a
 * footprint several times the window's own. Watched in the incubator on 2026-08-27: archiving a
 * note closed its pane's window and left a 544×720 shell around the one that remained, still
 * labelled "Untitled 6 & Connected to Untitled 6" after Untitled 6 had gone.
 *
 * **Decayed, not merely single.** A group deliberately created around one window is a supported
 * state and a useful one — `createInfiniteCanvasGroup` has an explicit branch building that tree,
 * so a consumer can make a shell and then dock into it. The two are indistinguishable from the
 * resulting tree alone, which is why this compares against the group as it stands: more than one
 * member before and one after is decay; one before and one after is what the caller asked for.
 *
 * A one-*tab* group survives either way, and that is the normalizer's rule rather than an exception
 * here: a tabs container with one child is still a container, so it never reaches this at all. It
 * has a strip you can drop onto, which is what makes a shell worth its chrome.
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
 * Dissolve a shell whose last companion was taken away rather than moved out.
 *
 * A survivor takes the group's rect, which is the answer `group.dissolve` already gives — members
 * inherit the space the shell held, and with one member there is no packing to do: it gets all of
 * it. Keeping the pane rect would leave the window at half the footprint the user sized, beside an
 * empty hole where the other pane was.
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
 * What a group is called when nobody named it: what is in it.
 *
 * The default was the literal string "Group", which said nothing and was invisible for as long as
 * nothing drew a group's name. Now that the shell renders it, every group anyone makes draws the
 * word "Group" over itself — and a canvas of them is a canvas of identical labels.
 *
 * Windows carry a required `title`, so the framework can do better than a placeholder without
 * knowing anything about a consumer's content. Two are joined; beyond that the first is named and
 * the rest counted, which is how every mail client writes a thread and degrades at any width.
 * `DEFAULT_INFINITE_CANVAS_GROUP_TITLE` remains the answer when there is nothing to name.
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
 * What to call a group: the name somebody gave it, or what is in it right now.
 *
 * The one read for a group's name, and the reason `title` can be `null`. A given name comes back
 * untouched — including an empty one, which is a consumer saying "draw no label" rather than
 * "derive". A `null` name is computed from the members the tree currently holds, so it follows a
 * window being renamed, docked in, or taken away with no invalidation step to forget.
 *
 * Takes the windows rather than the whole state so the group layer can call it from the selector
 * it already has, instead of subscribing to everything to read two fields.
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

/**
 * Dissolve a group, leaving its members floating exactly where they were drawn.
 * Their rects are already the solved ones — that is the invariant — so there is
 * nothing to restore and nothing jumps.
 */
/** Renaming a shell, under the same rule window renames follow. */
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
 *
 * **A shell left holding one member dissolves here, and deliberately not in `undock`.** Both end
 * with one window in a shell; only one of them is something the user asked for. Undocking is
 * rearrangement — the shell is the workspace being rearranged within, and keeping it is what lets
 * a window be pulled out and another dropped back in, which is why `DOCK-006` asserts the shell
 * survives. Detaching is not rearrangement: the window was closed or minimized, nobody touched the
 * group, and a shell around the survivor is scaffolding left standing after the thing it was
 * scaffolding for went away.
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
     * is there. Without this, a canvas saved while decayed reopens still decayed, which is how the
     * incubator's own saved layout looked on 2026-08-27: one member, a full shell, and a name
     * describing two windows.
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
 * Make every container between a window and its group's root show that window.
 *
 * Activating one container is not revealing: docking onto a member of a tabs container nests a
 * container inside it, so a window two levels down became the active child of its own parent while
 * that parent stayed the hidden sibling. Watched — `window.reveal` set `activeWindowId`, set the
 * inner `activeChildId`, moved the camera, and the window was still not rendered.
 *
 * Walks the chain from the original tree before writing, because only `activeChildId` changes and
 * the structure the walk read stays true for every step.
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
  windows: readonly InfiniteCanvasState<string>["windows"][number][];
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
  getInfiniteCanvasGroupedWindowIds,
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
