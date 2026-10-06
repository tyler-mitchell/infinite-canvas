import {
  getCanvasLayout,
  getInfiniteCanvasGroupDockEdgeAtPoint,
  getInfiniteCanvasGroupLayout,
  getTargetBounds,
  layoutDefinitions,
  type CanvasLayout,
} from "./layout";
import { isInfiniteCanvasWindowInActiveWorkspace } from "./workspace-membership";

import { rectContainsPoint, rectsEqual } from "./geometry";
import { updateWindowRect } from "./stacking";
import { getInfiniteCanvasVacantRect } from "./window-placement";
import {
  createInfiniteCanvasGroupWindowNode,
  dockInfiniteCanvasGroupWindow,
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
  type InfiniteCanvasGroupWindowNodeLayout,
  type InfiniteCanvasGroupDockEdge,
  type InfiniteCanvasGroupLayoutMode,
  type InfiniteCanvasGroupMasonry,
  type InfiniteCanvasGroupNode,
} from "./group-tree";
import type {
  InfiniteCanvasDockPreview,
  InfiniteCanvasGroup,
  InfiniteCanvasPoint,
  InfiniteCanvasRect,
  InfiniteCanvasResizeHandle,
  InfiniteCanvasState,
  InfiniteCanvasWindow,
} from "./types";

/** Group topology commits displayed geometry only when members become floating. */

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

export function setInfiniteCanvasGroupBounds<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  input: Readonly<{ groupId: string; bounds: "content" | InfiniteCanvasRect }>,
): InfiniteCanvasState<Kind> {
  const group = findInfiniteCanvasGroup(state, input.groupId);
  if (group === null || group.bounds === input.bounds) return state;
  const next = { ...group, bounds: input.bounds };
  return {
    ...state,
    groups: state.groups.map((group) => (group.id === input.groupId ? next : group)),
  };
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

function getWindowLayoutMembership<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  windowId: string,
) {
  const group = getInfiniteCanvasWindowGroup(state, windowId);
  const container = group === null ? null : getInfiniteCanvasGroupParent(group.tree, windowId);

  return group === null || container === null
    ? null
    : { container, group, operations: layoutDefinitions[container.layout].members };
}

function getWindowLayoutContext<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  windowId: string,
) {
  const membership = getWindowLayoutMembership(state, windowId);

  if (membership?.operations === undefined) {
    return null;
  }

  const { container, group } = membership;
  const rect = getInfiniteCanvasGroupLayout(
    group.tree,
    group.rect,
    state.groupMetrics,
    state.viewport,
  ).containerRects.get(container.id);
  if (rect === undefined) return null;
  return { container, group, rect, operations: membership.operations };
}

export function setInfiniteCanvasWindowContentHeight<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  input: Readonly<{ windowId: string; height: number }>,
): InfiniteCanvasState<Kind> {
  const window = state.windows.find((item) => item.id === input.windowId);
  if (
    window === undefined ||
    (window.heightMode === "manual" && window.aspectRatio === undefined) ||
    !Number.isFinite(input.height) ||
    input.height <= 0
  )
    return state;
  const rect = getCanvasLayout(state).windowRects.get(window.id);
  if (rect === undefined) return state;
  const contentSize = { width: rect.width, height: input.height };
  const measured =
    window.contentSize?.width === contentSize.width &&
    window.contentSize.height === contentSize.height
      ? state
      : {
          ...state,
          windows: state.windows.map((item) =>
            item.id === window.id ? { ...item, contentSize } : item,
          ),
        };
  const layoutContext = getWindowLayoutContext(measured, input.windowId);
  if (layoutContext?.operations.contentHeight !== undefined) {
    const layouts = layoutContext.operations.contentHeight({ ...layoutContext, ...input });
    if (Object.keys(layouts).length === 0) return measured;
    return setInfiniteCanvasGroupWindowNodeLayoutsInState(measured, {
      groupId: layoutContext.group.id,
      layouts,
    });
  }
  if (
    isInfiniteCanvasWindowGrouped(state, input.windowId) ||
    Math.abs(window.rect.height - input.height) < 1
  )
    return measured;
  return updateWindowRect(measured, input.windowId, { ...window.rect, height: input.height });
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

/** Replaces one existing group tree. */
function withInfiniteCanvasGroupTree<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  groupId: string,
  tree: InfiniteCanvasGroupNode | null,
): InfiniteCanvasState<Kind> {
  if (tree === null) return state;
  const index = state.groups.findIndex((group) => group.id === groupId);
  const group = state.groups[index];
  if (group === undefined || group.tree === tree) return state;
  return replaceInfiniteCanvasGroups({
    state,
    groups: state.groups.with(index, { ...group, tree }),
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
  return windowIds.filter((windowId, index) => {
    const window = state.windows.find((candidate) => candidate.id === windowId);

    return (
      window !== undefined &&
      window.mode !== "minimized" &&
      isInfiniteCanvasWindowInActiveWorkspace(state, window.id) &&
      windowIds.indexOf(windowId) === index
    );
  });
}

function createInfiniteCanvasGroup<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  input: Readonly<{
    layout?: InfiniteCanvasGroupLayoutMode;
    masonry?: InfiniteCanvasGroupMasonry;
    groupId: string;
    rect: InfiniteCanvasRect;
    title?: string;
    windowIds: readonly string[];
  }>,
): InfiniteCanvasState<Kind> {
  const { groupId, rect, title, windowIds, layout = "split", masonry } = input;

  if (findInfiniteCanvasGroup(state, groupId) !== null) {
    return state;
  }

  const members = getInfiniteCanvasGroupableWindowIds(state, windowIds);

  if (members.length === 0) {
    return state;
  }

  const geometry = getCanvasLayout(state);
  const detached = replaceInfiniteCanvasGroups({
    state,
    groups: removeInfiniteCanvasGroupMembers({ groups: state.groups, windowIds: members }),
  });

  const [onlyMember] = members;
  const root: InfiniteCanvasGroupNode =
    members.length === 1 && onlyMember !== undefined && layout === "split"
      ? createInfiniteCanvasGroupWindowNode(onlyMember)
      : {
          activeChildId: null,
          axis: "horizontal",
          children: members.map((windowId) => createInfiniteCanvasGroupWindowNode(windowId)),
          id: groupId,
          kind: "container",
          layout,
          ...(masonry === undefined ? {} : { masonry }),
          weight: 1,
        };
  const drop = root.kind === "container" ? layoutDefinitions[root.layout].members?.drop : undefined;
  const tree =
    root.kind === "container" && drop !== undefined
      ? setInfiniteCanvasGroupWindowNodeLayouts(
          root,
          Object.fromEntries(
            members.flatMap((windowId) => {
              const windowRect = geometry.windowRects.get(windowId);
              return windowRect === undefined
                ? []
                : [[windowId, drop({ container: root, rect, windowId, windowRect }).layout]];
            }),
          ),
        )
      : root;
  const normalized = normalizeInfiniteCanvasGroupTree(tree);

  if (normalized === null) {
    return state;
  }

  return replaceInfiniteCanvasGroups({
    state: detached,
    groups: [
      ...detached.groups,
      {
        id: groupId,
        rect,
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

function replaceInfiniteCanvasGroups<Kind extends string>({
  state,
  groups,
  windowRects,
  vacancyBounds,
}: Readonly<{
  state: InfiniteCanvasState<Kind>;
  groups: readonly InfiniteCanvasGroup[];
  windowRects?: Readonly<Record<string, InfiniteCanvasRect | undefined>>;
  vacancyBounds?: InfiniteCanvasRect;
}>): InfiniteCanvasState<Kind> {
  if (groups === state.groups) return state;
  const groupedWindowIds = new Set(
    groups.flatMap((group) => getInfiniteCanvasGroupWindowIds(group.tree)),
  );
  const previousGroupedWindowIds = new Set(
    state.groups.flatMap((group) => getInfiniteCanvasGroupWindowIds(group.tree)),
  );
  const windows = state.windows.map((window) => {
    if (
      window.mode !== "maximized" ||
      !groupedWindowIds.has(window.id) ||
      previousGroupedWindowIds.has(window.id)
    )
      return window;
    const { restoreRect: _restoreRect, ...rest } = window;
    return { ...rest, mode: "normal" as const };
  });
  const releasedWindowIds = new Set(
    [...previousGroupedWindowIds].filter((windowId) => !groupedWindowIds.has(windowId)),
  );
  if (releasedWindowIds.size === 0) return { ...state, groups, windows };
  const geometry = getCanvasLayout(state);
  const settled = state.windows
    .filter((window) => window.mode !== "minimized" && !releasedWindowIds.has(window.id))
    .map((window) => geometry.windowRects.get(window.id)!);

  return {
    ...state,
    groups,
    windows: windows.map((window) => {
      if (!releasedWindowIds.has(window.id) || window.mode === "maximized") return window;

      const explicitRect = windowRects?.[window.id];
      if (explicitRect !== undefined) {
        if (rectsEqual(window.rect, explicitRect)) return window;
        return { ...window, rect: explicitRect };
      }

      const bounds = geometry.windowRects.get(window.id);
      if (bounds === undefined) return window;

      if (vacancyBounds === undefined) {
        if (rectsEqual(window.rect, bounds)) return window;
        return { ...window, rect: bounds };
      }

      const rect = getInfiniteCanvasVacantRect({
        bounds: vacancyBounds,
        occupied: settled,
        preferred: bounds,
      });
      settled.push(rect);
      if (rectsEqual(window.rect, rect)) return window;
      return { ...window, rect };
    }),
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

  const groupRect = getTargetBounds({ state, target: { type: "group", id: group.id } });
  if (groupRect === null) return state;
  return replaceInfiniteCanvasGroups({
    state,
    groups: state.groups.filter((entry) => entry.id !== groupId),
    vacancyBounds: getInfiniteCanvasRoomAround(groupRect),
  });
}

function setInfiniteCanvasGroupRect<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  input: Readonly<{ groupId: string; rect: InfiniteCanvasRect }>,
): InfiniteCanvasState<Kind> {
  const { groupId, rect } = input;

  const index = state.groups.findIndex((group) => group.id === groupId);
  const group = state.groups[index];
  if (group === undefined || rectsEqual(group.rect, rect)) return state;
  const bounds =
    typeof group.bounds === "object"
      ? {
          ...group.bounds,
          x: group.bounds.x + rect.x - group.rect.x,
          y: group.bounds.y + rect.y - group.rect.y,
        }
      : group.bounds;
  return {
    ...state,
    groups: state.groups.with(index, {
      ...group,
      rect,
      ...(bounds === undefined ? {} : { bounds }),
    }),
  };
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

  const tree = dockInfiniteCanvasGroupWindow(group.tree, { containerId, edge, targetId, windowId });
  if (tree === null) return state;
  const container = findInfiniteCanvasGroupNode(group.tree, containerId);
  const rect = getInfiniteCanvasGroupLayout(
    group.tree,
    group.rect,
    state.groupMetrics,
    state.viewport,
  ).containerRects.get(containerId);
  const placement =
    edge === "center" && container?.kind === "container" && rect !== undefined
      ? layoutDefinitions[container.layout].members?.drop?.({
          container,
          rect,
          windowId,
          windowRect: window.rect,
        })
      : undefined;
  return withInfiniteCanvasGroupTree(
    state,
    groupId,
    placement === undefined
      ? tree
      : setInfiniteCanvasGroupWindowNodeLayouts(tree, { [windowId]: placement.layout }),
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

  const tree = undockInfiniteCanvasGroupWindow(group.tree, windowId);
  const groups = state.groups.flatMap((candidate) => {
    if (candidate.id !== group.id) return [candidate];
    if (tree === null) return [];
    return [{ ...candidate, tree }];
  });

  return replaceInfiniteCanvasGroups({
    state,
    groups,
    windowRects: { [windowId]: rect },
  });
}

/** Removes members and groups that decay after removal. */
function removeInfiniteCanvasGroupMembers({
  groups,
  windowIds,
}: Readonly<{
  groups: readonly InfiniteCanvasGroup[];
  windowIds: readonly string[];
}>): readonly InfiniteCanvasGroup[] {
  const detachedWindowIds = new Set(windowIds);
  return groups.flatMap((group) => {
    const tree = normalizeInfiniteCanvasGroupTree(group.tree, (node) =>
      node.kind === "window" && detachedWindowIds.has(node.id) ? null : node,
    );
    if (tree === group.tree) return [group];
    const decayedMemberId = getInfiniteCanvasDecayedGroupMemberId(group, tree);
    if (tree === null || decayedMemberId !== null) return [];
    return [{ ...group, tree }];
  });
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

  const tree: InfiniteCanvasGroupNode =
    group.tree.kind === "window" && input.containerId === group.id
      ? {
          id: group.id,
          kind: "container",
          children: [group.tree],
          activeChildId: null,
          axis: "horizontal",
          layout: input.layout,
          weight: 1,
        }
      : group.tree;
  return withInfiniteCanvasGroupTree(
    state,
    group.id,
    setInfiniteCanvasGroupLayoutMode(tree, {
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
    state.windows.filter((window) => window.mode === "normal").map((window) => window.id),
  );
  const groups: InfiniteCanvasGroup[] = [];
  const claimedWindowIds = new Set<string>();

  for (const group of state.groups) {
    const tree = normalizeInfiniteCanvasGroupTree(group.tree, (node) => {
      if (node.kind === "container") return node;
      if (!liveWindowIds.has(node.id) || claimedWindowIds.has(node.id)) return null;
      claimedWindowIds.add(node.id);
      return node;
    });

    // Only groups that lose members in this pass can decay. Existing one-member groups stay.
    const decayedMemberId = getInfiniteCanvasDecayedGroupMemberId(group, tree);

    if (decayedMemberId !== null) {
      continue;
    }

    if (tree !== null) {
      groups.push(tree === group.tree ? group : { ...group, tree });
    }
  }

  if (
    groups.length === state.groups.length &&
    groups.every((group, index) => group === state.groups[index])
  )
    return state;
  return replaceInfiniteCanvasGroups({ state, groups });
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
function resolveInfiniteCanvasDockPreview<Kind extends string>({
  state,
  worldPoint,
  dockIntent,
}: Readonly<{
  state: InfiniteCanvasState<Kind>;
  worldPoint: InfiniteCanvasPoint;
  dockIntent: boolean;
}>): InfiniteCanvasDockPreview | null {
  const interaction = state.interaction;
  if (
    interaction?.kind !== "move" ||
    interaction.target.type !== "window" ||
    interaction.originRects.length !== 1
  )
    return null;
  const draggedWindowId = interaction.target.id;
  if (isInfiniteCanvasWindowGrouped(state, draggedWindowId)) {
    return null;
  }

  // A lattice takes the drop as cells, not as a split beside one of its members.
  const lattice = resolveInfiniteCanvasLatticeDropPreview(state, worldPoint, draggedWindowId);

  if (lattice !== null || !dockIntent) {
    return lattice;
  }

  const canvasLayout = getCanvasLayout(state);
  const groupsByDepth = state.groups
    .filter((group) => canvasLayout.visibleGroupIds.has(group.id))
    .sort((left, right) => right.zIndex - left.zIndex);

  for (const group of groupsByDepth) {
    const layout = canvasLayout.layouts.get(group.id);
    if (layout === undefined) continue;

    for (const placement of layout.windows) {
      if (
        !canvasLayout.visibleWindowIds.has(placement.windowId) ||
        !rectContainsPoint(placement.rect, worldPoint)
      ) {
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

  const floatingByDepth = state.windows
    .filter(
      (window) =>
        canvasLayout.visibleWindowIds.has(window.id) &&
        window.id !== draggedWindowId &&
        !isInfiniteCanvasWindowGrouped(state, window.id),
    )
    .sort((left, right) => right.zIndex - left.zIndex);

  for (const window of floatingByDepth) {
    const rect = canvasLayout.windowRects.get(window.id)!;
    if (!rectContainsPoint(rect, worldPoint)) {
      continue;
    }

    const edge = getInfiniteCanvasGroupDockEdgeAtPoint(rect, worldPoint);

    return {
      containerId: getInfiniteCanvasDockContainerId(window.id, edge),
      edge,
      groupId: null,
      rect: getInfiniteCanvasDockRegionRect(rect, edge),
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

  const canvasLayout = getCanvasLayout(state);
  const group = getInfiniteCanvasWindowGroup(state, targetId);
  const target = state.windows.find((window) => window.id === targetId);
  const rect = canvasLayout.windowRects.get(targetId);

  if (target === undefined || rect === undefined || target.mode === "minimized") {
    return null;
  }

  return {
    containerId: getInfiniteCanvasDockContainerId(targetId, edge),
    edge,
    groupId: group?.id ?? null,
    rect: getInfiniteCanvasDockRegionRect(rect, edge),
    targetId,
    windowId,
  };
}

/** Applies grid constraints and collision policy before resizing a member. */
function resizeLayoutMember<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  windowId: string,
  rect: InfiniteCanvasRect,
  handle: InfiniteCanvasResizeHandle,
): InfiniteCanvasState<Kind> {
  const layoutContext = getWindowLayoutContext(state, windowId);

  if (layoutContext?.operations.resize === undefined) {
    return state;
  }

  const layouts = layoutContext.operations.resize({
    ...layoutContext,
    windowId,
    windowRect: rect,
    handle,
  });
  if (Object.keys(layouts).length === 0) return state;
  return setInfiniteCanvasGroupWindowNodeLayoutsInState(state, {
    groupId: layoutContext.group.id,
    layouts,
  });
}

function getDropContainer<Kind extends string>({
  state,
  worldPoint,
  canvasLayout,
}: Readonly<{
  state: InfiniteCanvasState<Kind>;
  worldPoint: InfiniteCanvasPoint;
  canvasLayout: CanvasLayout;
}>) {
  const group = state.groups
    .filter((candidate) => canvasLayout.visibleGroupIds.has(candidate.id))
    .sort((left, right) => right.zIndex - left.zIndex)
    .find((candidate) => {
      const bounds = canvasLayout.groupRects.get(candidate.id);
      return bounds !== undefined && rectContainsPoint(bounds, worldPoint);
    });
  if (group === undefined) return null;
  const layout = canvasLayout.layouts.get(group.id);
  if (layout === undefined) return null;
  const entry = [...layout.containerRects]
    .filter(([, bounds]) => rectContainsPoint(bounds, worldPoint))
    .sort(([, left], [, right]) => left.width * left.height - right.width * right.height)[0];
  if (entry === undefined) return { group, container: group.tree, rect: group.rect };
  const [containerId, rect] = entry;
  const container = findInfiniteCanvasGroupNode(group.tree, containerId);
  return container?.kind === "container" ? { group, container, rect } : null;
}

export function resolveInfiniteCanvasGroupInsertion<Kind extends string>({
  state,
  canvasLayout = getCanvasLayout(state),
  worldPoint,
  windowId,
  rect,
}: Readonly<{
  state: InfiniteCanvasState<Kind>;
  canvasLayout?: CanvasLayout;
  worldPoint: InfiniteCanvasPoint;
  windowId: string;
  rect: InfiniteCanvasRect;
}>) {
  const target = getDropContainer({ state, worldPoint, canvasLayout });
  if (target === null) return null;
  const { group, container } = target;
  const placement =
    container.kind === "container"
      ? layoutDefinitions[container.layout].members?.drop?.({
          container,
          rect: target.rect,
          windowId,
          windowRect: rect,
        })
      : undefined;
  return {
    target: {
      groupId: group.id,
      ...(container.kind === "container" ? { containerId: container.id } : {}),
      ...(placement === undefined ? {} : { layout: placement.layout }),
    },
    rect: placement?.rect ?? rect,
  };
}

/** Resolves a floating window's placement in the container under the pointer. */
function resolveInfiniteCanvasLatticeDropPreview<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  worldPoint: InfiniteCanvasPoint,
  draggedWindowId: string,
): InfiniteCanvasDockPreview | null {
  const canvasLayout = getCanvasLayout(state);
  const windowRect = canvasLayout.windowRects.get(draggedWindowId);

  if (windowRect === undefined || isInfiniteCanvasWindowGrouped(state, draggedWindowId)) {
    return null;
  }

  const insertion = resolveInfiniteCanvasGroupInsertion({
    state,
    canvasLayout,
    worldPoint,
    windowId: draggedWindowId,
    rect: windowRect,
  });
  if (insertion?.target.layout === undefined || insertion.target.containerId === undefined)
    return null;

  const preview: InfiniteCanvasDockPreview = {
    containerId: insertion.target.containerId,
    edge: "center",
    groupId: insertion.target.groupId,
    layout: insertion.target.layout,
    rect: insertion.rect,
    targetId: insertion.target.containerId,
    windowId: draggedWindowId,
  };
  const projected = applyInfiniteCanvasDockPreview({ ...state, interaction: null }, preview);
  const rect = getCanvasLayout(projected).windowRects.get(draggedWindowId);
  return rect === undefined ? null : { ...preview, rect };
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
  rect: InfiniteCanvasRect;
  windowRects: ReadonlyMap<string, InfiniteCanvasRect>;
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
  applyInfiniteCanvasDockPreview,
  closeInfiniteCanvasGroup,
  createInfiniteCanvasGroup,
  getInfiniteCanvasGroupTitle,
  dockInfiniteCanvasWindowIntoGroup,
  findInfiniteCanvasGroup,
  getInfiniteCanvasGroupTabLabel,
  getInfiniteCanvasGroupableWindowIds,
  getInfiniteCanvasGroupedWindowIds,
  getWindowLayoutMembership,
  getWindowLayoutContext,
  // Not in the barrel: shared with `window.undock`, which frees a member the same way.
  getInfiniteCanvasRoomAround,
  getInfiniteCanvasWindowGroup,
  isInfiniteCanvasWindowGrouped,
  reconcileInfiniteCanvasGroups,
  renameInfiniteCanvasGroup,
  revealInfiniteCanvasGroupWindow,
  reorderInfiniteCanvasGroupChildInState,
  resizeLayoutMember,
  resolveInfiniteCanvasDockPreview,
  resolveInfiniteCanvasDockPreviewForTarget,
  resolveInfiniteCanvasLatticeDropPreview,
  setInfiniteCanvasGroupActiveChildInState,
  setInfiniteCanvasGroupAxisInState,
  setInfiniteCanvasGroupChildWeightsInState,
  setInfiniteCanvasGroupLayoutModeInState,
  setInfiniteCanvasGroupRect,
  setInfiniteCanvasGroupWindowNodeLayoutsInState,
  undockInfiniteCanvasWindowFromGroup,
};
export type { InfiniteCanvasGroupTabLabel, InfiniteCanvasGroupTabLabelContext };
