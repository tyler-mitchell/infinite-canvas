import { describe, expect, test, vi } from "vite-plus/test";
import { type } from "arktype";
import { arrangeWindows, bindLayout, getWindowSize, type LayoutNode } from "./arrange";
import { accordion, split, tabs, type Proposal } from "./kinds";

const layouts = {
  split: bindLayout(split),
  tabs: bindLayout(tabs),
  accordion: bindLayout(accordion),
};
const rect = { x: 0, y: 0, width: 606, height: 400 };

describe("layout input validation", () => {
  const options = type({ type: "'custom'", gap: "number >= 0 = 6" });
  const item = type({ factor: "string.numeric.parse" });
  const size = vi.fn(() => ({ width: 100, height: 100 }));
  const arrange = vi.fn(() => ({ size: rect, children: [], controls: [] }));
  const dock = vi.fn(() => ({ place: "append" as const }));
  const absorb = vi.fn(() => []);
  const layout = bindLayout({ options, item, size, arrange, dock, absorb });

  test("decodes defaults and morphs without changing input data or size callbacks", () => {
    const input = { options: { type: "custom" }, items: [{ factor: "2" }] };
    const measure = () => ({ width: 80, height: 40 });
    layout.size({
      options: input.options,
      items: [{ id: "a", item: input.items[0], size: measure }],
      proposal: {},
    });
    expect(size).toHaveBeenLastCalledWith({
      options: { type: "custom", gap: 6 },
      items: [{ id: "a", item: { factor: 2 }, size: measure }],
      proposal: {},
    });
    layout.dock({ ...input, edge: "center", target: { factor: "3" } });
    expect(dock).toHaveBeenLastCalledWith({
      options: { type: "custom", gap: 6 },
      items: [{ factor: 2 }],
      edge: "center",
      target: { factor: 3 },
    });
    layout.absorb({ ...input, child: input.options, slot: { factor: "4" } });
    expect(absorb).toHaveBeenLastCalledWith({
      options: { type: "custom", gap: 6 },
      items: [{ factor: 2 }],
      child: { type: "custom", gap: 6 },
      slot: { factor: 4 },
    });
    expect(input).toEqual({ options: { type: "custom" }, items: [{ factor: "2" }] });
  });

  test("rejects invalid items before any layout operation runs", () => {
    vi.clearAllMocks();
    const input = { options: { type: "custom" }, items: [{ factor: "invalid" }] };
    const entries = input.items.map((item) => ({ id: "a", item, size }));
    expect(layout.size({ ...input, items: entries, proposal: {} })).toBeInstanceOf(type.errors);
    expect(layout.arrange({ ...input, items: entries, rect })).toBeInstanceOf(type.errors);
    expect(layout.dock({ ...input, edge: "center" })).toBeUndefined();
    expect(
      layout.absorb({ ...input, child: input.options, slot: { factor: "1" } }),
    ).toBeUndefined();
    for (const operation of [size, arrange, dock, absorb]) expect(operation).not.toHaveBeenCalled();
  });

  test("rejects invalid docking targets, container options, and absorption slots", () => {
    vi.clearAllMocks();
    const input = { options: { type: "custom" }, items: [{ factor: "2" }] };
    expect(
      layout.dock({ ...input, edge: "center", target: { factor: "invalid" } }),
    ).toBeUndefined();
    expect(
      layout.absorb({ ...input, child: { type: "custom", gap: -1 }, slot: { factor: "1" } }),
    ).toBeUndefined();
    expect(
      layout.absorb({ ...input, child: input.options, slot: { factor: "invalid" } }),
    ).toBeUndefined();
    expect(dock).not.toHaveBeenCalled();
    expect(absorb).not.toHaveBeenCalled();
  });
});

const sized = ({
  min = [0, 0],
  max = [Infinity, Infinity],
  ideal = [200, 100],
}: {
  min?: [number, number];
  max?: [number, number];
  ideal?: [number, number];
}) => ({
  min: { width: min[0], height: min[1] },
  max: { width: max[0], height: max[1] },
  ideal: { width: ideal[0], height: ideal[1] },
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
      limits: { a: limit(300) },
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
    const limits = { a: limit(100, 50), b: limit(80, 60), c: limit(120, 70) };
    expect(minimum({ id: "column", nodes: nested, layouts, limits })).toEqual({
      width: 120,
      height: 140,
    });
    expect(minimum({ id: "root", nodes: nested, layouts, limits })).toEqual({
      width: 226,
      height: 140,
    });
  });

  test("asks a pane for its height at the width that the split gives it", () => {
    const wrapping = (proposal: Proposal) => {
      const width = proposal.width === undefined ? 300 : Math.max(100, proposal.width);
      return { width, height: 30000 / Math.min(width, 1000) };
    };
    const size = (proposal: Proposal) =>
      layouts.split.size({
        options: { type: "split", gap: 0 },
        proposal,
        items: [
          { id: "a", item: {}, size: wrapping },
          {
            id: "b",
            item: {},
            size: ({ width = 200, height = 20 }) => ({ width, height: Math.max(20, height) }),
          },
        ],
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
      limits: { b: limit(150) },
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
      arrangeWindows({ id: "root", rect, nodes: committed, layouts, limits: { b: limit(150) } })
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
      limits: { a: sized({ ideal: [200, 100] }) },
      nodes: nodes({ align: { x: "center", y: "end" } }),
    });
    expect(rects.a).toEqual({ x: 203, y: 300, width: 200, height: 100 });
  });

  test("a stretched item stops at its maximum size and starts at the slot origin", () => {
    const { rects } = arrangeWindows({
      id: "root",
      rect,
      layouts,
      limits: { a: sized({ max: [Infinity, 250] }) },
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
    const limits = { a: limit(100, 90), b: limit(140, 50), c: limit(60, 80) };
    expect(minimum({ id: "stack", nodes, layouts, limits })).toEqual({ width: 140, height: 136 });
    expect(minimum({ id: "root", nodes, layouts, limits })).toEqual({ width: 140, height: 166 });
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
