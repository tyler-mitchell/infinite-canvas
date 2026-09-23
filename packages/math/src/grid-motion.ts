// Adapted from react-grid-layout v2.2.4 core/layout.ts and core/compactors.ts. See LICENSE.grid.
import type { GridCell, GridTarget } from "./grid";
import { boundGridCell, gridCellsOverlap, resizeGridCell } from "./grid-geometry";

type Item = GridCell & { id: string; moved: boolean };
type Compaction = "vertical" | "horizontal" | "wrap" | null;

const collides = (a: Item, b: Item) => a.id !== b.id && gridCellsOverlap({ a, b });

const sorted = (items: readonly Item[]) =>
  items.toSorted((a, b) => a.row - b.row || a.column - b.column);

function displace({
  items,
  item,
  position,
  axis,
}: {
  items: readonly Item[];
  item: Item;
  position: number;
  axis: "column" | "row";
}): void {
  item[axis] += 1;
  const index = items.findIndex(({ id }) => id === item.id);
  for (const other of items.slice(index + 1)) {
    if (other.row > item.row + item.rowSpan) break;
    if (collides(item, other))
      displace({
        items,
        item: other,
        axis,
        position: position + (axis === "column" ? item.columnSpan : item.rowSpan),
      });
  }
  item[axis] = position;
}

function compact(
  items: readonly Item[],
  axis: "column" | "row" = "row",
  columns = Infinity,
): Item[] {
  const order =
    axis === "row" ? sorted(items) : items.toSorted((a, b) => a.column - b.column || a.row - b.row);
  const placed: Item[] = [];
  const result: Item[] = Array(items.length);
  let bottom = 0;
  for (const source of order) {
    const item = {
      ...source,
      column: Math.max(0, source.column),
      row: Math.max(0, source.row),
    };
    if (axis === "row") item.row = Math.min(bottom, item.row);
    while (item[axis] > 0 && !placed.some((other) => collides(other, item))) item[axis] -= 1;
    let collision = placed.find((other) => collides(other, item));
    while (collision !== undefined) {
      displace({
        items: order,
        item,
        axis,
        position: collision[axis] + (axis === "row" ? collision.rowSpan : collision.columnSpan),
      });
      if (axis === "column" && item.column + item.columnSpan > columns) {
        item.column = columns - item.columnSpan;
        item.row += 1;
        while (item.column > 0 && !placed.some((other) => collides(other, item))) item.column -= 1;
      }
      collision = placed.find((other) => collides(other, item));
    }
    item[axis] = Math.max(0, item[axis]);
    bottom = Math.max(bottom, item.row + item.rowSpan);
    placed.push(item);
    item.moved = false;
    result[items.indexOf(source)] = item;
  }
  return result;
}

export function compactGrid({
  items,
  axis,
  columns,
}: {
  items: readonly (GridCell & { id: string })[];
  axis: "column" | "row";
  columns: number;
}): (GridCell & { id: string })[] {
  return compact(
    items.map((item) => ({ ...item, moved: false })),
    axis,
    columns,
  ).map(({ moved: _, ...item }) => item);
}

function move({
  items,
  item,
  column,
  row,
  primary,
  mode = "vertical",
}: {
  items: readonly Item[];
  item: Item;
  column?: number;
  row?: number;
  primary: boolean;
  mode?: Compaction;
}): void {
  const reverse =
    (mode === "vertical" && row !== undefined && item.row >= row) ||
    (mode === "horizontal" && column !== undefined && item.column >= column);
  if (column !== undefined) item.column = column;
  if (row !== undefined) item.row = row;
  item.moved = true;
  const order = mode === "vertical" ? sorted(items) : [...items];
  if (mode === "horizontal") order.sort((a, b) => a.column - b.column || a.row - b.row);
  const collisions = (reverse ? order.toReversed() : order).filter((other) =>
    collides(other, item),
  );
  for (const collision of collisions) {
    if (!collision.moved) moveAway({ items, obstacle: item, item: collision, primary, mode });
  }
}

function moveAway({
  items,
  obstacle,
  item,
  primary,
  mode = "vertical",
}: {
  items: readonly Item[];
  obstacle: Item;
  item: Item;
  primary: boolean;
  mode?: Compaction;
}): void {
  if (primary) {
    const candidate = {
      ...item,
      id: "-1",
      row: mode === "vertical" ? Math.max(obstacle.row - item.rowSpan, 0) : item.row,
      column: mode === "horizontal" ? Math.max(obstacle.column - item.columnSpan, 0) : item.column,
    };
    const collision = items.find((other) => collides(other, candidate));
    if (collision === undefined) {
      move({
        items,
        item,
        mode,
        primary: false,
        row: mode === "vertical" ? candidate.row : undefined,
        column: mode === "horizontal" ? candidate.column : undefined,
      });
      return;
    }
    if (mode === null && collision.row + collision.rowSpan > obstacle.row) {
      obstacle.row = item.row;
      item.row += item.rowSpan;
      return;
    }
    if (mode === "horizontal" && obstacle.column + obstacle.columnSpan > collision.column) {
      move({ items, item: obstacle, column: item.column, primary: false, mode });
      return;
    }
  }
  if (mode === "vertical")
    move({ items, item, row: obstacle.row + obstacle.rowSpan, primary: false, mode });
  if (mode === "horizontal")
    move({ items, item, column: obstacle.column + obstacle.columnSpan, primary: false, mode });
}

export function moveGrid({
  items,
  id,
  position,
  mode,
  allowOverlap,
  preventCollision,
}: {
  items: readonly (GridCell & { id: string })[];
  id: string;
  position: Pick<GridCell, "column" | "row">;
  mode: Compaction;
  allowOverlap: boolean;
  preventCollision: boolean;
}): (GridCell & { id: string })[] {
  const result = items.map((item) => ({ ...item, moved: false }));
  const item = result.find((item) => item.id === id);
  if (item === undefined) return result;
  const target = { ...item, ...position };
  if (!allowOverlap && preventCollision && result.some((other) => collides(other, target)))
    return result;
  if (allowOverlap) return result.map((item) => (item.id === id ? target : item));
  move({ items: result, item, ...position, mode, primary: true });
  return result.map(({ moved: _, ...item }) => item);
}

export function resolveGrid({
  cells,
  targets,
  compact: closeGaps,
  columns,
}: {
  cells: Readonly<Record<string, GridCell>>;
  targets: Readonly<Record<string, GridTarget>>;
  compact: boolean;
  columns: number;
}): Record<string, GridCell> {
  const source = Object.entries(cells).map(([id, cell]) => ({ ...cell, id, moved: false }));
  const items = closeGaps ? compact(source) : source;
  for (const [id, target] of Object.entries(targets)) {
    const item = items.find((item) => item.id === id);
    if (item === undefined) continue;
    const cell =
      target.handle === undefined
        ? boundGridCell({ cell: target, columns })
        : resizeGridCell({
            cell: item,
            span: target,
            handle: target.handle,
            columns,
            rows: Infinity,
          });
    const resized = item.columnSpan !== cell.columnSpan || item.rowSpan !== cell.rowSpan;
    item.columnSpan = cell.columnSpan;
    item.rowSpan = cell.rowSpan;
    move({ items, item, column: cell.column, row: cell.row, primary: !resized });
  }
  return Object.fromEntries(
    (closeGaps ? compact(items) : items).map(({ id, moved: _, ...cell }) => [id, cell]),
  );
}
