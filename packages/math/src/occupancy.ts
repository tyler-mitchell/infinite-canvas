import { BitMatrix, defBitMatrix } from "@thi.ng/bitfield";

export type GridPosition = { column: number; row: number };
export type GridSpan = { columns: number; rows: number };
export type GridArea = GridPosition & GridSpan;

// Source: @thi.ng/bitfield@2.4.44 bitmatrix.d.ts:7 (BitMatrix)
//   MxN row-major 2D bit matrix, backed by a Uint8Array.
// The storage, its row-major addressing and its growth are upstream's; only the column bound and
// the placement scan below belong to this package.
export type OccupancyGrid = { columns: number; bits: BitMatrix };

// Source: @thi.ng/bitfield@2.4.44 bitmatrix.d.ts:73 (defBitMatrix)
export function createOccupancyGrid({
  columns,
  rows = 0,
}: {
  columns: number;
  rows?: number | undefined;
}): OccupancyGrid {
  return { columns, bits: defBitMatrix(rows, columns) };
}

// Source: @thi.ng/bitfield@2.4.44 bitmatrix.d.ts:12-13 (BitMatrix.m, the row count)
export function occupancyRows(grid: OccupancyGrid): number {
  return grid.bits.m;
}

// Rows are unbounded because the grid grows downward; columns are not. BitMatrix.at and setAt do no
// bounds checking, so an area past the right edge would read or write the next row.
const areaWithinGrid = (grid: OccupancyGrid, area: GridArea) =>
  area.column >= 0 &&
  area.row >= 0 &&
  area.columns > 0 &&
  area.rows > 0 &&
  area.column + area.columns <= grid.columns;

const rowsOf = (area: GridArea): number[] =>
  Array.from({ length: area.rows }, (_, step) => area.row + step);

// Source: @thi.ng/bitfield@2.4.44 bitmatrix.js:144-151 (BitMatrix.row), whose viewOnly form shares
// the matrix's own subarray, and bitfield.js:229-242 (BitField.firstOne)
//   const b = (i << 3) + Math.clz32(x) - 24;
//   if (b >= from) return b;
//   ... return -1;
// so a row with no set bit at or after the search position answers -1.
export function isAreaFree({ grid, area }: { grid: OccupancyGrid; area: GridArea }): boolean {
  if (!areaWithinGrid(grid, area)) return false;
  const end = area.column + area.columns;
  return rowsOf(area)
    .filter((row) => row < grid.bits.m)
    .every((row) => {
      const taken = grid.bits.row(row, true).firstOne(area.column);
      return taken < 0 || taken >= end;
    });
}

// Source: @thi.ng/bitfield@2.4.44 bitfield.js:126-131 (BitField.fill), bitmatrix.js:144-151
// (BitMatrix.row) and bitmatrix.js:41-52 (BitMatrix.resize). Marks in place and returns the same
// grid. The bits are shared storage, so a caller that needs a second independent pass builds a
// second grid rather than reusing this one.
export function markArea({ grid, area }: { grid: OccupancyGrid; area: GridArea }): OccupancyGrid {
  if (!areaWithinGrid(grid, area)) return grid;
  if (area.row + area.rows > grid.bits.m) grid.bits.resize(area.row + area.rows, grid.columns);
  const end = area.column + area.columns;
  rowsOf(area).forEach((row) => grid.bits.row(row, true).fill(true, area.column, end));
  return grid;
}

// Source: research/sources/gridstack.engine.ts:752-772 (findEmptyPosition), the row-major first-fit
// scan:
//   for (let i = start; !found; ++i) {
//     const x = i % column;
//     const y = Math.floor(i / column);
//     if (x + node.w! > column) continue;
//     ...
//   }
// Two declared differences:
//   1. Upstream walks one row-major counter and derives x and y from it; this nests the loops, so
//      the `x + w > column` skip becomes the inner loop's bound rather than a continue.
//   2. Upstream tests a candidate against a node list with Utils.isIntercepted. This tests a
//      BitMatrix instead. The storage is not upstream's; only the scan order and first-fit rule are.
export function findFreeArea({
  grid,
  span,
  from = { column: 0, row: 0 },
  column,
}: {
  grid: OccupancyGrid;
  span: GridSpan;
  from?: GridPosition | undefined;
  column?: number | undefined;
}): GridPosition | null {
  if (span.columns <= 0 || span.rows <= 0 || span.columns > grid.columns) return null;
  const lastRow = Math.max(occupancyRows(grid), from.row);
  for (let row = from.row; row <= lastRow; row += 1) {
    for (
      let candidateColumn = column ?? (row === from.row ? from.column : 0);
      candidateColumn <= (column ?? grid.columns - span.columns);
      candidateColumn += 1
    ) {
      if (isAreaFree({ grid, area: { column: candidateColumn, row, ...span } }))
        return { column: candidateColumn, row };
    }
  }
  return null;
}
