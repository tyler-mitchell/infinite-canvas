import { type } from "arktype";
import type { Point } from "../geometry";
import { columnItem, columnOptions, resolveColumns } from "./columns";
import type { Layout, Operation } from "./kinds";
import { placeGridItems, type GridPlacementRule } from "./placement";

const gridOptions = type({
  type: "'grid'",
  ...columnOptions,
  rowHeight: "number > 0 | 'square' = 'square'",
  flow: "'dense' | 'sparse' = 'dense'",
  compact: "boolean = false",
});

const gridItem = type({
  ...columnItem,
  "row?": "number.integer >= 0",
  "rowSpan?": "number.integer > 0",
});

type GridInput = Parameters<Layout<typeof gridOptions, typeof gridItem>["size"]>[0];

export function createGrid({ rules = [] }: { rules?: readonly GridPlacementRule[] } = {}): Layout<
  typeof gridOptions,
  typeof gridItem
> {
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
    const { columns, cell, scaled, authored, extent, units, spans } = resolveColumns({
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
        const widthSized =
          target !== undefined && (resized?.child === id || item.columnSpan === undefined);
        const columnSpan = widthSized
          ? Math.min(columns, spans({ length: target.width, size: cell }))
          : scaled(item.columnSpan ?? 1, item.minColumnSpan);
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
        if (target === undefined)
          return {
            id,
            column: item.column,
            row: item.row,
            columnSpan,
            rowSpan,
            changed: false,
            widthSized,
          };
        return {
          id,
          columnSpan,
          rowSpan,
          changed: true,
          widthSized,
          column: Math.max(
            0,
            Math.min(columns - columnSpan, units({ offset: target.x - origin.x, size: cell })),
          ),
          row: Math.max(0, units({ offset: target.y - origin.y, size: rowHeight })),
        };
      });
    const { cells, rows } = placeGridItems({
      columns,
      flow: options.flow,
      compact: options.compact,
      rules,
      items: shown.toSorted((left, right) => Number(right.changed) - Number(left.changed)),
    });
    return {
      cells,
      shown,
      cell,
      rowHeight,
      extent,
      authored,
      resized,
      height: padding * 2 + extent({ span: Math.max(1, rows), size: rowHeight }),
    };
  };
  return {
    options: gridOptions,
    item: gridItem,
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
        height: place({
          options,
          items,
          origin: { x: 0, y: 0 },
          width: width === Infinity ? narrowest : width,
        }).height,
      };
    },
    arrange: ({ options, items, rect, operation }) => {
      const origin = { x: rect.x + options.padding, y: rect.y + options.padding };
      const { cells, shown, cell, rowHeight, extent, authored, resized, height } = place({
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
          ...shown.map(({ id }) => ({
            id,
            visible: true,
            rect: {
              x: origin.x + cells[id].column * (cell + options.gap),
              y: origin.y + cells[id].row * (rowHeight + options.gap),
              width: extent({ span: cells[id].columnSpan, size: cell }),
              height: extent({ span: cells[id].rowSpan, size: rowHeight }),
            },
          })),
          ...items
            .filter(({ item }) => item.hidden)
            .map(({ id }) => ({ id, visible: false, rect })),
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
}

export const grid = createGrid();
