import { type } from "arktype";
import { clamp0, type Point } from "@hyphened/math/cpu";
import { columnItem, columnOptions, columnSize, resolveColumns } from "./columns";
import type { Layout, Operation } from "./kinds";
import { placeGridItems } from "./placement";

const gridOptions = type({
  type: "'grid'",
  ...columnOptions,
  rowHeight: "number > 0 | 'square' = 'square'",
  compact: "boolean = false",
});

const gridItem = type({
  ...columnItem,
  "row?": "number.integer >= 0",
  "rowSpan?": "number.integer > 0",
});

type GridInput = Parameters<Layout<typeof gridOptions, typeof gridItem>["size"]>[0];

const place = ({
  options,
  items,
  width,
  origin,
  operation,
}: Pick<GridInput, "options" | "items"> & {
  width: number;
  origin: Point;
  operation?: Operation;
}) => {
  const { gap, padding } = options;
  const { columns, cell, offsetOf, authored, extent, units, spans, member } = resolveColumns({
    options,
    width,
  });
  const rowHeight = options.rowHeight === "square" ? cell : options.rowHeight;
  const moved = operation?.type === "move" ? operation.rects : {};
  const resized = operation?.type === "resize" ? operation : undefined;
  const shown = items
    .filter(({ item }) => !item.hidden)
    .map(({ id, item, size }) => {
      const target = moved[id] ?? (resized?.child === id ? resized.rect : undefined);
      const {
        span: columnSpan,
        column,
        widthSized,
      } = member({ item, target, originX: origin.x, resizing: resized?.child === id });
      const rowSpan =
        resized?.child === id
          ? spans({ length: resized.rect.height, size: rowHeight })
          : (item.rowSpan ??
            Math.max(
              1,
              Math.ceil(
                (size({ width: extent({ span: columnSpan, size: cell }) }).height + gap) /
                  (rowHeight + gap),
              ),
            ));
      const row =
        target === undefined
          ? item.row
          : clamp0(units({ offset: target.y - origin.y, size: rowHeight }));
      return {
        id,
        column,
        row,
        columnSpan,
        rowSpan,
        widthSized,
        changed:
          target !== undefined &&
          (column !== item.column ||
            row !== item.row ||
            (resized?.child === id &&
              (columnSpan !== item.columnSpan || rowSpan !== item.rowSpan))),
      };
    });
  const { cells, rows } = placeGridItems({
    columns,
    compact: options.compact,
    items: shown.toSorted((left, right) => Number(right.changed) - Number(left.changed)),
  });
  return {
    cells,
    shown,
    cell,
    offsetOf,
    rowHeight,
    extent,
    authored,
    resized,
    height: padding * 2 + extent({ span: Math.max(1, rows), size: rowHeight }),
  };
};
export const grid: Layout<typeof gridOptions, typeof gridItem> = {
  options: gridOptions,
  item: gridItem,
  accepts: ["move", "resize"],
  pins: ["column", "row"],
  dock: () => ({ place: "append" }),
  size: ({ options, items, proposal }) =>
    columnSize({
      options,
      items,
      proposal,
      height: (width) => place({ options, items, origin: { x: 0, y: 0 }, width }).height,
    }),
  arrange: ({ options, items, rect, operation }) => {
    const origin = { x: rect.x + options.padding, y: rect.y + options.padding };
    const { cells, shown, cell, offsetOf, rowHeight, extent, authored, resized, height } = place({
      options,
      items,
      width: rect.width,
      origin,
      operation,
    });
    const displaced = (entry: (typeof shown)[number]) =>
      entry.column !== undefined &&
      entry.row !== undefined &&
      (entry.column !== cells[entry.id].column || entry.row !== cells[entry.id].row);
    const changed =
      operation === undefined ? [] : shown.filter((entry) => entry.changed || displaced(entry));
    return {
      size: { width: rect.width, height },
      controls: [],
      children: [
        ...shown.map(({ id }) => {
          const track = {
            width: extent({ span: cells[id].columnSpan, size: cell }),
            height: extent({ span: cells[id].rowSpan, size: rowHeight }),
          };
          const own = items.find((entry) => entry.id === id)?.size;
          const fitted = own?.({ width: track.width, height: track.height });
          const width = Math.min(track.width, fitted?.width ?? track.width);
          const height = Math.min(track.height, fitted?.height ?? track.height);
          return {
            id,
            visible: true,
            rect: {
              x:
                origin.x +
                offsetOf({ index: cells[id].column, size: cell }) +
                (track.width - width) / 2,
              y:
                origin.y +
                offsetOf({ index: cells[id].row, size: rowHeight }) +
                (track.height - height) / 2,
              width,
              height,
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
                changed.map(({ id, widthSized }) => [
                  id,
                  {
                    column: cells[id].column,
                    row: cells[id].row,
                    ...(widthSized ? { columnSpan: authored(cells[id].columnSpan) } : {}),
                    ...(resized?.child === id ? { rowSpan: cells[id].rowSpan } : {}),
                  },
                ]),
              ),
            },
          }),
    };
  },
};
