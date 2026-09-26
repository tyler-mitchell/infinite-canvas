import { axes, type Axis, type Rect } from "@hyphened/math/cpu";
import type { Tree } from "./layout/tree";

export type NavigationTarget = { id: string; rect: Rect };

const byReadingOrder = (axis: Axis) => (left: Rect, right: Rect) => {
  const { mainPosition, crossPosition } = axes[axis];
  return left[mainPosition] - right[mainPosition] || left[crossPosition] - right[crossPosition];
};

export function getRoute({
  windows,
  rects,
  roots,
  navigable = {},
  axis = "vertical",
}: {
  windows: Tree;
  rects: Readonly<Record<string, Rect | undefined>>;
  roots: readonly string[];
  navigable?: Readonly<Record<string, boolean>>;
  axis?: Axis;
}): NavigationTarget[] {
  const ordered = (ids: readonly string[]) =>
    ids
      .flatMap((id) => {
        const rect = rects[id];
        return rect === undefined || navigable[id] === false ? [] : [{ id, rect }];
      })
      .toSorted((left, right) => byReadingOrder(axis)(left.rect, right.rect));
  const route = (ids: readonly string[]): NavigationTarget[] =>
    ordered(ids).flatMap((window) => {
      const children = windows[window.id]?.children;
      return children === undefined || children.length === 0 ? [window] : route(children);
    });
  return route(roots);
}
