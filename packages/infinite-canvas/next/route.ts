import { axes, type Axis, type Rect } from "@hyphened/math/cpu";
import type { Tree } from "./layout/tree";

export type Section = { id: string; rect: Rect };

const byReadingOrder = (axis: Axis) => (left: Rect, right: Rect) => {
  const { mainPosition, crossPosition } = axes[axis];
  return left[mainPosition] - right[mainPosition] || left[crossPosition] - right[crossPosition];
};

export function getRoute({
  windows,
  rects,
  roots,
  sections = {},
  axis = "vertical",
}: {
  windows: Tree;
  rects: Readonly<Record<string, Rect | undefined>>;
  roots: readonly string[];
  sections?: Readonly<Record<string, boolean>>;
  axis?: Axis;
}): Section[] {
  const ordered = (ids: readonly string[]) =>
    ids
      .flatMap((id) => {
        const rect = rects[id];
        return rect === undefined || sections[id] === false ? [] : [{ id, rect }];
      })
      .toSorted((left, right) => byReadingOrder(axis)(left.rect, right.rect));
  const route = (ids: readonly string[]): Section[] =>
    ordered(ids).flatMap((section) => {
      const children = windows[section.id]?.children;
      return children === undefined || children.length === 0 ? [section] : route(children);
    });
  return route(roots);
}
