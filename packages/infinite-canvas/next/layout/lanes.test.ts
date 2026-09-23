import { describe, expect, test } from "vite-plus/test";
import { arrangeWindows, bindLayout, type LayoutNode } from "./arrange";
import { lanes } from "./lanes";

describe("lanes", () => {
  const layouts = { lanes: bindLayout(lanes) };
  const rect = { x: 0, y: 0, width: 320, height: 10 };
  const nodes: Record<string, LayoutNode> = {
    root: { layout: { type: "lanes", columns: 3, gap: 10 }, children: ["a", "b", "c", "d"] },
    a: {},
    b: {},
    c: {},
    d: {},
  };
  const limits = Object.fromEntries(
    Object.entries({ a: 50, b: 30, c: 40, d: 20 }).map(([id, height]) => [
      id,
      {
        min: { width: 0, height },
        max: { width: Infinity, height },
        ideal: { width: 0, height },
      },
    ]),
  );

  test("stacks content-driven heights into the shortest lane and reports the height of the tallest", () => {
    const { rects, size } = arrangeWindows({ id: "root", rect, nodes, layouts, limits });
    expect(rects.a).toEqual({ x: 0, y: 0, width: 100, height: 50 });
    expect(rects.b).toEqual({ x: 110, y: 0, width: 100, height: 30 });
    expect(rects.c).toEqual({ x: 220, y: 0, width: 100, height: 40 });
    expect(rects.d).toEqual({ x: 110, y: 40, width: 100, height: 20 });
    expect(size).toEqual({ width: 320, height: 60 });
  });

  test("a moved item takes the order its height implies, and the commit reproduces the preview", () => {
    const operations = {
      root: { type: "move" as const, rects: { d: { x: 5, y: 5, width: 100, height: 20 } } },
    };
    const preview = arrangeWindows({ id: "root", rect, nodes, layouts, limits, operations });
    const committed: Record<string, LayoutNode> = {
      ...nodes,
      root: { ...nodes.root, children: preview.changes.root.children },
      d: { item: preview.changes.root.items?.d },
    };
    expect(arrangeWindows({ id: "root", rect, nodes: committed, layouts, limits }).rects).toEqual(
      preview.rects,
    );
  });
});
