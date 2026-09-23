import { clamp, inRange, minMax } from "@thi.ng/math";
import { resolveGrid } from "./grid-motion";
import { gridRows } from "./grid-geometry";
import { translateRect, type ResizeHandle } from "./rect";
import { columnItem, columnOptions, resolveColumns, type ColumnLayoutItem } from "./columns";
import type { LayoutOperation } from "./layout";
import type { Point } from "./vector";
import {
  createOccupancyGrid,
  findFreeArea,
  isAreaFree,
  markArea,
  occupancyRows,
  type GridArea,
} from "./occupancy";

export type GridItem = {
  id: string;
  column?: number;
  row?: number;
  columnSpan: number;
  rowSpan: number;
};
export type GridCell = { column: number; row: number; columnSpan: number; rowSpan: number };
export type GridTarget = GridCell & { handle?: ResizeHandle };

export const gridOptions = columnOptions.merge({
  rowHeight: "number > 0 | 'square' = 'square'",
  compact: "boolean = false",
});

export const gridItemOptions = columnItem.merge({
  "row?": "number.integer >= 0",
  "rowSpan?": "number.integer > 0",
});

export function arrangeGrid({
  options,
  items,
  width,
  origin = { x: 0, y: 0 },
  operation,
}: {
  options: typeof gridOptions.infer;
  items: readonly ColumnLayoutItem<typeof gridItemOptions.infer>[];
  width: number;
  origin?: Point;
  operation?: LayoutOperation;
}) {
  const { padding } = options;
  const { columns, geometry, authored, member } = resolveColumns({
    options,
    width,
    rowHeight: options.rowHeight,
  });
  const moved = operation?.type === "move" ? operation.rects : {};
  const resized = operation?.type === "resize" ? operation : undefined;
  const shown = items
    .filter(({ item }) => !item.hidden)
    .map(({ id, item, size }) => {
      const proposal = moved[id] ?? (resized?.child === id ? resized.rect : undefined);
      const target = proposal === undefined ? undefined : { ...proposal, ...size(proposal) };
      const { span, column } = member({
        item,
        target: undefined,
        originX: origin.x,
        resizing: false,
      });
      const bounds = geometry.rect({
        column: 0,
        row: 0,
        columnSpan: span,
        rowSpan: item.rowSpan ?? 1,
      });
      const fitted = size({
        width: bounds.width,
        ...(item.rowSpan === undefined ? {} : { height: bounds.height }),
      });
      const columnSpan = geometry.span(fitted).columnSpan;
      const rowSpan = geometry.span({
        ...fitted,
        round: item.rowSpan === undefined ? Math.ceil : Math.round,
      }).rowSpan;
      const destination = member({
        item: {
          ...item,
          columnSpan: item.columnSpan === undefined ? undefined : authored(columnSpan),
        },
        target,
        originX: origin.x,
        resizing: resized?.child === id,
      });
      return {
        id,
        item,
        column,
        row: item.row,
        columnSpan,
        rowSpan,
        target:
          target === undefined
            ? undefined
            : {
                handle: resized?.child === id ? resized.handle : undefined,
                column: destination.column!,
                row: geometry.position({ x: target.x - origin.x, y: target.y - origin.y }).row,
                columnSpan: destination.span,
                rowSpan: resized?.child === id ? geometry.span(target).rowSpan : rowSpan,
              },
      };
    });
  const { cells, rows } = placeGridItems({
    columns,
    compact: options.compact,
    items: shown,
    targets: Object.fromEntries(
      shown.flatMap(({ id, target }) => (target === undefined ? [] : [[id, target]])),
    ),
  });
  const changed =
    operation === undefined
      ? []
      : shown.filter(
          (entry) =>
            entry.target !== undefined ||
            entry.column !== cells[entry.id].column ||
            entry.row !== cells[entry.id].row,
        );
  return {
    rects: Object.fromEntries(
      shown.map(({ id }) => [id, translateRect(geometry.rect(cells[id]), origin)]),
    ),
    items: Object.fromEntries(
      changed.map(({ id, item }) => [
        id,
        {
          column: authored(cells[id].column),
          row: cells[id].row,
          columnSpan: authored(cells[id].columnSpan),
          ...(resized?.child === id || item.rowSpan !== undefined
            ? { rowSpan: cells[id].rowSpan }
            : {}),
        },
      ]),
    ),
    height:
      padding * 2 +
      geometry.rect({
        column: 0,
        row: 0,
        columnSpan: columns,
        rowSpan: Math.max(1, rows),
      }).height,
  };
}

const areaOf = (cell: GridCell): GridArea => ({
  column: cell.column,
  row: cell.row,
  columns: cell.columnSpan,
  rows: cell.rowSpan,
});

export function placeGridSequence({
  columns,
  items,
}: {
  columns: number;
  items: readonly (GridCell & { id: string })[];
}): Record<string, GridCell> {
  const grid = createOccupancyGrid({ columns });
  return items
    .toSorted((a, b) => a.row - b.row || a.column - b.column)
    .reduce<{ cells: Record<string, GridCell>; from: { column: number; row: number } }>(
      ({ cells, from }, item) => {
        const span = {
          columns: Math.min(columns, Math.max(1, item.columnSpan)),
          rows: Math.max(1, item.rowSpan),
        };
        const position = findFreeArea({ grid, span, from })!;
        markArea({ grid, area: { ...position, ...span } });
        return {
          cells: {
            ...cells,
            [item.id]: { ...position, columnSpan: span.columns, rowSpan: span.rows },
          },
          from: { column: position.column + span.columns, row: position.row },
        };
      },
      { cells: {}, from: { column: 0, row: 0 } },
    ).cells;
}

export function placeGridItems({
  columns,
  items,
  compact = false,
  targets = {},
}: {
  columns: number;
  items: readonly GridItem[];
  compact?: boolean;
  targets?: Readonly<Record<string, GridTarget>>;
}): { cells: Record<string, GridCell>; rows: number } {
  const placed: Record<string, GridCell> = {};
  const grid = createOccupancyGrid({ columns });
  const commit = ({ id, ...cell }: GridCell & { id: string }) => {
    placed[id] = cell;
    markArea({ grid, area: areaOf(cell) });
  };
  const sized = items.map((item) => {
    const columnSpan = clamp(item.columnSpan, ...minMax(1, columns));
    const placeable = item.column !== undefined && inRange(item.column, 0, columns - columnSpan);
    return {
      id: item.id,
      columnSpan,
      rowSpan: Math.max(1, item.rowSpan),
      ...(placeable ? { column: item.column } : {}),
      ...(placeable && item.row !== undefined && item.row >= 0 ? { row: item.row } : {}),
    };
  });
  for (const item of sized) {
    if (item.column === undefined || item.row === undefined) continue;
    const cell = { ...item, column: item.column, row: item.row };
    if (isAreaFree({ grid, area: areaOf(cell) })) commit(cell);
  }
  for (const item of sized) {
    if (placed[item.id] !== undefined) continue;
    const span = { columns: item.columnSpan, rows: item.rowSpan };
    const found = findFreeArea({ grid, span, column: item.column });
    commit({
      ...item,
      column: found?.column ?? item.column ?? 0,
      row: found?.row ?? occupancyRows(grid),
    });
  }
  const cells = resolveGrid({ cells: placed, targets, compact, columns });
  return {
    cells,
    rows: gridRows(Object.values(cells)),
  };
}
