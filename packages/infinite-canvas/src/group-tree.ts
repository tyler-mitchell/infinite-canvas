/** Mutations normalize trees. Window node ids equal window ids. Weights are positive shares. */

import type { CompactType, GridConfig } from "react-grid-layout/core";
import type { canvasModel } from "./schema";

type InfiniteCanvasGroupAxis = "horizontal" | "vertical";

/** Split and masonry show all children. Tabs and accordion show one active child. */
type InfiniteCanvasGroupLayoutMode = "accordion" | "masonry" | "split" | "tabs";

/** Grid position and size; absent sizes use one cell. */
type InfiniteCanvasGroupWindowNodeLayout = Readonly<typeof canvasModel.GroupWindowLayout.infer>;

type InfiniteCanvasGroupWindowNode = InfiniteCanvasGroupWindowNodeLayout &
  Readonly<{
    id: string;
    kind: "window";
    weight: number;
  }>;

/** Grid configuration; an absent row height makes square cells. */
type InfiniteCanvasGroupMasonry = Readonly<
  Partial<GridConfig> & {
    allowOverlap?: boolean;
    compactType?: CompactType;
    preventCollision?: boolean;
  }
>;

type InfiniteCanvasGroupContainerNode = Readonly<{
  /** Visible child for tabs and accordion. `null` for split and masonry. */
  activeChildId: string | null;
  axis: InfiniteCanvasGroupAxis;
  children: readonly InfiniteCanvasGroupNode[];
  id: string;
  kind: "container";
  layout: InfiniteCanvasGroupLayoutMode;
  /** Masonry grid and compaction options. */
  masonry?: InfiniteCanvasGroupMasonry;
  weight: number;
}>;

type InfiniteCanvasGroupNode = InfiniteCanvasGroupContainerNode | InfiniteCanvasGroupWindowNode;

/** Edge positions split. The center position merges tabs. */
type InfiniteCanvasGroupDockEdge = "center" | "east" | "north" | "south" | "west";

const DEFAULT_INFINITE_CANVAS_GROUP_WEIGHT = 1;

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

function hasInfiniteCanvasGroupActiveChild(container: InfiniteCanvasGroupContainerNode): boolean {
  return container.layout === "tabs" || container.layout === "accordion";
}

/** Rewrites the lattice fields of members by id. A field left out keeps its value. */
function setInfiniteCanvasGroupWindowNodeLayouts(
  root: InfiniteCanvasGroupNode,
  layouts: Readonly<Record<string, InfiniteCanvasGroupWindowNodeLayout>>,
): InfiniteCanvasGroupNode {
  if (isInfiniteCanvasGroupContainer(root)) {
    const children = root.children.map((child) =>
      setInfiniteCanvasGroupWindowNodeLayouts(child, layouts),
    );
    return children.every((child, index) => child === root.children[index])
      ? root
      : { ...root, children };
  }

  const layout = layouts[root.id];

  return layout === undefined ||
    Object.entries(layout).every(([key, value]) => Reflect.get(root, key) === value)
    ? root
    : { ...root, ...layout };
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

function getInfiniteCanvasGroupWindowIds(node: InfiniteCanvasGroupNode): readonly string[] {
  return isInfiniteCanvasGroupContainer(node)
    ? node.children.flatMap(getInfiniteCanvasGroupWindowIds)
    : [node.id];
}

/** Replaces one node with structural sharing. The caller normalizes the result. */
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

/** Flattens nested same-axis splits and preserves relative child weights. */
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

/** Restores tree invariants or returns `null` for an empty tree. */
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

  // Collapse a single-child split. Tabs and accordion retain their container.
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

/** Clears split activation and repairs missing active child ids. */
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

function isInfiniteCanvasGroupLeadingEdge(
  edge: Exclude<InfiniteCanvasGroupDockEdge, "center">,
): boolean {
  return edge === "north" || edge === "west";
}

/** Adds a masonry member or an active tab at the center. */
function mergeInfiniteCanvasGroupWindowAsTab(
  target: InfiniteCanvasGroupNode,
  windowNode: InfiniteCanvasGroupWindowNode,
  containerId: string,
): InfiniteCanvasGroupNode {
  if (isInfiniteCanvasGroupContainer(target) && target.layout === "masonry") {
    return { ...target, children: [...target.children, windowNode] };
  }

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

/** Splits the target and gives both panes equal shares of its prior weight. */
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

/** Adds a sibling to an existing split on the same axis. */
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

/** Docks a window without change when the target is stale or already contains it. */
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

/** Removes a window and returns `null` when the tree becomes empty. */
function undockInfiniteCanvasGroupWindow(
  root: InfiniteCanvasGroupNode,
  windowId: string,
): InfiniteCanvasGroupNode | null {
  if (findInfiniteCanvasGroupNode(root, windowId) === null) {
    return root;
  }

  return normalizeGroupTreeOrNull(replaceInfiniteCanvasGroupNode(root, windowId, () => null));
}

/** Moves a child to a new sibling index. */
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

/** Changes container layout while preserving membership and weights. */
function setInfiniteCanvasGroupLayoutMode(
  root: InfiniteCanvasGroupNode,
  input: Readonly<{ containerId: string; layout: InfiniteCanvasGroupLayoutMode }>,
): InfiniteCanvasGroupNode | null {
  const { containerId, layout } = input;

  return normalizeGroupTreeOrNull(
    replaceInfiniteCanvasGroupNode(root, containerId, (node) =>
      isInfiniteCanvasGroupContainer(node) ? { ...node, layout } : node,
    ),
  );
}

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

/** Activates a direct child of a tabs or accordion container. */
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

/** Applies child weights by id so reordering cannot resize the wrong pane. */
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

/** Gives all current children equal weights in one tree mutation. */
function equalizeInfiniteCanvasGroupChildren(
  root: InfiniteCanvasGroupNode,
  containerId: string,
): InfiniteCanvasGroupNode | null {
  return normalizeGroupTreeOrNull(
    replaceInfiniteCanvasGroupNode(root, containerId, (node) => {
      if (!isInfiniteCanvasGroupContainer(node)) {
        return node;
      }

      return {
        ...node,
        children: node.children.map((child) => ({
          ...child,
          weight: DEFAULT_INFINITE_CANVAS_GROUP_WEIGHT,
        })),
      };
    }),
  );
}

function normalizeGroupTreeOrNull(
  node: InfiniteCanvasGroupNode | null,
): InfiniteCanvasGroupNode | null {
  return node === null ? null : normalizeInfiniteCanvasGroupTree(node);
}

export {
  DEFAULT_INFINITE_CANVAS_GROUP_WEIGHT,
  createInfiniteCanvasGroupWindowNode,
  dockInfiniteCanvasGroupWindow,
  equalizeInfiniteCanvasGroupChildren,
  findInfiniteCanvasGroupNode,
  getInfiniteCanvasGroupChildWeightSum,
  getInfiniteCanvasGroupDockAxis,
  getInfiniteCanvasGroupParent,
  getInfiniteCanvasGroupWindowIds,
  hasInfiniteCanvasGroupActiveChild,
  setInfiniteCanvasGroupWindowNodeLayouts,
  isInfiniteCanvasGroupContainer,
  normalizeInfiniteCanvasGroupTree,
  reorderInfiniteCanvasGroupChild,
  replaceInfiniteCanvasGroupNode,
  setInfiniteCanvasGroupActiveChild,
  setInfiniteCanvasGroupAxis,
  setInfiniteCanvasGroupChildWeights,
  setInfiniteCanvasGroupLayoutMode,
  undockInfiniteCanvasGroupWindow,
};
export type {
  InfiniteCanvasGroupAxis,
  InfiniteCanvasGroupContainerNode,
  InfiniteCanvasGroupDockEdge,
  InfiniteCanvasGroupLayoutMode,
  InfiniteCanvasGroupMasonry,
  InfiniteCanvasGroupNode,
  InfiniteCanvasGroupWindowNode,
  InfiniteCanvasGroupWindowNodeLayout,
};
