import { describe, expect, test } from "vite-plus/test";
import { placeGridItems, type GridItem } from "@hyphened/math/cpu";

const item = (
  id: string,
  columnSpan = 1,
  rowSpan = 1,
  position: Partial<GridItem> = {},
): GridItem => ({ id, columnSpan, rowSpan, ...position });
const at = (column: number, row: number, columnSpan = 1, rowSpan = 1) => ({
  column,
  row,
  columnSpan,
  rowSpan,
});

describe("placeGridItems", () => {
  test("resizing keeps the opposite corner fixed while displaced neighbours remain separate", () => {
    const { cells } = placeGridItems({
      columns: 8,
      items: [item("a", 3, 3, { column: 0, row: 0 }), item("b", 3, 3, { column: 4, row: 0 })],
      targets: { a: { column: 0, row: 0, columnSpan: 7, rowSpan: 5, handle: "south-east" } },
    });
    expect(cells.a).toEqual(at(0, 0, 7, 5));
    expect(cells.b).toEqual(at(4, 5, 3, 3));
  });
  test("dense packing puts a later small item into a hole that an earlier item left", () => {
    const { cells, rows } = placeGridItems({
      columns: 4,
      items: [item("a", 3), item("b", 2), item("c")],
    });
    expect(cells).toEqual({ a: at(0, 0, 3), b: at(0, 1, 2), c: at(3, 0) });
    expect(rows).toBe(2);
  });

  test("compaction raises each item in its column until it meets another item, and keeps the row order", () => {
    const items = [
      item("a", 2, 1, { column: 0, row: 5 }),
      item("b", 1, 2, { column: 0, row: 2 }),
      item("c", 1, 1, { column: 2, row: 9 }),
    ];
    expect(placeGridItems({ columns: 3, items }).cells.a).toEqual(at(0, 5, 2));
    const { cells, rows } = placeGridItems({ columns: 3, items, compact: true });
    expect(cells).toEqual({ b: at(0, 0, 1, 2), a: at(0, 2, 2), c: at(2, 0) });
    expect(rows).toBe(3);
  });

  test("compaction slides an item up until it touches another item and never jumps over one", () => {
    const items = [
      item("bar", 3, 1, { column: 0, row: 2 }),
      item("low", 1, 1, { column: 0, row: 6 }),
    ];
    expect(placeGridItems({ columns: 3, items, compact: true }).cells).toEqual({
      bar: at(0, 0, 3),
      low: at(0, 1),
    });
    const held = [
      item("roof", 2, 1, { column: 1, row: 1 }),
      item("post", 1, 3, { column: 0, row: 0 }),
      item("low", 2, 1, { column: 1, row: 5 }),
    ];
    expect(placeGridItems({ columns: 3, items: held, compact: true }).cells.low).toEqual(
      at(1, 1, 2),
    );
  });

  test("compaction preserves columns and spans, removes overlap, and is idempotent", () => {
    const random = (seed: number) => () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    Array.from({ length: 300 }, (_, seed) => seed + 1).forEach((seed) => {
      const next = random(seed);
      const columns = 1 + Math.floor(next() * 8);
      const wanted = Array.from({ length: 1 + Math.floor(next() * 12) }, (_, index) => {
        const columnSpan = 1 + Math.floor(next() * columns);
        return item(`i${index}`, columnSpan, 1 + Math.floor(next() * 4), {
          column: Math.floor(next() * (columns - columnSpan + 1)),
          row: Math.floor(next() * 20),
        });
      });
      const apart = Object.entries(placeGridItems({ columns, items: wanted }).cells).map(
        ([id, cell]) => item(id, cell.columnSpan, cell.rowSpan, cell),
      );
      const compacted = placeGridItems({ columns, items: apart, compact: true }).cells;
      for (const entry of apart) {
        const cell = compacted[entry.id];
        expect(cell.column).toBe(entry.column);
        expect(cell.columnSpan).toBe(entry.columnSpan);
        expect(cell.rowSpan).toBe(entry.rowSpan);
        expect(cell.row).toBeLessThanOrEqual(entry.row!);
      }
      const occupied = Object.values(compacted).flatMap((cell) =>
        Array.from(
          { length: cell.columnSpan * cell.rowSpan },
          (_, index) =>
            `${cell.column + (index % cell.columnSpan)}:${cell.row + Math.floor(index / cell.columnSpan)}`,
        ),
      );
      expect(new Set(occupied).size).toBe(occupied.length);
      expect(
        placeGridItems({
          columns,
          compact: true,
          items: Object.entries(compacted).map(([id, cell]) => ({ id, ...cell })),
        }).cells,
      ).toEqual(compacted);
    });
  });

  test("an item with a definite position is placed first and the others flow around it", () => {
    const { cells } = placeGridItems({
      columns: 3,
      items: [item("a", 2), item("b", 2), item("pinned", 1, 2, { column: 1, row: 0 })],
    });
    expect(cells.pinned).toEqual(at(1, 0, 1, 2));
    expect(cells.a).toEqual(at(0, 2, 2));
    expect(cells.b).toEqual(at(0, 3, 2));
  });

  test("a definite position that is taken or out of range falls back to automatic placement", () => {
    const { cells } = placeGridItems({
      columns: 3,
      items: [
        item("first", 2, 1, { column: 0, row: 0 }),
        item("second", 2, 1, { column: 1, row: 0 }),
        item("outside", 2, 1, { column: 2, row: 0 }),
      ],
    });
    expect(cells.first).toEqual(at(0, 0, 2));
    expect(cells.second).toEqual(at(1, 1, 2));
    expect(cells.outside).toEqual(at(0, 2, 2));
  });

  test("an item with only a definite column takes the first free row in that column", () => {
    const { cells } = placeGridItems({
      columns: 3,
      items: [item("a", 3), item("b", 1, 1, { column: 2 })],
    });
    expect(cells.b).toEqual(at(2, 1));
  });

  test("a span wider than the grid is limited to the column count", () => {
    expect(placeGridItems({ columns: 2, items: [item("a", 5)] }).cells.a).toEqual(at(0, 0, 2));
  });

  test("no two items share a cell", () => {
    const items = Array.from({ length: 30 }, (_, index) =>
      item(
        `i${index}`,
        1 + (index % 3),
        1 + ((index * 7) % 4),
        index % 5 === 0 ? { column: index % 4, row: index % 6 } : {},
      ),
    );
    const { cells } = placeGridItems({ columns: 6, items });
    const taken = Object.values(cells).flatMap((cell) =>
      Array.from(
        { length: cell.columnSpan * cell.rowSpan },
        (_, index) =>
          `${cell.column + (index % cell.columnSpan)}:${cell.row + Math.floor(index / cell.columnSpan)}`,
      ),
    );
    expect(Object.keys(cells)).toHaveLength(30);
    expect(new Set(taken).size).toBe(taken.length);
    expect(Object.values(cells).every((cell) => cell.column + cell.columnSpan <= 6)).toBe(true);
  });
});
