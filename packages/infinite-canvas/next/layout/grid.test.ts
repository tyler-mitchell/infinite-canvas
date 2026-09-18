import { describe, expect, test } from "vite-plus/test";
import { arrangeWindows, bindLayout, getWindowSize, type LayoutNode } from "./arrange";
import { createGrid, grid } from "./grid";
import { split } from "./kinds";

const layouts = { grid: bindLayout(grid) };
const rect = { x: 100, y: 50, width: 468, height: 10 };
const board = (children: string[], options: Record<string, unknown> = {}) => ({
  layout: { type: "grid", columns: 4, gap: 12, ...options },
  children,
});

describe("grid", () => {
  test("places items on square cells and takes its height from its rows", () => {
    const nodes: Record<string, LayoutNode> = {
      root: board(["a", "b", "c"]),
      a: { item: { columnSpan: 3 } },
      b: { item: { columnSpan: 2, rowSpan: 2 } },
      c: {},
    };
    const { rects, size } = arrangeWindows({ id: "root", rect, nodes, layouts });
    expect(rects.a).toEqual({ x: 100, y: 50, width: 348, height: 108 });
    expect(rects.b).toEqual({ x: 100, y: 170, width: 228, height: 228 });
    expect(rects.c).toEqual({ x: 460, y: 50, width: 108, height: 108 });
    expect(size).toEqual({ width: 468, height: 348 });
    expect(rects.root).toEqual({ ...rect, height: 348 });
  });

  test("chooses the column count from the container width and scales authored spans", () => {
    const options = {
      columns: 16,
      spanColumns: 16,
      breakpoints: [
        { minWidth: 1120, columns: 16 },
        { minWidth: 400, columns: 8 },
      ],
    };
    const nodes: Record<string, LayoutNode> = {
      root: board(["a", "b"], options),
      a: { item: { columnSpan: 6 } },
      b: { item: { columnSpan: 1, minColumnSpan: 2 } },
    };
    const narrow = arrangeWindows({ id: "root", rect: { ...rect, width: 468 }, nodes, layouts });
    const cell = (468 - 12 * 7) / 8;
    expect(narrow.rects.a.width).toBeCloseTo(cell * 3 + 24);
    expect(narrow.rects.b.width).toBeCloseTo(cell * 2 + 12);
    const wide = arrangeWindows({ id: "root", rect: { ...rect, width: 1200 }, nodes, layouts });
    expect(wide.rects.a.width).toBeCloseTo(((1200 - 12 * 15) / 16) * 6 + 60);
  });

  test("takes the row span from the height an item reports at its cell width, unless the item states a row span", () => {
    const sizes = {
      a: ({ width = 0, height }: { width?: number; height?: number }) => ({
        width,
        height: height ?? 57000 / width,
      }),
    };
    const nodes: Record<string, LayoutNode> = {
      root: board(["a", "b"]),
      a: { item: { columnSpan: 2 } },
      b: {},
    };
    expect(arrangeWindows({ id: "root", rect, nodes, layouts, sizes }).rects.a.height).toBe(348);
    const stated = { ...nodes, a: { item: { columnSpan: 2, rowSpan: 1 } } };
    expect(arrangeWindows({ id: "root", rect, nodes: stated, layouts, sizes }).rects.a.height).toBe(
      108,
    );
  });

  test("a moved item takes the cell under it, wins over a placed item, and reports its position", () => {
    const nodes: Record<string, LayoutNode> = {
      root: board(["a", "b", "c"]),
      a: { item: { column: 1, row: 0 } },
      b: {},
      c: {},
    };
    const operations = {
      root: { type: "move" as const, rects: { c: { x: 225, y: 60, width: 108, height: 108 } } },
    };
    const { rects, changes } = arrangeWindows({ id: "root", rect, nodes, layouts, operations });
    expect(rects.c).toEqual({ x: 220, y: 50, width: 108, height: 108 });
    expect(rects.a).toEqual({ x: 220, y: 170, width: 108, height: 108 });
    expect(changes.root).toEqual({
      items: { c: { column: 1, row: 0, columnSpan: 1 }, a: { column: 1, row: 1 } },
    });
    const committed = Object.fromEntries(
      Object.entries(nodes).map(([id, node]) => [
        id,
        { ...node, item: { ...node.item, ...changes.root.items?.[id] } },
      ]),
    );
    expect(arrangeWindows({ id: "root", rect, nodes: committed, layouts }).rects).toEqual(rects);
  });

  test("an item with no column span takes the columns that its moved rectangle covers, and keeps a stated span", () => {
    const nodes: Record<string, LayoutNode> = {
      root: board(["a", "b"]),
      a: {},
      b: { item: { columnSpan: 1 } },
    };
    const wide = { x: 100, y: 50, width: 348, height: 108 };
    const operations = {
      root: { type: "move" as const, rects: { a: wide, b: { ...wide, y: 170 } } },
    };
    const { rects, changes } = arrangeWindows({ id: "root", rect, nodes, layouts, operations });
    expect(rects.a.width).toBe(348);
    expect(rects.b.width).toBe(108);
    expect(changes.root.items).toEqual({
      a: { column: 0, row: 0, columnSpan: 3 },
      b: { column: 0, row: 1 },
    });
  });

  test("a resized item reports spans in authored units", () => {
    const nodes: Record<string, LayoutNode> = {
      root: board(["a"], {
        columns: 8,
        spanColumns: 16,
        breakpoints: [{ minWidth: 1120, columns: 16 }],
      }),
      a: { item: { columnSpan: 4 } },
    };
    const operations = {
      root: {
        type: "resize" as const,
        child: "a",
        handle: "south-east" as const,
        rect: { x: 100, y: 50, width: 190, height: 100 },
      },
    };
    const { rects, changes } = arrangeWindows({ id: "root", rect, nodes, layouts, operations });
    const cell = (468 - 12 * 7) / 8;
    expect(rects.a.width).toBeCloseTo(cell * 3 + 24);
    expect(rects.a.height).toBeCloseTo(cell * 2 + 12);
    expect(changes.root).toEqual({
      items: { a: { column: 0, row: 0, columnSpan: 6, rowSpan: 2 } },
    });
  });

  test("has no greatest width, so a split shares its space with a grid by factor", () => {
    const both = { grid: bindLayout(grid), split: bindLayout(split) };
    const nodes: Record<string, LayoutNode> = {
      root: { layout: { type: "split", gap: 0 }, children: ["board", "side"] },
      board: board(["a"]),
      a: {},
      side: {},
    };
    const sizes = { a: ({ width = 80, height = 80 }) => ({ width: Math.max(80, width), height }) };
    expect(
      getWindowSize({ id: "board", nodes, layouts: both, sizes })({ width: Infinity }).width,
    ).toBe(Infinity);
    expect(getWindowSize({ id: "board", nodes, layouts: both, sizes })({ width: 0 }).width).toBe(
      80,
    );
    const { rects } = arrangeWindows({
      id: "root",
      rect: { ...rect, width: 1200 },
      nodes,
      layouts: both,
      sizes,
    });
    expect(rects.board.width).toBe(600);
  });

  test("takes its ideal width from its own size when no width is proposed", () => {
    const nodes: Record<string, LayoutNode> = { board: board(["a"]), a: {} };
    const sizes = { board: ({ width = 468, height = 10 }) => ({ width, height }) };
    expect(getWindowSize({ id: "board", nodes, layouts, sizes })({}).width).toBe(468);
  });

  test("uses the placement rules given at registration", () => {
    const apart = createGrid({
      rules: [
        ({ cell, placed }) =>
          Object.values(placed).every(
            (other) => Math.abs(other.column - cell.column) + Math.abs(other.row - cell.row) > 1,
          ),
      ],
    });
    const nodes: Record<string, LayoutNode> = {
      root: board(["a", "b"], { columns: 2 }),
      a: {},
      b: {},
    };
    const { rects } = arrangeWindows({
      id: "root",
      rect: { ...rect, width: 212 },
      nodes,
      layouts: { grid: bindLayout(apart) },
    });
    expect(rects.b).toEqual({ x: 212, y: 162, width: 100, height: 100 });
  });
});
