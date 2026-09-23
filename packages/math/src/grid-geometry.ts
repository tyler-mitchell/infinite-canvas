import type { GridCell } from "./grid";
import type { Point } from "./vector";
import type { Rect } from "./rect";
import type { Size } from "./size";
import type { ResizeHandle } from "./rect";
import { gridLayout } from "@thi.ng/layout";
import { clamp0 } from "@thi.ng/math";

export type GridGeometry = {
  columns: number;
  width: number;
  rowHeight: number | "square";
  gap: readonly [number, number];
  padding: readonly [number, number];
};

export function gridCellsOverlap({ a, b }: { a: GridCell; b: GridCell }): boolean {
  return (
    a.column < b.column + b.columnSpan &&
    a.column + a.columnSpan > b.column &&
    a.row < b.row + b.rowSpan &&
    a.row + a.rowSpan > b.row
  );
}

export function gridRows(cells: readonly GridCell[]): number {
  return cells.reduce((rows, cell) => Math.max(rows, cell.row + cell.rowSpan), 0);
}

export function boundGridCell({
  cell,
  columns,
  rows = Infinity,
}: {
  cell: GridCell;
  columns: number;
  rows?: number;
}): GridCell {
  const columnSpan = Math.min(columns, Math.max(1, cell.columnSpan));
  const rowSpan = Math.min(rows, Math.max(1, cell.rowSpan));
  return {
    columnSpan,
    rowSpan,
    column: Math.max(0, Math.min(cell.column, columns - columnSpan)),
    row: Math.max(0, Math.min(cell.row, rows - rowSpan)),
  };
}

export function resizeGridCell({
  cell,
  span,
  handle,
  columns,
  rows,
}: {
  cell: GridCell;
  span: Pick<GridCell, "columnSpan" | "rowSpan">;
  handle: ResizeHandle;
  columns: number;
  rows: number;
}) {
  const width = handle.includes("west") ? cell.column + cell.columnSpan : columns - cell.column;
  const height = handle.includes("north") ? cell.row + cell.rowSpan : rows - cell.row;
  const columnSpan = Math.max(1, Math.min(span.columnSpan, width));
  const rowSpan = Math.max(1, Math.min(span.rowSpan, height));
  return {
    column: handle.includes("west") ? cell.column + cell.columnSpan - columnSpan : cell.column,
    row: handle.includes("north") ? cell.row + cell.rowSpan - rowSpan : cell.row,
    columnSpan,
    rowSpan,
  };
}

// Uniform tracks use affine coordinates. Quantization applies only to cell indices.
export function gridGeometry({ columns, width, rowHeight, gap, padding }: GridGeometry) {
  const columnWidth = clamp0(
    gridLayout(0, 0, clamp0(width - 2 * padding[0]), columns, 1, gap[0], gap[1]).cellW,
  );
  const cell = { width: columnWidth, height: rowHeight === "square" ? columnWidth : rowHeight };
  const step = { width: cell.width + gap[0], height: cell.height + gap[1] };
  return {
    cell,
    step,
    position: ({ x, y }: Point) => ({
      column: Math.round((x - padding[0]) / step.width),
      row: Math.round((y - padding[1]) / step.height),
    }),
    span: ({
      width,
      height,
      round = Math.round,
    }: Size & { round?: (value: number) => number }) => ({
      columnSpan: Math.max(1, round((width + gap[0]) / step.width)),
      rowSpan: Math.max(1, round((height + gap[1]) / step.height)),
    }),
    rect: ({ column, row, columnSpan, rowSpan }: GridCell): Rect => {
      const x = column * step.width + padding[0];
      const y = row * step.height + padding[1];
      return {
        x,
        y,
        width: columnSpan * step.width - gap[0],
        height: rowSpan * step.height - gap[1],
      };
    },
  };
}
