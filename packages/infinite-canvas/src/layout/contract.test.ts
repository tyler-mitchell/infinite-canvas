import { type } from "arktype";
import { describe, expect, test } from "vite-plus/test";
import { arrangeWindows, bindLayout, getWindowSize, type LayoutNode } from "./arrange";
import { grid } from "./grid";
import { split, type Layout } from "./kinds";

const stripOptions = type({ type: "'strip'", gap: "number >= 0 = 16", view: "number > 0" });
const stripItem = type({ proportion: "0 < number <= 1 = 0.5" });

const strip: Layout<typeof stripOptions, typeof stripItem> = {
  options: stripOptions,
  item: stripItem,
  size: ({ options, items, proposal }) => ({
    height: proposal.height ?? 0,
    width: items.reduce(
      (total, { item }) => total + item.proportion * options.view + options.gap,
      -options.gap,
    ),
  }),
  arrange: ({ options, items, rect }) => {
    const widths = items.map(({ item }) => item.proportion * options.view);
    const children = items.map(({ id }, index) => ({
      id,
      visible: true,
      rect: {
        ...rect,
        width: widths[index],
        x: rect.x + widths.slice(0, index).reduce((total, width) => total + width + options.gap, 0),
      },
    }));
    return {
      children,
      controls: [],
      size: {
        height: rect.height,
        width: widths.reduce((total, width) => total + width + options.gap, -options.gap),
      },
    };
  },
};

const masterOptions = type({ type: "'master'", ratio: "0 < number < 1 = 0.6" });
const masterItem = type({});

const master: Layout<typeof masterOptions, typeof masterItem> = {
  options: masterOptions,
  item: masterItem,
  size: ({ proposal }) => ({ width: proposal.width ?? 0, height: proposal.height ?? 0 }),
  arrange: ({ options, items, rect }) => {
    const [first, ...rest] = items;
    const width = rest.length === 0 ? rect.width : rect.width * options.ratio;
    return {
      size: rect,
      controls: [],
      children:
        first === undefined
          ? []
          : [
              { id: first.id, visible: true, rect: { ...rect, width } },
              ...rest.map(({ id }, index) => ({
                id,
                visible: true,
                rect: {
                  x: rect.x + width,
                  width: rect.width - width,
                  y: rect.y + (index * rect.height) / rest.length,
                  height: rect.height / rest.length,
                },
              })),
            ],
    };
  },
};

const layouts = {
  split: bindLayout(split),
  grid: bindLayout(grid),
  strip: bindLayout(strip),
  master: bindLayout(master),
};
const rect = { x: 0, y: 0, width: 1000, height: 600 };

describe("a consumer can write", () => {
  test("a scrolling strip: a new column never resizes the columns that exist, and the strip grows past its view", () => {
    const before: Record<string, LayoutNode> = {
      root: { layout: { type: "strip", view: 1000 }, children: ["a", "b"] },
      a: {},
      b: { item: { proportion: 0.33 } },
    };
    const after = {
      ...before,
      root: { ...before.root, children: ["a", "b", "c"] },
      c: { item: { proportion: 1 } },
    };
    const first = arrangeWindows({ id: "root", rect, nodes: before, layouts });
    const second = arrangeWindows({ id: "root", rect, nodes: after, layouts });
    expect(second.rects.a).toEqual(first.rects.a);
    expect(second.rects.b).toEqual(first.rects.b);
    expect(second.rects.c).toEqual({ x: 862, y: 0, width: 1000, height: 600 });
    expect(second.size.width).toBe(1862);
  });

  test("a master and stack layout over an ordered list", () => {
    const nodes: Record<string, LayoutNode> = {
      root: { layout: { type: "master" }, children: ["a", "b", "c"] },
      a: {},
      b: {},
      c: {},
    };
    const { rects } = arrangeWindows({ id: "root", rect, nodes, layouts });
    expect(rects.a).toEqual({ x: 0, y: 0, width: 600, height: 600 });
    expect(rects.c).toEqual({ x: 600, y: 300, width: 400, height: 300 });
  });
});

describe("nesting", () => {
  test("a card that is also a board takes its rows in the outer board from the height of its own board", () => {
    const nodes: Record<string, LayoutNode> = {
      board: { layout: { type: "grid", columns: 4, gap: 0 }, children: ["repo", "note"] },
      repo: {
        layout: { type: "grid", columns: 2, gap: 0 },
        children: ["x", "y", "z"],
        item: { columnSpan: 2 },
      },
      note: {},
      x: {},
      y: { item: { rowSpan: 2 } },
      z: {},
    };
    const { rects, size } = arrangeWindows({
      id: "board",
      rect: { ...rect, width: 800 },
      nodes,
      layouts,
    });
    expect(getWindowSize({ id: "repo", nodes, layouts })({ width: 400 })).toEqual({
      width: 400,
      height: 400,
    });
    expect(rects.repo).toEqual({ x: 0, y: 0, width: 400, height: 400 });
    expect(rects.y).toEqual({ x: 200, y: 0, width: 200, height: 400 });
    expect(rects.z).toEqual({ x: 0, y: 200, width: 200, height: 200 });
    expect(rects.note).toEqual({ x: 400, y: 0, width: 200, height: 200 });
    expect(size).toEqual({ width: 800, height: 600 });
  });

  test("a strip inside a split inside a strip arranges every level with the same visit", () => {
    const nodes: Record<string, LayoutNode> = {
      root: { layout: { type: "strip", view: 1000, gap: 0 }, children: ["pair", "c"] },
      pair: {
        layout: { type: "split", axis: "vertical", gap: 0 },
        children: ["a", "inner"],
        item: { proportion: 1 },
      },
      inner: { layout: { type: "strip", view: 500, gap: 0 }, children: ["d"] },
      a: {},
      c: {},
      d: {},
    };
    const { rects } = arrangeWindows({ id: "root", rect, nodes, layouts });
    expect(rects.a).toEqual({ x: 0, y: 0, width: 1000, height: 300 });
    expect(rects.d).toEqual({ x: 0, y: 300, width: 250, height: 300 });
    expect(rects.c).toEqual({ x: 1000, y: 0, width: 500, height: 600 });
  });
});
