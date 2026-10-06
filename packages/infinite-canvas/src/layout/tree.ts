import { mapPoint, min4id, type Point, type Rect } from "@hyphened/math/cpu";
import type { BoundLayout, LayoutNode } from "./arrange";
import type { DockEdge } from "./kinds";

export type TreeNode = LayoutNode & { kind?: string };
export type Tree = Readonly<Record<string, TreeNode>>;
export type Layouts = Readonly<Record<string, BoundLayout>>;

export type TreeChange = {
  windows: Tree;
  wrapper?: { id: string; around: string };
  dissolved: { id: string; into: string | null }[];
};

export const getParents = (windows: Tree): Record<string, string> =>
  Object.fromEntries(
    Object.entries(windows).flatMap(([id, window]) =>
      (window.children ?? []).map((child) => [child, id]),
    ),
  );

export const getDescendants = ({ windows, id }: { windows: Tree; id: string }): string[] =>
  (windows[id]?.children ?? []).flatMap((child) => [
    child,
    ...getDescendants({ windows, id: child }),
  ]);

export function getReorderedChildren({
  children,
  child,
  target,
  after,
}: {
  children: readonly string[];
  child: string;
  target: string;
  after: boolean;
}): string[] {
  const from = children.indexOf(child);
  const to = children.indexOf(target);
  if (from < 0 || to < 0 || from === to) return [...children];
  const insertion = to + Number(after);
  return children.toSpliced(from, 1).toSpliced(insertion - Number(from < insertion), 0, child);
}

export function getDockEdge({
  rect,
  point,
  zone,
}: {
  rect: Rect;
  point: Point;
  zone: number;
}): DockEdge {
  const { x, y } = mapPoint(rect, point);
  const distances = [x, 1 - x, y, 1 - y] as const;
  const nearest = min4id(...distances);
  return distances[nearest]! <= zone
    ? (["west", "east", "north", "south"] as const)[nearest]!
    : "center";
}

const without = ({ item: _, ...node }: TreeNode): TreeNode => node;
const layoutOf = ({ layouts, node }: { layouts: Layouts; node: TreeNode | undefined }) =>
  node?.layout === undefined ? undefined : layouts[node.layout.type];

export function getDockChange({
  windows,
  layouts,
  window,
  target,
  edge,
  wrapper,
}: {
  windows: Tree;
  layouts: Layouts;
  window: string;
  target: string;
  edge: DockEdge;
  wrapper: { id: string; layout: NonNullable<TreeNode["layout"]> };
}): TreeChange {
  const node = windows[target];
  const moved = without(windows[window]);
  const itemsOf = (container: TreeNode) =>
    (container.children ?? []).map((child) => windows[child].item);
  const into =
    edge !== "center"
      ? undefined
      : layoutOf({ layouts, node })?.dock({ options: node.layout, edge, items: itemsOf(node) });
  if (into?.place === "append")
    return {
      dissolved: [],
      windows: {
        ...windows,
        [window]: into.window === undefined ? moved : { ...moved, item: into.window },
        [target]: { ...node, children: [...(node.children ?? []), window] },
      },
    };
  const parentId = getParents(windows)[target];
  const parent = parentId === undefined ? undefined : windows[parentId];
  const beside =
    parent === undefined
      ? undefined
      : layoutOf({ layouts, node: parent })?.dock({
          options: parent.layout,
          edge,
          target: node.item ?? {},
          items: itemsOf(parent),
        });
  if (parentId !== undefined && parent !== undefined && beside !== undefined) {
    const joined = beside.place === "before" ? [window, target] : [target, window];
    const children = parent.children ?? [];
    return {
      dissolved: [],
      windows: {
        ...windows,
        [target]:
          beside.target === undefined
            ? node
            : { ...node, item: { ...node.item, ...beside.target } },
        [window]: beside.window === undefined ? moved : { ...moved, item: beside.window },
        [parentId]: {
          ...parent,
          children:
            beside.place === "append"
              ? [...children, window]
              : children.flatMap((child) => (child === target ? joined : [child])),
        },
      },
    };
  }
  const leading = edge === "north" || edge === "west";
  return {
    dissolved: [],
    wrapper: { id: wrapper.id, around: target },
    windows: {
      ...windows,
      [window]: moved,
      [target]: without(node),
      [wrapper.id]: {
        layout: wrapper.layout,
        children: leading ? [window, target] : [target, window],
        ...(node.item === undefined ? {} : { item: node.item }),
      },
      ...(parentId === undefined || parent === undefined
        ? {}
        : {
            [parentId]: {
              ...parent,
              children: (parent.children ?? []).map((child) =>
                child === target ? wrapper.id : child,
              ),
            },
          }),
    },
  };
}

export function getUndockChange({
  windows,
  layouts,
  window,
}: {
  windows: Tree;
  layouts: Layouts;
  window: string;
}): TreeChange {
  const settle = ({ windows, id, dissolved }: TreeChange & { id: string }): TreeChange => {
    const node = windows[id];
    const children = node.children ?? [];
    const parentId = getParents(windows)[id];
    const parent = parentId === undefined ? undefined : windows[parentId];
    const replace = (replacement: readonly string[]) =>
      parentId === undefined || parent === undefined
        ? {}
        : {
            [parentId]: {
              ...parent,
              children: (parent.children ?? []).flatMap((child) =>
                child === id ? replacement : [child],
              ),
            },
          };
    const { [id]: _, ...rest } = windows;
    if (node.kind !== undefined || node.layout === undefined) return { windows, dissolved };
    if (children.length === 0) {
      const next = {
        windows: { ...rest, ...replace([]) },
        dissolved: [...dissolved, { id, into: null }],
      };
      return parentId === undefined ? next : settle({ ...next, id: parentId });
    }
    if (layoutOf({ layouts, node })?.collapses !== true || children.length > 1)
      return { windows, dissolved };
    const [only] = children;
    const promoted = windows[only];
    const inner = promoted.children ?? [];
    const absorbed =
      parent?.layout === undefined ||
      promoted.layout?.type !== parent.layout.type ||
      promoted.kind !== undefined
        ? undefined
        : layoutOf({ layouts, node: parent })?.absorb({
            options: parent.layout,
            slot: node.item,
            child: promoted.layout,
            items: inner.map((child) => windows[child].item),
          });
    if (absorbed !== undefined) {
      const { [only]: __, ...remaining } = rest;
      return {
        dissolved: [...dissolved, { id, into: null }, { id: only, into: null }],
        windows: {
          ...remaining,
          ...replace(inner),
          ...Object.fromEntries(
            inner.map((child, index) => [
              child,
              { ...windows[child], item: { ...windows[child].item, ...absorbed[index] } },
            ]),
          ),
        },
      };
    }
    return {
      dissolved: [...dissolved, { id, into: only }],
      windows: {
        ...rest,
        ...replace([only]),
        [only]: node.item === undefined ? without(promoted) : { ...promoted, item: node.item },
      },
    };
  };
  const parentId = getParents(windows)[window];
  if (parentId === undefined) return { windows, dissolved: [] };
  const parent = windows[parentId];
  return settle({
    id: parentId,
    dissolved: [],
    windows: {
      ...windows,
      [window]: without(windows[window]),
      [parentId]: {
        ...parent,
        children: (parent.children ?? []).filter((child) => child !== window),
      },
    },
  });
}
