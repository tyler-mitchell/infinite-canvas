import { describe, expect, test, vi } from "vite-plus/test";
import { arrangeWindows, bindLayout, getWindowSize, type LayoutNode } from "./arrange";
import { accordion, split, tabs, type Proposal } from "./kinds";

const layouts = {
  split: bindLayout(split),
  tabs: bindLayout(tabs),
  accordion: bindLayout(accordion),
};
const rect = { x: 0, y: 0, width: 606, height: 400 };

const accept = ({
  proposed,
  min,
  max,
  ideal,
}: {
  proposed: number | undefined;
  min: number;
  max: number;
  ideal: number;
}) => (proposed === undefined ? ideal : Math.max(min, Math.min(max, proposed)));
const sized =
  ({
    min = [0, 0],
    max = [Infinity, Infinity],
    ideal = [200, 100],
  }: {
    min?: [number, number];
    max?: [number, number];
    ideal?: [number, number];
  }) =>
  (proposal: Proposal) => ({
    width: accept({ proposed: proposal.width, min: min[0], max: max[0], ideal: ideal[0] }),
    height: accept({ proposed: proposal.height, min: min[1], max: max[1], ideal: ideal[1] }),
  });
const limit = (width: number, height = 0) => sized({ min: [width, height] });
const minimum = (input: Parameters<typeof getWindowSize>[0]) =>
  getWindowSize(input)({ width: 0, height: 0 });

describe("split", () => {
  const nodes: Record<string, LayoutNode> = {
    root: { layout: { type: "split" }, children: ["a", "b", "c"] },
    a: {},
    b: { item: { factor: 2 } },
    c: {},
  };

  test("shares the rectangle by factor with a gap between panes", () => {
    const { rects, controls } = arrangeWindows({ id: "root", rect, nodes, layouts });
    expect(rects.a).toEqual({ x: 0, y: 0, width: 148.5, height: 400 });
    expect(rects.b).toEqual({ x: 154.5, y: 0, width: 297, height: 400 });
    expect(rects.c).toEqual({ x: 457.5, y: 0, width: 148.5, height: 400 });
    expect(controls.root).toEqual([
      {
        type: "sash",
        axis: "horizontal",
        index: 0,
        sizes: [148.5, 297, 148.5],
        rect: { x: 148.5, y: 0, width: 6, height: 400 },
      },
      {
        type: "sash",
        axis: "horizontal",
        index: 1,
        sizes: [148.5, 297, 148.5],
        rect: { x: 451.5, y: 0, width: 6, height: 400 },
      },
    ]);
  });

  test("gives a pane its minimum size before it shares the rest", () => {
    const { rects } = arrangeWindows({
      id: "root",
      rect,
      nodes,
      layouts,
      sizes: { a: limit(300) },
    });
    expect(rects.a.width).toBe(300);
    expect(rects.b.width).toBe(196);
    expect(rects.c.width).toBe(98);
  });

  test("reports a minimum size that includes every descendant", () => {
    const nested: Record<string, LayoutNode> = {
      root: { layout: { type: "split" }, children: ["a", "column"] },
      column: { layout: { type: "split", axis: "vertical", gap: 10 }, children: ["b", "c"] },
      a: {},
      b: {},
      c: {},
    };
    const sizes = { a: limit(100, 50), b: limit(80, 60), c: limit(120, 70) };
    expect(minimum({ id: "column", nodes: nested, layouts, sizes })).toEqual({
      width: 120,
      height: 140,
    });
    expect(minimum({ id: "root", nodes: nested, layouts, sizes })).toEqual({
      width: 226,
      height: 140,
    });
  });

  test("asks a pane for its height at the width that the split gives it", () => {
    const wrapping = (proposal: Proposal) => {
      const width = proposal.width === undefined ? 300 : Math.max(100, proposal.width);
      return { width, height: 30000 / Math.min(width, 1000) };
    };
    const size = getWindowSize({
      id: "root",
      nodes: { root: { layout: { type: "split", gap: 0 }, children: ["a", "b"] }, a: {}, b: {} },
      layouts,
      sizes: { a: wrapping, b: limit(0, 20) },
    });
    expect(size({ width: 600 })).toEqual({ width: 600, height: 100 });
    expect(size({ width: 300 })).toEqual({ width: 300, height: 200 });
  });

  test("moves a sash from the sizes at the start of the drag and reports the new factors", () => {
    const operations = {
      root: { type: "sash" as const, index: 0, delta: 200, sizes: [148.5, 297, 148.5] },
    };
    const { rects, changes } = arrangeWindows({
      id: "root",
      rect,
      nodes,
      layouts,
      operations,
      sizes: { b: limit(150) },
    });
    expect([rects.a.width, rects.b.width, rects.c.width]).toEqual([348.5, 150, 95.5]);
    expect(changes.root).toEqual({
      items: { a: { factor: 348.5 }, b: { factor: 150 }, c: { factor: 95.5 } },
    });
    const committed = {
      ...nodes,
      a: { item: { factor: 348.5 } },
      b: { item: { factor: 150 } },
      c: { item: { factor: 95.5 } },
    };
    expect(
      arrangeWindows({ id: "root", rect, nodes: committed, layouts, sizes: { b: limit(150) } })
        .rects,
    ).toEqual(rects);
  });

  test("leaves a hidden pane out of the space", () => {
    const hidden = { ...nodes, b: { item: { hidden: true } } };
    const { rects, visible } = arrangeWindows({ id: "root", rect, nodes: hidden, layouts });
    expect([rects.a.width, rects.c.width]).toEqual([300, 300]);
    expect(visible).toEqual({ root: true, a: true, b: false, c: true });
  });
});

describe("alignment", () => {
  const nodes = (item: Record<string, unknown>): Record<string, LayoutNode> => ({
    root: { layout: { type: "split", gap: 0 }, children: ["a"] },
    a: { item },
  });

  test("an item keeps its ideal size in its slot when it does not stretch", () => {
    const { rects } = arrangeWindows({
      id: "root",
      rect,
      layouts,
      sizes: { a: sized({ ideal: [200, 100] }) },
      nodes: nodes({ align: { x: "center", y: "end" } }),
    });
    expect(rects.a).toEqual({ x: 203, y: 300, width: 200, height: 100 });
  });

  test("a stretched item stops at its maximum size and starts at the slot origin", () => {
    const { rects } = arrangeWindows({
      id: "root",
      rect,
      layouts,
      sizes: { a: sized({ max: [Infinity, 250] }) },
      nodes: nodes({}),
    });
    expect(rects.a).toEqual({ x: 0, y: 0, width: 606, height: 250 });
  });
});

describe("tabs and accordion", () => {
  const nodes: Record<string, LayoutNode> = {
    root: { layout: { type: "tabs" }, children: ["a", "stack"] },
    stack: { layout: { type: "accordion" }, children: ["b", "c"] },
    a: {},
    b: {},
    c: {},
  };

  test("shows the active tab only, and hides everything under a hidden tab", () => {
    const first = arrangeWindows({ id: "root", rect, nodes, layouts });
    expect(first.visible).toEqual({ root: true, a: true, stack: false, b: false, c: false });
    expect(first.rects.a).toEqual({ x: 0, y: 30, width: 606, height: 370 });
    expect(first.controls).toEqual({
      root: [
        { type: "tabs", rect: { ...rect, height: 30 }, children: ["a", "stack"], active: "a" },
      ],
    });
    const second = arrangeWindows({
      id: "root",
      rect,
      nodes,
      layouts,
      active: { root: "stack", stack: "c" },
    });
    expect(second.visible).toEqual({ root: true, a: false, stack: true, b: false, c: true });
    expect(second.rects.c).toEqual({ x: 0, y: 86, width: 606, height: 314 });
    expect(second.controls.stack.map((control) => control.rect.y)).toEqual([30, 58]);
  });

  test("adds the strip and the headers to the minimum size", () => {
    const sizes = { a: limit(100, 90), b: limit(140, 50), c: limit(60, 80) };
    expect(minimum({ id: "stack", nodes, layouts, sizes })).toEqual({ width: 140, height: 136 });
    expect(minimum({ id: "root", nodes, layouts, sizes })).toEqual({ width: 140, height: 166 });
  });
});

describe("failure", () => {
  test("hides the children and warns when the layout kind is not registered or its options are invalid", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const unknown = arrangeWindows({
      id: "root",
      rect,
      layouts,
      nodes: { root: { layout: { type: "spiral" }, children: ["a"] }, a: {} },
    });
    const invalid = arrangeWindows({
      id: "root",
      rect,
      layouts,
      nodes: { root: { layout: { type: "split", gap: -1 }, children: ["a"] }, a: {} },
    });
    expect(unknown.rects).toEqual({ root: rect });
    expect(invalid.rects).toEqual({ root: rect });
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });
});
