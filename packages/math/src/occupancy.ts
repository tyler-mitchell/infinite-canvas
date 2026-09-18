export type GridPosition = { column: number; row: number };
export type GridSpan = { columns: number; rows: number };
export type GridArea = GridPosition & GridSpan;

export type OccupancyGrid = { columns: number; words: Uint32Array };

const wordsPerRow = (columns: number) => Math.max(1, Math.ceil(columns / 32));

export function createOccupancyGrid({
  columns,
  rows = 0,
}: {
  columns: number;
  rows?: number | undefined;
}): OccupancyGrid {
  return { columns, words: new Uint32Array(rows * wordsPerRow(columns)) };
}

export function occupancyRows(grid: OccupancyGrid): number {
  return grid.words.length / wordsPerRow(grid.columns);
}

export function isAreaFree({ grid, area }: { grid: OccupancyGrid; area: GridArea }): boolean {
  if (area.column < 0 || area.row < 0 || area.column + area.columns > grid.columns) return false;
  const perRow = wordsPerRow(grid.columns);
  const rows = grid.words.length / perRow;
  const lastRow = Math.min(area.row + area.rows, rows);
  for (let row = area.row; row < lastRow; row++) {
    for (let column = area.column; column < area.column + area.columns; column++) {
      if ((grid.words[row * perRow + (column >> 5)]! & (1 << (column & 31))) !== 0) return false;
    }
  }
  return true;
}

export function markArea({ grid, area }: { grid: OccupancyGrid; area: GridArea }): OccupancyGrid {
  const perRow = wordsPerRow(grid.columns);
  const needed = Math.max(grid.words.length, (area.row + area.rows) * perRow);
  const words = needed > grid.words.length ? new Uint32Array(needed) : grid.words;
  if (words !== grid.words) words.set(grid.words);
  for (let row = area.row; row < area.row + area.rows; row++) {
    for (let column = area.column; column < area.column + area.columns; column++) {
      words[row * perRow + (column >> 5)]! |= 1 << (column & 31);
    }
  }
  return words === grid.words ? grid : { columns: grid.columns, words };
}

export function findFreeArea({
  grid,
  span,
  from = { column: 0, row: 0 },
}: {
  grid: OccupancyGrid;
  span: GridSpan;
  from?: GridPosition | undefined;
}): GridPosition | null {
  if (span.columns <= 0 || span.rows <= 0 || span.columns > grid.columns) return null;
  const lastRow = Math.max(occupancyRows(grid), from.row);
  for (let row = from.row; row <= lastRow; row++) {
    const first = row === from.row ? from.column : 0;
    for (let column = first; column + span.columns <= grid.columns; column++) {
      if (isAreaFree({ grid, area: { column, row, ...span } })) return { column, row };
    }
  }
  return null;
}
