import { type } from "arktype";
import { columnItem, columnOptions, resolveColumns } from "./columns";
import type { Layout, Operation } from "./kinds";

export type LaneItem = { id: string; span: number; height: number; column?: number };
export type Lane = { id: string; column: number; y: number };

type Progress = { running: readonly number[]; cursor: number; lanes: readonly Lane[] };

export function placeLanes({
  columns,
  gap,
  tolerance,
  items,
}: {
  columns: number;
  gap: number;
  tolerance: number;
  items: readonly LaneItem[];
}): readonly Lane[] {
  const start: Progress = {
    running: Array.from({ length: columns }, () => 0),
    cursor: 0,
    lanes: [],
  };
  return items.reduce<Progress>((progress, item) => {
    const maxPos = (line: number) => Math.max(...progress.running.slice(line, line + item.span));
    const lines = Array.from({ length: Math.max(1, columns - item.span + 1) }, (_, line) => line);
    const smallest = Math.min(...lines.map(maxPos));
    const possible = lines.filter((line) => maxPos(line) <= smallest + tolerance);
    const line =
      item.column ?? possible.find((candidate) => candidate >= progress.cursor) ?? possible[0];
    const y = maxPos(line);
    return {
      running: progress.running.map((value, track) =>
        track >= line && track < line + item.span ? y + Math.max(0, item.height) + gap : value,
      ),
      cursor: item.column === undefined ? line + item.span : progress.cursor,
      lanes: [...progress.lanes, { id: item.id, column: line, y }],
    };
  }, start).lanes;
}

const lanesOptions = type({ type: "'lanes'", ...columnOptions, tolerance: "number >= 0 = 0" });
const lanesItem = type(columnItem);

type LanesInput = Parameters<Layout<typeof lanesOptions, typeof lanesItem>["size"]>[0];

const stack = ({
  options,
  items,
  width,
  operation,
}: Pick<LanesInput, "options" | "items"> & { width: number; operation?: Operation }) => {
  const { gap, padding, tolerance } = options;
  const { columns, cell, scaled, authored, extent, units, spans } = resolveColumns({
    options,
    width,
  });
  const moved = operation?.type === "move" ? operation.rects : {};
  const resized = operation?.type === "resize" ? operation : undefined;
  const shown = items
    .filter(({ item }) => !item.hidden)
    .map(({ id, item, size }) => {
      const target = moved[id] ?? (resized?.child === id ? resized.rect : undefined);
      const widthSized =
        target !== undefined && (resized?.child === id || item.columnSpan === undefined);
      const span = widthSized
        ? Math.min(columns, spans({ length: target.width, size: cell }))
        : scaled(item.columnSpan ?? 1, item.minColumnSpan);
      const column =
        target === undefined
          ? item.column
          : Math.max(
              0,
              Math.min(columns - span, units({ offset: target.x - padding, size: cell })),
            );
      return {
        id,
        span,
        column: column === undefined || column + span > columns ? undefined : column,
        widthSized,
        changed: target !== undefined,
        height: size({ width: extent({ span, size: cell }) }).height,
        target,
      };
    });
  const staying = shown.filter(({ target }) => target === undefined);
  const settled = placeLanes({ columns, gap, tolerance, items: staying });
  const order = shown
    .filter(({ target }) => target !== undefined)
    .reduce(
      (ids, mover) => {
        const at = ids.findIndex((id) => {
          const entry = shown.find((candidate) => candidate.id === id)!;
          const lane = settled.find((candidate) => candidate.id === id);
          return (
            lane !== undefined && lane.y + Math.max(0, entry.height) / 2 > mover.target!.y - padding
          );
        });
        return ids.toSpliced(at < 0 ? ids.length : at, 0, mover.id);
      },
      staying.map(({ id }) => id),
    );
  const lanes = placeLanes({
    columns,
    gap,
    tolerance,
    items: order.map((id) => shown.find((entry) => entry.id === id)!),
  });
  const height =
    padding * 2 +
    Math.max(
      0,
      ...lanes.map((lane) => lane.y + Math.max(0, shown.find(({ id }) => id === lane.id)!.height)),
    );
  return { lanes, shown, cell, extent, authored, height, order };
};

export const lanes: Layout<typeof lanesOptions, typeof lanesItem> = {
  options: lanesOptions,
  item: lanesItem,
  accepts: ["move", "resize"],
  dock: () => ({ place: "append" }),
  size: ({ options, items, proposal }) => {
    const narrowest =
      options.padding * 2 +
      Math.max(
        0,
        ...items.filter(({ item }) => !item.hidden).map(({ size }) => size({ width: 0 }).width),
      );
    const width = Math.max(narrowest, proposal.width ?? narrowest);
    return {
      width,
      height: stack({ options, items, width: width === Infinity ? narrowest : width }).height,
    };
  },
  arrange: ({ options, items, rect, operation }) => {
    const { lanes, shown, cell, extent, authored, height, order } = stack({
      options,
      items,
      width: rect.width,
      operation,
    });
    const changed = shown.filter((entry) => entry.changed);
    const visible = items.filter(({ item }) => !item.hidden).map(({ id }) => id);
    const reordered = order.some((id, index) => id !== visible[index]);
    return {
      size: { width: rect.width, height },
      controls: [],
      children: [
        ...lanes.map(({ id, column, y }) => {
          const entry = shown.find((candidate) => candidate.id === id)!;
          return {
            id,
            visible: true,
            rect: {
              x: rect.x + options.padding + column * (cell + options.gap),
              y: rect.y + options.padding + y,
              width: extent({ span: entry.span, size: cell }),
              height: Math.max(0, entry.height),
            },
          };
        }),
        ...items.filter(({ item }) => item.hidden).map(({ id }) => ({ id, visible: false, rect })),
      ],
      ...(changed.length === 0
        ? {}
        : {
            changes: {
              items: Object.fromEntries(
                changed.map(({ id, widthSized, span }) => [
                  id,
                  {
                    column: lanes.find((lane) => lane.id === id)!.column,
                    ...(widthSized ? { columnSpan: authored(span) } : {}),
                  },
                ]),
              ),
              ...(reordered
                ? {
                    children: [
                      ...order,
                      ...items.filter(({ item }) => item.hidden).map(({ id }) => id),
                    ],
                  }
                : {}),
            },
          }),
    };
  },
};
