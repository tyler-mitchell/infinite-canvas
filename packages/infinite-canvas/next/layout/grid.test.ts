import { describe, expect, test } from "vite-plus/test";
import { arrangeWindows, bindLayout, getWindowSize, type LayoutNode } from "./arrange";
import { grid } from "./grid";
import { split } from "./kinds";

const layouts = { grid: bindLayout(grid) };
const rect = { x: 100, y: 50, width: 468, height: 10 };
const board = (children: string[], options: Record<string, unknown> = {}) => ({
  layout: { type: "grid", columns: 4, gap: 12, ...options },
  children,
});

describe("grid", () => {
  test.each([880, 800, 740, 700, 660, 640])(
    "adjacent half-width cards retain their shared boundary at width %s",
    (width) => {
      const nodes = {
        root: board(["left", "right"], {
          columns: 24, spanColumns: 24, rowHeight: 25.17, compact: true,
        }),
        left: { item: { column: 0, row: 0, columnSpan: 12, rowSpan: 4 } },
        right: { item: { column: 12, row: 0, columnSpan: 12, rowSpan: 4 } },
      };
      const { rects } = arrangeWindows({
        id: "root", rect: { x: 0, y: 0, width, height: 1 }, nodes, layouts,
      });
      expect(rects.left.y).toBe(rects.right.y);
      expect(rects.right.x).toBeCloseTo(rects.left.width + 12);
      expect(rects.right.x + rects.right.width).toBeCloseTo(width);
    },
  );
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
    const limits = {
      a: {
        min: { width: 0, height: 0 },
        max: { width: Infinity, height: Infinity },
        ideal: { width: 228, height: 250 },
      },
    };
    const nodes: Record<string, LayoutNode> = {
      root: board(["a", "b"]),
      a: { item: { columnSpan: 2 } },
      b: {},
    };
    expect(arrangeWindows({ id: "root", rect, nodes, layouts, limits }).rects.a.height).toBe(348);
    const stated = { ...nodes, a: { item: { columnSpan: 2, rowSpan: 1 } } };
    expect(arrangeWindows({ id: "root", rect, nodes: stated, layouts, limits }).rects.a.height).toBe(
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
      items: {
        c: { column: 1, row: 0, columnSpan: 1 },
        a: { column: 1, row: 1, columnSpan: 1 },
        b: { column: 0, row: 0, columnSpan: 1 },
      },
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
      b: { column: 0, row: 1, columnSpan: 1 },
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
    const limits = {
      a: {
        min: { width: 80, height: 0 },
        max: { width: Infinity, height: Infinity },
        ideal: { width: 80, height: 80 },
      },
    };
    expect(
      getWindowSize({ id: "board", nodes, layouts: both, limits })({ width: Infinity }).width,
    ).toBe(Infinity);
    expect(getWindowSize({ id: "board", nodes, layouts: both, limits })({ width: 0 }).width).toBe(
      80,
    );
    const { rects } = arrangeWindows({
      id: "root",
      rect: { ...rect, width: 1200 },
      nodes,
      layouts: both,
      limits,
    });
    expect(rects.board.width).toBe(600);
  });

  test("explicit alignment centres a child within a wider track", () => {
    const icon = { item: { align: { x: "center" } } };
    const nodes: Record<string, LayoutNode> = { root: board(["a", "icon"]), a: {}, icon };
    const limits = {
      icon: {
        min: { width: 0, height: 0 },
        max: { width: 108, height: Infinity },
        ideal: { width: 108, height: 108 },
      },
    };
    const { rects } = arrangeWindows({
      id: "root",
      rect: { ...rect, width: 468 },
      nodes,
      layouts,
      limits,
    });
    expect(rects.a.width).toBe(108);
    expect(rects.icon.width).toBe(108);
    const wide = arrangeWindows({
      id: "root",
      rect: { ...rect, width: 468 },
      nodes: { root: board(["icon"], { columns: 1 }), icon },
      layouts,
      limits,
    });
    expect(wide.rects.icon.width).toBe(108);
    expect(wide.rects.icon.x).toBe(280);
  });

  test("takes its ideal width from its own size when no width is proposed", () => {
    const nodes: Record<string, LayoutNode> = { board: board(["a"]), a: {} };
    const limits = {
      board: {
        min: { width: 0, height: 0 },
        max: { width: Infinity, height: Infinity },
        ideal: { width: 468, height: 10 },
      },
    };
    expect(getWindowSize({ id: "board", nodes, layouts, limits })({}).width).toBe(468);
  });

});
