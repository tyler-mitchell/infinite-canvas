/**
 * The local layout tree owned by a group shell.
 *
 * A group shell is a world object that moves and resizes as one thing; inside
 * it, windows are arranged by an **n-ary container tree**. N-ary rather than
 * binary BSP: tab groups, sibling insertion, and third-child placement are all
 * awkward under binary trees, and the precedents that got this right (AeroSpace
 * containers, Dockview groups, react-mosaic) are all n-ary. See
 * docs/research/grouping-and-docking.md.
 *
 * Three invariants hold everywhere in this file, and everything else follows:
 *
 * 1. **A window node's id IS its window id.** A window lives in at most one
 *    slot of at most one tree, so it needs no separate identity. Container ids
 *    are supplied by the caller and must not collide with window ids.
 * 2. **Only weight ratios matter.** Weights are positive and never renormalized
 *    on mutation; the layout solver divides by the sibling sum. Removing a
 *    child therefore preserves the proportions of the survivors for free.
 * 3. **Every mutation returns a normalized tree, or `null` if it emptied.**
 *    Callers never see a redundant single-child split, a same-axis split nested
 *    in a same-axis split, an empty container, or a dangling `activeChildId`.
 *
 * Every function here is pure and total. Structural sharing is preserved:
 * only the containers on the path to a changed node are rebuilt.
 */

type InfiniteCanvasGroupAxis = "horizontal" | "vertical";

/**
 * `split` partitions the container along `axis` by child weight. `tabs` shows
 * one child at a time behind a tab strip. `accordion` stacks child headers
 * along `axis` and expands the active one.
 */
type InfiniteCanvasGroupLayout = "accordion" | "split" | "tabs";

/** A window occupying a slot. Its `id` is the window's id — see invariant 1. */
type InfiniteCanvasGroupWindowNode = Readonly<{
  id: string;
  kind: "window";
  weight: number;
}>;

type InfiniteCanvasGroupContainerNode = Readonly<{
  /** The visible child under `tabs` / `accordion`. Always `null` under `split`. */
  activeChildId: string | null;
  axis: InfiniteCanvasGroupAxis;
  children: readonly InfiniteCanvasGroupNode[];
  id: string;
  kind: "container";
  layout: InfiniteCanvasGroupLayout;
  weight: number;
}>;

type InfiniteCanvasGroupNode = InfiniteCanvasGroupContainerNode | InfiniteCanvasGroupWindowNode;

/**
 * Where a dragged window lands relative to a target node. The four compass
 * edges create or extend a split; `center` merges into a tab group. This is the
 * whole docking vocabulary — pointer drags and keyboard commands both compile
 * down to it, so they can never diverge.
 */
type InfiniteCanvasGroupDockEdge = "center" | "east" | "north" | "south" | "west";

const DEFAULT_INFINITE_CANVAS_GROUP_WEIGHT = 1;

/** A weight must be a positive, finite share; anything else collapses layout. */
function toGroupWeight(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_INFINITE_CANVAS_GROUP_WEIGHT;
}

function createInfiniteCanvasGroupWindowNode(
  windowId: string,
  weight: number = DEFAULT_INFINITE_CANVAS_GROUP_WEIGHT,
): InfiniteCanvasGroupWindowNode {
  return {
    id: windowId,
    kind: "window",
    weight: toGroupWeight(weight),
  };
}

function isInfiniteCanvasGroupContainer(
  node: InfiniteCanvasGroupNode,
): node is InfiniteCanvasGroupContainerNode {
  return node.kind === "container";
}

/** `tabs` and `accordion` show one child at a time; `split` shows all of them. */
function hasInfiniteCanvasGroupActiveChild(container: InfiniteCanvasGroupContainerNode): boolean {
  return container.layout !== "split";
}

function getInfiniteCanvasGroupChildWeightSum(
  children: readonly InfiniteCanvasGroupNode[],
): number {
  return children.reduce((total, child) => total + child.weight, 0);
}

function findInfiniteCanvasGroupNode(
  node: InfiniteCanvasGroupNode,
  nodeId: string,
): InfiniteCanvasGroupNode | null {
  if (node.id === nodeId) {
    return node;
  }

  if (!isInfiniteCanvasGroupContainer(node)) {
    return null;
  }

  for (const child of node.children) {
    const found = findInfiniteCanvasGroupNode(child, nodeId);

    if (found !== null) {
      return found;
    }
  }

  return null;
}

/** The container holding `nodeId`, or `null` when it is the root or absent. */
function getInfiniteCanvasGroupParent(
  node: InfiniteCanvasGroupNode,
  nodeId: string,
): InfiniteCanvasGroupContainerNode | null {
  if (!isInfiniteCanvasGroupContainer(node)) {
    return null;
  }

  for (const child of node.children) {
    if (child.id === nodeId) {
      return node;
    }

    const found = getInfiniteCanvasGroupParent(child, nodeId);

    if (found !== null) {
      return found;
    }
  }

  return null;
}

/** Window ids in layout order — left-to-right, top-to-bottom, tabs in tab order. */
function getInfiniteCanvasGroupWindowIds(node: InfiniteCanvasGroupNode): readonly string[] {
  return isInfiniteCanvasGroupContainer(node)
    ? node.children.flatMap(getInfiniteCanvasGroupWindowIds)
    : [node.id];
}

/**
 * The single structural workhorse. `replace` receives the matched node and
 * returns its replacement, or `null` to delete it. Containers off the path are
 * returned by reference, so unchanged subtrees keep their identity — which is
 * what lets the renderer memoize on node identity.
 *
 * The result is NOT normalized: callers compose this with
 * `normalizeInfiniteCanvasGroupTree` so a mutation pays for exactly one pass.
 */
function replaceInfiniteCanvasGroupNode(
  node: InfiniteCanvasGroupNode,
  nodeId: string,
  replace: (node: InfiniteCanvasGroupNode) => InfiniteCanvasGroupNode | null,
): InfiniteCanvasGroupNode | null {
  if (node.id === nodeId) {
    return replace(node);
  }

  if (!isInfiniteCanvasGroupContainer(node)) {
    return node;
  }

  const children: InfiniteCanvasGroupNode[] = [];
  let hasChanged = false;

  for (const child of node.children) {
    const nextChild = replaceInfiniteCanvasGroupNode(child, nodeId, replace);

    if (nextChild !== child) {
      hasChanged = true;
    }

    if (nextChild !== null) {
      children.push(nextChild);
    }
  }

  return hasChanged ? { ...node, children } : node;
}

/**
 * Inline a same-axis split child's grandchildren into the parent, rescaling
 * their weights so each keeps the share of the parent it had before. A split
 * inside a same-axis split is visually identical to a flat split, so the nested
 * form is pure noise: it makes sibling insertion churn and weights lie.
 */
function inlineSameAxisSplitChildren(
  container: InfiniteCanvasGroupContainerNode,
): readonly InfiniteCanvasGroupNode[] {
  if (container.layout !== "split") {
    return container.children;
  }

  return container.children.flatMap((child) => {
    if (
      !isInfiniteCanvasGroupContainer(child) ||
      child.layout !== "split" ||
      child.axis !== container.axis
    ) {
      return [child];
    }

    const childWeightSum = getInfiniteCanvasGroupChildWeightSum(child.children);

    return child.children.map((grandchild) => ({
      ...grandchild,
      weight: toGroupWeight((grandchild.weight / childWeightSum) * child.weight),
    }));
  });
}

/**
 * Restore every invariant in one bottom-up pass, and return `null` when the
 * tree has emptied out (the caller then destroys the group shell — DOCK-005).
 *
 * Because children are normalized before their parent, a grandchild that was a
 * same-axis split has already been inlined into the child by the time the
 * parent looks at it. One pass therefore reaches a fixed point.
 */
function normalizeInfiniteCanvasGroupTree(
  node: InfiniteCanvasGroupNode,
): InfiniteCanvasGroupNode | null {
  if (!isInfiniteCanvasGroupContainer(node)) {
    return node;
  }

  const normalizedChildren = node.children
    .map(normalizeInfiniteCanvasGroupTree)
    .filter((child): child is InfiniteCanvasGroupNode => child !== null);
  const children = inlineSameAxisSplitChildren({ ...node, children: normalizedChildren });

  if (children.length === 0) {
    return null;
  }

  // A single-child split is its child. Tab and accordion shells are semantic —
  // a one-tab group is still a tab group — so they survive at one child.
  const [onlyChild] = children;

  if (children.length === 1 && node.layout === "split" && onlyChild !== undefined) {
    return { ...onlyChild, weight: node.weight };
  }

  return {
    ...node,
    activeChildId: resolveInfiniteCanvasGroupActiveChildId(node, children),
    children,
  };
}

/**
 * `split` shows every child, so it has no active one. Otherwise the active
 * child must still exist: after a removal the id can dangle, and the first
 * remaining child is the predictable landing spot (DOCK-004).
 */
function resolveInfiniteCanvasGroupActiveChildId(
  container: InfiniteCanvasGroupContainerNode,
  children: readonly InfiniteCanvasGroupNode[],
): string | null {
  if (!hasInfiniteCanvasGroupActiveChild(container)) {
    return null;
  }

  const isActiveChildPresent = children.some((child) => child.id === container.activeChildId);

  return isActiveChildPresent ? container.activeChildId : (children[0]?.id ?? null);
}

function getInfiniteCanvasGroupDockAxis(
  edge: Exclude<InfiniteCanvasGroupDockEdge, "center">,
): InfiniteCanvasGroupAxis {
  return edge === "east" || edge === "west" ? "horizontal" : "vertical";
}

/** West and north put the incoming window before the target; east and south after. */
function isInfiniteCanvasGroupLeadingEdge(
  edge: Exclude<InfiniteCanvasGroupDockEdge, "center">,
): boolean {
  return edge === "north" || edge === "west";
}

/**
 * Merge a window into `target` as a tab. An existing tab or accordion shell
 * absorbs it; anything else is wrapped in a new tab group. The incoming window
 * becomes active, because the user just dropped it there (DOCK-002).
 */
function mergeInfiniteCanvasGroupWindowAsTab(
  target: InfiniteCanvasGroupNode,
  windowNode: InfiniteCanvasGroupWindowNode,
  containerId: string,
): InfiniteCanvasGroupNode {
  if (isInfiniteCanvasGroupContainer(target) && hasInfiniteCanvasGroupActiveChild(target)) {
    return {
      ...target,
      activeChildId: windowNode.id,
      children: [...target.children, windowNode],
    };
  }

  return {
    activeChildId: windowNode.id,
    axis: "horizontal",
    children: [{ ...target, weight: DEFAULT_INFINITE_CANVAS_GROUP_WEIGHT }, windowNode],
    id: containerId,
    kind: "container",
    layout: "tabs",
    weight: target.weight,
  };
}

/**
 * Split `target` along the dock axis and seat the window beside it. The target
 * surrenders half its weight, so the pair together occupy exactly the space the
 * target held — neighbours never move because someone docked elsewhere.
 */
function splitInfiniteCanvasGroupNodeWithWindow(
  target: InfiniteCanvasGroupNode,
  windowNode: InfiniteCanvasGroupWindowNode,
  containerId: string,
  edge: Exclude<InfiniteCanvasGroupDockEdge, "center">,
): InfiniteCanvasGroupContainerNode {
  const half = target.weight / 2;
  const seated = { ...windowNode, weight: half };
  const shrunkTarget = { ...target, weight: half };

  return {
    activeChildId: null,
    axis: getInfiniteCanvasGroupDockAxis(edge),
    children: isInfiniteCanvasGroupLeadingEdge(edge)
      ? [seated, shrunkTarget]
      : [shrunkTarget, seated],
    id: containerId,
    kind: "container",
    layout: "split",
    weight: target.weight,
  };
}

/**
 * Seat the window beside `target` inside `parent`, which already splits along
 * the dock axis. Extending the existing split rather than nesting a new one is
 * what makes a third sibling cheap and stable (SPLIT-002).
 */
function insertInfiniteCanvasGroupWindowBesideSibling(
  parent: InfiniteCanvasGroupContainerNode,
  targetId: string,
  windowNode: InfiniteCanvasGroupWindowNode,
  edge: Exclude<InfiniteCanvasGroupDockEdge, "center">,
): InfiniteCanvasGroupContainerNode {
  const targetIndex = parent.children.findIndex((child) => child.id === targetId);
  const target = parent.children[targetIndex];

  if (target === undefined) {
    return parent;
  }

  const half = target.weight / 2;
  const children = parent.children.map((child) =>
    child.id === targetId ? { ...child, weight: half } : child,
  );

  children.splice(isInfiniteCanvasGroupLeadingEdge(edge) ? targetIndex : targetIndex + 1, 0, {
    ...windowNode,
    weight: half,
  });

  return { ...parent, children };
}

/**
 * Dock a window against a node already in the tree. Returns the tree unchanged
 * when the target is missing or the window is already seated — docking is a
 * user gesture, and a stale drop target is not an error worth throwing over.
 *
 * `containerId` names the container this may need to create; supplying it (per
 * action) rather than generating one keeps the operation pure and makes undo
 * replay reproduce exactly the same tree.
 */
function dockInfiniteCanvasGroupWindow(
  root: InfiniteCanvasGroupNode,
  input: Readonly<{
    containerId: string;
    edge: InfiniteCanvasGroupDockEdge;
    targetId: string;
    windowId: string;
  }>,
): InfiniteCanvasGroupNode | null {
  const { containerId, edge, targetId, windowId } = input;

  if (
    windowId === targetId ||
    findInfiniteCanvasGroupNode(root, targetId) === null ||
    findInfiniteCanvasGroupNode(root, windowId) !== null
  ) {
    return root;
  }

  const windowNode = createInfiniteCanvasGroupWindowNode(windowId);

  if (edge === "center") {
    return normalizeGroupTreeOrNull(
      replaceInfiniteCanvasGroupNode(root, targetId, (target) =>
        mergeInfiniteCanvasGroupWindowAsTab(target, windowNode, containerId),
      ),
    );
  }

  const parent = getInfiniteCanvasGroupParent(root, targetId);
  const canExtendParent =
    parent !== null &&
    parent.layout === "split" &&
    parent.axis === getInfiniteCanvasGroupDockAxis(edge);

  if (canExtendParent) {
    return normalizeGroupTreeOrNull(
      replaceInfiniteCanvasGroupNode(root, parent.id, () =>
        insertInfiniteCanvasGroupWindowBesideSibling(parent, targetId, windowNode, edge),
      ),
    );
  }

  return normalizeGroupTreeOrNull(
    replaceInfiniteCanvasGroupNode(root, targetId, (target) =>
      splitInfiniteCanvasGroupNodeWithWindow(target, windowNode, containerId, edge),
    ),
  );
}

/**
 * Tear a window out of the tree. Returns `null` when it was the last one, which
 * is the signal to destroy the group shell (DOCK-005). Surviving siblings keep
 * their proportions, because only weight ratios matter.
 */
function undockInfiniteCanvasGroupWindow(
  root: InfiniteCanvasGroupNode,
  windowId: string,
): InfiniteCanvasGroupNode | null {
  if (findInfiniteCanvasGroupNode(root, windowId) === null) {
    return root;
  }

  return normalizeGroupTreeOrNull(replaceInfiniteCanvasGroupNode(root, windowId, () => null));
}

/** Move a child to a new index among its siblings — tab reorder (TAB-001). */
function reorderInfiniteCanvasGroupChild(
  root: InfiniteCanvasGroupNode,
  input: Readonly<{ childId: string; toIndex: number }>,
): InfiniteCanvasGroupNode | null {
  const { childId, toIndex } = input;
  const parent = getInfiniteCanvasGroupParent(root, childId);

  if (parent === null) {
    return root;
  }

  const fromIndex = parent.children.findIndex((child) => child.id === childId);
  const child = parent.children[fromIndex];

  if (child === undefined) {
    return root;
  }

  const children = [...parent.children];
  children.splice(fromIndex, 1);
  children.splice(clampIndex(toIndex, children.length), 0, child);

  return normalizeGroupTreeOrNull(
    replaceInfiniteCanvasGroupNode(root, parent.id, () => ({ ...parent, children })),
  );
}

function clampIndex(index: number, lastInsertableIndex: number): number {
  if (!Number.isFinite(index)) {
    return lastInsertableIndex;
  }

  return Math.min(Math.max(Math.trunc(index), 0), lastInsertableIndex);
}

/**
 * Convert a container's layout mode. Membership and weights are untouched, so
 * tabs↔accordion round-trips exactly (TAB-002) and a group converted to tabs
 * and back to split restores the proportions it had (weights ride along on the
 * nodes even while the layout ignores them).
 */
function setInfiniteCanvasGroupLayout(
  root: InfiniteCanvasGroupNode,
  input: Readonly<{ containerId: string; layout: InfiniteCanvasGroupLayout }>,
): InfiniteCanvasGroupNode | null {
  const { containerId, layout } = input;

  return normalizeGroupTreeOrNull(
    replaceInfiniteCanvasGroupNode(root, containerId, (node) =>
      isInfiniteCanvasGroupContainer(node) ? { ...node, layout } : node,
    ),
  );
}

/** Reverse a split container's orientation without disturbing its children. */
function setInfiniteCanvasGroupAxis(
  root: InfiniteCanvasGroupNode,
  input: Readonly<{ axis: InfiniteCanvasGroupAxis; containerId: string }>,
): InfiniteCanvasGroupNode | null {
  const { axis, containerId } = input;

  return normalizeGroupTreeOrNull(
    replaceInfiniteCanvasGroupNode(root, containerId, (node) =>
      isInfiniteCanvasGroupContainer(node) ? { ...node, axis } : node,
    ),
  );
}

/**
 * Reveal a child of a tab or accordion group. A no-op on `split`, where every
 * child is already visible, and on ids that are not children of `containerId`.
 */
function setInfiniteCanvasGroupActiveChild(
  root: InfiniteCanvasGroupNode,
  input: Readonly<{ childId: string; containerId: string }>,
): InfiniteCanvasGroupNode | null {
  const { childId, containerId } = input;

  return normalizeGroupTreeOrNull(
    replaceInfiniteCanvasGroupNode(root, containerId, (node) => {
      if (!isInfiniteCanvasGroupContainer(node) || !hasInfiniteCanvasGroupActiveChild(node)) {
        return node;
      }

      const isChild = node.children.some((child) => child.id === childId);

      return isChild ? { ...node, activeChildId: childId } : node;
    }),
  );
}

/**
 * Reassign weights among a container's children — this is what dragging a split
 * gutter does. Weights are keyed by child id rather than by position so a
 * concurrent reorder cannot silently resize the wrong pane (SPLIT-001: the
 * partition allocation changes, never a DOM width).
 */
function setInfiniteCanvasGroupChildWeights(
  root: InfiniteCanvasGroupNode,
  input: Readonly<{ containerId: string; weights: Readonly<Record<string, number>> }>,
): InfiniteCanvasGroupNode | null {
  const { containerId, weights } = input;

  return normalizeGroupTreeOrNull(
    replaceInfiniteCanvasGroupNode(root, containerId, (node) => {
      if (!isInfiniteCanvasGroupContainer(node)) {
        return node;
      }

      return {
        ...node,
        children: node.children.map((child) => {
          const weight = weights[child.id];

          return weight === undefined ? child : { ...child, weight: toGroupWeight(weight) };
        }),
      };
    }),
  );
}

/** `replaceInfiniteCanvasGroupNode` may empty the root; normalization only runs on a tree. */
function normalizeGroupTreeOrNull(
  node: InfiniteCanvasGroupNode | null,
): InfiniteCanvasGroupNode | null {
  return node === null ? null : normalizeInfiniteCanvasGroupTree(node);
}

export {
  DEFAULT_INFINITE_CANVAS_GROUP_WEIGHT,
  createInfiniteCanvasGroupWindowNode,
  dockInfiniteCanvasGroupWindow,
  findInfiniteCanvasGroupNode,
  getInfiniteCanvasGroupChildWeightSum,
  getInfiniteCanvasGroupDockAxis,
  getInfiniteCanvasGroupParent,
  getInfiniteCanvasGroupWindowIds,
  hasInfiniteCanvasGroupActiveChild,
  isInfiniteCanvasGroupContainer,
  normalizeInfiniteCanvasGroupTree,
  reorderInfiniteCanvasGroupChild,
  replaceInfiniteCanvasGroupNode,
  setInfiniteCanvasGroupActiveChild,
  setInfiniteCanvasGroupAxis,
  setInfiniteCanvasGroupChildWeights,
  setInfiniteCanvasGroupLayout,
  undockInfiniteCanvasGroupWindow,
};
export type {
  InfiniteCanvasGroupAxis,
  InfiniteCanvasGroupContainerNode,
  InfiniteCanvasGroupDockEdge,
  InfiniteCanvasGroupLayout,
  InfiniteCanvasGroupNode,
  InfiniteCanvasGroupWindowNode,
};
