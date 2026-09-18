export type GridItem = {
  id: string;
  column?: number;
  row?: number;
  columnSpan: number;
  rowSpan: number;
};
export type GridCell = { column: number; row: number; columnSpan: number; rowSpan: number };
export type GridPlacementRule = (input: {
  item: GridItem;
  cell: GridCell;
  placed: Readonly<Record<string, GridCell>>;
}) => boolean;

type Progress = {
  placed: Record<string, GridCell>;
  occupied: ReadonlySet<number>;
  rows: number;
  cursor: number;
};

export function placeGridItems({
  columns,
  items,
  flow = "dense",
  compact = false,
  rules = [],
}: {
  columns: number;
  items: readonly GridItem[];
  flow?: "dense" | "sparse";
  compact?: boolean;
  rules?: readonly GridPlacementRule[];
}): { cells: Record<string, GridCell>; rows: number } {
  const cellsOf = ({ column, row, columnSpan, rowSpan }: GridCell) =>
    Array.from(
      { length: columnSpan * rowSpan },
      (_, index) =>
        (row + Math.floor(index / columnSpan)) * columns + column + (index % columnSpan),
    );
  const free = ({ occupied, cell }: { occupied: ReadonlySet<number>; cell: GridCell }) =>
    cellsOf(cell).every((index) => !occupied.has(index));
  const commit = ({
    progress,
    item,
    cell,
    cursor,
  }: {
    progress: Progress;
    item: GridItem;
    cell: GridCell;
    cursor: number;
  }): Progress => ({
    placed: { ...progress.placed, [item.id]: cell },
    occupied: new Set([...progress.occupied, ...cellsOf(cell)]),
    rows: Math.max(progress.rows, cell.row + cell.rowSpan),
    cursor,
  });
  const sized = items.map((item) => {
    const columnSpan = Math.min(Math.max(1, item.columnSpan), columns);
    const inRange =
      item.column !== undefined && item.column >= 0 && item.column + columnSpan <= columns;
    return {
      id: item.id,
      columnSpan,
      rowSpan: Math.max(1, item.rowSpan),
      ...(inRange ? { column: item.column } : {}),
      ...(inRange && item.row !== undefined && item.row >= 0 ? { row: item.row } : {}),
    };
  });
  const preferred = ({
    progress,
    item,
    candidates,
  }: {
    progress: Progress;
    item: GridItem;
    candidates: readonly GridCell[];
  }) =>
    [...rules, () => true].reduce<GridCell | undefined>(
      (found, rule) =>
        found ?? candidates.find((cell) => rule({ item, cell, placed: progress.placed })),
      undefined,
    );
  const isDefinite = (item: GridItem) => item.column !== undefined && item.row !== undefined;
  const start: Progress = { placed: {}, occupied: new Set(), rows: 0, cursor: 0 };
  const definite = sized.reduce((progress, item) => {
    const cell = {
      column: item.column ?? 0,
      row: item.row ?? 0,
      columnSpan: item.columnSpan,
      rowSpan: item.rowSpan,
    };
    return isDefinite(item) && free({ occupied: progress.occupied, cell })
      ? commit({ progress, item, cell, cursor: 0 })
      : progress;
  }, start);
  const placed = sized
    .filter((item) => definite.placed[item.id] === undefined)
    .reduce((progress, item) => {
      const first = flow === "sparse" ? progress.cursor : 0;
      const last = (progress.rows + 1) * columns;
      const candidates = Array.from(
        { length: Math.max(0, last - first) + 1 },
        (_, offset) => first + offset,
      )
        .filter(
          (index) =>
            (index % columns) + item.columnSpan <= columns &&
            (item.column === undefined || index % columns === item.column),
        )
        .map((index) => ({
          column: index % columns,
          row: Math.floor(index / columns),
          columnSpan: item.columnSpan,
          rowSpan: item.rowSpan,
        }))
        .filter((cell) => free({ occupied: progress.occupied, cell }));
      const cell = preferred({ progress, item, candidates }) ?? {
        column: item.column ?? 0,
        row: progress.rows,
        columnSpan: item.columnSpan,
        rowSpan: item.rowSpan,
      };
      return commit({ progress, item, cell, cursor: cell.row * columns + cell.column });
    }, definite);
  if (!compact) return { cells: placed.placed, rows: placed.rows };
  const raised = sized
    .toSorted(
      (left, right) =>
        placed.placed[left.id].row - placed.placed[right.id].row ||
        placed.placed[left.id].column - placed.placed[right.id].column,
    )
    .reduce((progress, item) => {
      const current = placed.placed[item.id];
      const above = Array.from({ length: current.row + 1 }, (_, step) => ({
        ...current,
        row: current.row - step,
      }));
      const blocked = above.findIndex((cell) => !free({ occupied: progress.occupied, cell }));
      const candidates = above.slice(0, blocked < 0 ? above.length : blocked).toReversed();
      return commit({
        progress,
        item,
        cell: preferred({ progress, item, candidates }) ?? current,
        cursor: 0,
      });
    }, start);
  return { cells: raised.placed, rows: raised.rows };
}
