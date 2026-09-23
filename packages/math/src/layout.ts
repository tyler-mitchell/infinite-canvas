import { argminT } from "@thi.ng/distance";
import { StackedLayout } from "@thi.ng/layout";
import { clamp0 } from "@thi.ng/math";
import { translateRect, type Rect, type ResizeHandle } from "./rect";
import { columnOptions, resolveColumns, type ColumnLayoutItem } from "./columns";
import type { Point } from "./vector";

export type LayoutOperation =
  | { type: "sash"; index: number; delta: number; sizes: readonly number[] }
  | { type: "move"; rects: Readonly<Record<string, Rect>> }
  | { type: "resize"; child: string; rect: Rect; handle: ResizeHandle };

export type { CellSpan, IGridLayout, ILayout, LayoutBox } from "@thi.ng/layout";
export {
  GridLayout,
  gridLayout,
  isLayout,
  layoutBox,
  StackedLayout,
  stackedLayout,
} from "@thi.ng/layout";

export type LaneItem = { id: string; span: number; height: number };
export type Lane = { id: string; column: number; y: number };

export function placeLanes({
  columns,
  gap,
  items,
}: {
  columns: number;
  gap: number;
  items: readonly LaneItem[];
}): readonly Lane[] {
  const layout = new StackedLayout(null, 0, 0, columns, columns, 1, 0, 0);
  return items.map((item) => {
    const box = layout.next([item.span, Math.ceil(clamp0(item.height) + gap)]);
    return { id: item.id, column: box.x, y: box.y };
  });
}

export function closestRect({
  rect,
  candidates,
}: {
  rect: Rect;
  candidates: readonly Rect[];
}): number {
  return argminT(rect, [...candidates], ({ x, y, width, height }) => [
    x + width / 2,
    y + height / 2,
  ]);
}

export const arrangeLanes = ({
  options,
  items,
  width,
  origin = { x: 0, y: 0 },
  operation,
}: { options: typeof columnOptions.infer; items: readonly ColumnLayoutItem[] } & {
  width: number;
  origin?: Point;
  operation?: LayoutOperation;
}) => {
  const { gap, padding } = options;
  const { columns, geometry, authored, member } = resolveColumns({ options, width });
  const moved = operation?.type === "move" ? operation.rects : {};
  const resized = operation?.type === "resize" ? operation : undefined;
  const shown = items
    .filter(({ item }) => !item.hidden)
    .map(({ id, item, size }) => {
      const target = moved[id] ?? (resized?.child === id ? resized.rect : undefined);
      const { span } = member({
        item,
        target,
        originX: origin.x,
        resizing: resized?.child === id,
      });
      return {
        id,
        span,
        changed: target !== undefined,
        height: size({
          width: geometry.rect({ column: 0, row: 0, columnSpan: span, rowSpan: 1 }).width,
          ...(resized?.child === id && resized.handle !== "east" && resized.handle !== "west"
            ? { height: resized.rect.height }
            : {}),
        }).height,
      };
    });
  const entries = new Map(shown.map((entry) => [entry.id, entry]));
  const placement = ({ id, column, y }: ReturnType<typeof placeLanes>[number]) => {
    const entry = entries.get(id)!;
    return {
      ...entry,
      column,
      rect: {
        ...translateRect(
          geometry.rect({ column, row: 0, columnSpan: entry.span, rowSpan: 1 }),
          origin,
        ),
        y: origin.y + padding + y,
        height: clamp0(entry.height),
      },
    };
  };
  const settled = placeLanes({ columns, gap, items: shown }).map(placement);
  const moving = shown.filter(({ id }) => moved[id] !== undefined);
  const first = moving[0];
  const at =
    first === undefined
      ? -1
      : closestRect({
          rect: moved[first.id],
          candidates: settled.map(({ rect }) => rect),
        });
  const ids = shown.map(({ id }) => id);
  const staying = ids.filter((id) => moved[id] === undefined);
  const reorder = at >= 0 && moved[ids[at]] === undefined;
  const insertion =
    ids.slice(0, at).filter((id) => moved[id] === undefined).length +
    (first !== undefined && ids.indexOf(first.id) < at ? 1 : 0);
  const order = reorder ? staying.toSpliced(insertion, 0, ...moving.map(({ id }) => id)) : ids;
  const lanes = reorder
    ? placeLanes({ columns, gap, items: order.map((id) => entries.get(id)!) }).map(placement)
    : settled;
  const height =
    padding * 2 +
    Math.max(0, ...lanes.map(({ rect }) => rect.y - origin.y - padding + rect.height));
  return {
    height,
    rects: Object.fromEntries(lanes.map(({ id, rect }) => [id, rect])),
    items: Object.fromEntries(
      lanes
        .filter((entry) => entry.changed)
        .map(({ id, column, span }) => [
          id,
          { column: authored(column), columnSpan: authored(span) },
        ]),
    ),
    order: order.some((id, index) => id !== ids[index]) ? order : undefined,
  };
};
