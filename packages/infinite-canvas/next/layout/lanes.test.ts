import { describe, expect, test } from "vite-plus/test";
import { arrangeWindows, bindLayout, type LayoutNode } from "./arrange";
import { lanes, placeLanes, type LaneItem } from "./lanes";

const reference = ({
  columns,
  gap,
  tolerance,
  items,
}: {
  columns: number;
  gap: number;
  tolerance: number;
  items: readonly LaneItem[];
}) => {
  const running = Array.from({ length: columns }, () => 0);
  const state = { cursor: 0 };
  return items.map((item) => {
    const maxPos = (line: number) => Math.max(...running.slice(line, line + item.span));
    const line =
      item.column !== undefined
        ? item.column
        : (() => {
            const lines = Array.from({ length: columns - item.span + 1 }, (_, index) => index);
            const smallest = Math.min(...lines.map(maxPos));
            const possible = lines.filter((candidate) => maxPos(candidate) <= smallest + tolerance);
            const chosen = possible.find((candidate) => candidate >= state.cursor) ?? possible[0];
            state.cursor = chosen + item.span;
            return chosen;
          })();
    const y = maxPos(line);
    lines(line, item.span).forEach((track) => {
      running[track] = y + Math.max(0, item.height) + gap;
    });
    return { id: item.id, column: line, y };
  });
};
const lines = (from: number, count: number) =>
  Array.from({ length: count }, (_, index) => from + index);

describe("lanes", () => {
  const layouts = { lanes: bindLayout(lanes) };
  const rect = { x: 0, y: 0, width: 320, height: 10 };
  const tall =
    (height: number) =>
    ({ width = 0 }: { width?: number }) => ({ width, height });
  const nodes: Record<string, LayoutNode> = {
    root: { layout: { type: "lanes", columns: 3, gap: 10 }, children: ["a", "b", "c", "d"] },
    a: {},
    b: {},
    c: {},
    d: {},
  };
  const sizes = { a: tall(50), b: tall(30), c: tall(40), d: tall(20) };

  test("stacks content-driven heights into the shortest lane and reports the height of the tallest", () => {
    const { rects, size } = arrangeWindows({ id: "root", rect, nodes, layouts, sizes });
    expect(rects.a).toEqual({ x: 0, y: 0, width: 100, height: 50 });
    expect(rects.b).toEqual({ x: 110, y: 0, width: 100, height: 30 });
    expect(rects.c).toEqual({ x: 220, y: 0, width: 100, height: 40 });
    expect(rects.d).toEqual({ x: 110, y: 40, width: 100, height: 20 });
    expect(size).toEqual({ width: 320, height: 60 });
  });

  test("a moved item takes the lane under it and the order its height implies, and the commit reproduces the preview", () => {
    const operations = {
      root: { type: "move" as const, rects: { d: { x: 5, y: 5, width: 100, height: 20 } } },
    };
    const preview = arrangeWindows({ id: "root", rect, nodes, layouts, sizes, operations });
    expect(preview.rects.d).toEqual({ x: 0, y: 0, width: 100, height: 20 });
    expect(preview.rects.a).toEqual({ x: 110, y: 0, width: 100, height: 50 });
    expect(preview.rects.c).toEqual({ x: 0, y: 30, width: 100, height: 40 });
    expect(preview.changes.root).toEqual({
      items: { d: { column: 0, columnSpan: 1 } },
      children: ["d", "a", "b", "c"],
    });
    const committed: Record<string, LayoutNode> = {
      ...nodes,
      root: { ...nodes.root, children: preview.changes.root.children },
      d: { item: preview.changes.root.items?.d },
    };
    expect(arrangeWindows({ id: "root", rect, nodes: committed, layouts, sizes }).rects).toEqual(
      preview.rects,
    );
  });
});

describe("placeLanes", () => {
  test("follows the CSS Grid Level 3 draft 4.4 example: item 2 spans two tracks, odd items are taller", () => {
    const items: LaneItem[] = [
      { id: "1", span: 1, height: 40 },
      { id: "2", span: 2, height: 20 },
      { id: "3", span: 1, height: 40 },
      { id: "4", span: 1, height: 20 },
    ];
    expect(placeLanes({ columns: 4, gap: 0, tolerance: 0, items })).toEqual([
      { id: "1", column: 0, y: 0 },
      { id: "2", column: 1, y: 0 },
      { id: "3", column: 3, y: 0 },
      { id: "4", column: 1, y: 20 },
    ]);
  });

  test("a tie chooses the first line at or after the cursor, so placement moves forward", () => {
    const items: LaneItem[] = [
      { id: "a", span: 1, height: 10 },
      { id: "b", span: 1, height: 10 },
      { id: "c", span: 1, height: 10 },
    ];
    expect(
      placeLanes({ columns: 3, gap: 0, tolerance: 0, items }).map(({ column }) => column),
    ).toEqual([0, 1, 2]);
    expect(
      placeLanes({
        columns: 3,
        gap: 0,
        tolerance: 5,
        items: [{ id: "a", span: 1, height: 4 }, ...items.slice(1)],
      }).map(({ column }) => column),
    ).toEqual([0, 1, 2]);
  });

  test("a definite column is used as given and leaves the cursor alone", () => {
    const items: LaneItem[] = [
      { id: "a", span: 1, height: 10, column: 2 },
      { id: "b", span: 1, height: 10 },
    ];
    expect(placeLanes({ columns: 3, gap: 0, tolerance: 0, items })).toEqual([
      { id: "a", column: 2, y: 0 },
      { id: "b", column: 0, y: 0 },
    ]);
  });

  test("matches a transcription of the draft's placement steps (css-grid-3-algorithm.txt lines 3 to 30, without dense backfill) on random cases", () => {
    const random = (seed: number) => () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    Array.from({ length: 500 }, (_, seed) => seed + 1).forEach((seed) => {
      const next = random(seed);
      const columns = 1 + Math.floor(next() * 6);
      const input = {
        columns,
        gap: Math.floor(next() * 20),
        tolerance: Math.floor(next() * 30),
        items: Array.from({ length: Math.floor(next() * 12) }, (_, index): LaneItem => {
          const span = 1 + Math.floor(next() * columns);
          return {
            id: `i${index}`,
            span,
            height: Math.floor(next() * 200),
            ...(next() < 0.2 ? { column: Math.floor(next() * (columns - span + 1)) } : {}),
          };
        }),
      };
      expect(placeLanes(input), `seed ${seed}`).toEqual(reference(input));
    });
  });
});
