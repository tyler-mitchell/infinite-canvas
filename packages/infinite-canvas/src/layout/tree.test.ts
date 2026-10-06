import { describe, expect, test } from "vite-plus/test";
import { bindLayout } from "./arrange";
import { grid } from "./grid";
import { accordion, split, tabs, type DockEdge } from "./kinds";
import {
  getDescendants,
  getDockChange,
  getParents,
  getReorderedChildren,
  getUndockChange,
  type Tree,
} from "./tree";

const layouts = {
  split: bindLayout(split),
  tabs: bindLayout(tabs),
  accordion: bindLayout(accordion),
  grid: bindLayout(grid),
};
const leaf = { kind: "note" };
const wrappers = {
  north: { type: "split", axis: "vertical" },
  south: { type: "split", axis: "vertical" },
  east: { type: "split", axis: "horizontal" },
  west: { type: "split", axis: "horizontal" },
  center: { type: "tabs" },
};
const dock = (input: {
  windows: Tree;
  window: string;
  target: string;
  edge: DockEdge;
  wrapperId: string;
}) =>
  getDockChange({
    windows: input.windows,
    layouts,
    window: input.window,
    target: input.target,
    edge: input.edge,
    wrapper: { id: input.wrapperId, layout: wrappers[input.edge] },
  });
const undock = (input: { windows: Tree; window: string }) => getUndockChange({ ...input, layouts });

describe("getDockChange", () => {
  test("wraps a floating target in a split on an edge, with the new window on that edge", () => {
    const windows: Tree = { a: leaf, b: leaf };
    const east = dock({ windows, window: "b", target: "a", edge: "east", wrapperId: "w" });
    expect(east.wrapper).toEqual({ id: "w", around: "a" });
    expect(east.windows.w).toEqual({
      layout: { type: "split", axis: "horizontal" },
      children: ["a", "b"],
    });
    const north = dock({ windows, window: "b", target: "a", edge: "north", wrapperId: "w" });
    expect(north.windows.w).toEqual({
      layout: { type: "split", axis: "vertical" },
      children: ["b", "a"],
    });
  });

  test("wraps a target in tabs on the center", () => {
    const change = dock({
      windows: { a: leaf, b: leaf },
      window: "b",
      target: "a",
      edge: "center",
      wrapperId: "w",
    });
    expect(change.windows.w).toEqual({ layout: { type: "tabs" }, children: ["a", "b"] });
  });

  test("inserts a sibling and halves the factor when the parent splits on the same axis", () => {
    const windows: Tree = {
      root: { layout: { type: "split", axis: "horizontal" }, children: ["a", "c"] },
      a: { ...leaf, item: { factor: 3 } },
      c: leaf,
      b: { ...leaf, item: { column: 2 } },
    };
    const change = dock({ windows, window: "b", target: "a", edge: "west", wrapperId: "w" });
    expect(change.wrapper).toBeUndefined();
    expect(change.windows.root.children).toEqual(["b", "a", "c"]);
    expect(change.windows.a.item).toEqual({ factor: 1.5 });
    expect(change.windows.b).toEqual({ kind: "note", item: { factor: 1.5 } });
  });

  test("puts the wrapper in the target's slot, with the target's item properties", () => {
    const windows: Tree = {
      root: { layout: { type: "split", axis: "horizontal" }, children: ["a", "c"] },
      a: { ...leaf, item: { factor: 3 } },
      c: leaf,
      b: leaf,
    };
    const change = dock({ windows, window: "b", target: "a", edge: "south", wrapperId: "w" });
    expect(change.windows.root.children).toEqual(["w", "c"]);
    expect(change.windows.w).toEqual({
      layout: { type: "split", axis: "vertical" },
      children: ["a", "b"],
      item: { factor: 3 },
    });
    expect(change.windows.a).toEqual(leaf);
  });

  test("appends to a split container on its center with the mean factor, and still wraps a split child in tabs", () => {
    const windows: Tree = {
      root: { layout: { type: "split", axis: "horizontal" }, children: ["a", "c"] },
      a: { ...leaf, item: { factor: 3 } },
      c: leaf,
      b: leaf,
    };
    const into = dock({ windows, window: "b", target: "root", edge: "center", wrapperId: "w" });
    expect(into.wrapper).toBeUndefined();
    expect(into.windows.root.children).toEqual(["a", "c", "b"]);
    expect(into.windows.b).toEqual({ kind: "note", item: { factor: 2 } });
    const onto = dock({ windows, window: "b", target: "a", edge: "center", wrapperId: "w" });
    expect(onto.windows.root.children).toEqual(["w", "c"]);
    expect(onto.windows.w).toEqual({
      layout: { type: "tabs" },
      children: ["a", "b"],
      item: { factor: 3 },
    });
  });

  test("appends to a container that is not a split on the center", () => {
    const windows: Tree = {
      board: { kind: "repo", layout: { type: "grid" }, children: ["a"] },
      a: leaf,
      b: leaf,
    };
    const change = dock({ windows, window: "b", target: "board", edge: "center", wrapperId: "w" });
    expect(change.windows.board.children).toEqual(["a", "b"]);
    expect(change.wrapper).toBeUndefined();
  });
});

describe("getUndockChange", () => {
  test("dissolves a split that is left with one child, and the child takes its slot and item properties", () => {
    const windows: Tree = {
      root: { layout: { type: "split", axis: "horizontal" }, children: ["column", "c"] },
      column: {
        layout: { type: "split", axis: "vertical" },
        children: ["a", "b"],
        item: { factor: 2 },
      },
      a: { ...leaf, item: { factor: 5 } },
      b: leaf,
      c: leaf,
    };
    const change = undock({ windows, window: "b" });
    expect(change.dissolved).toEqual([{ id: "column", into: "a" }]);
    expect(change.windows.root.children).toEqual(["a", "c"]);
    expect(change.windows.a).toEqual({ kind: "note", item: { factor: 2 } });
    expect(change.windows.b).toEqual(leaf);
    expect(change.windows.column).toBeUndefined();
  });

  test("dissolves a top-level split into its last child", () => {
    const windows: Tree = {
      root: { layout: { type: "split" }, children: ["a", "b"] },
      a: leaf,
      b: leaf,
    };
    const change = undock({ windows, window: "a" });
    expect(change.dissolved).toEqual([{ id: "root", into: "b" }]);
    expect(Object.keys(change.windows).toSorted()).toEqual(["a", "b"]);
  });

  test("flattens a promoted split that has the axis of its new parent, and keeps the proportions", () => {
    const windows: Tree = {
      root: { layout: { type: "split", axis: "horizontal" }, children: ["column", "z"] },
      column: {
        layout: { type: "split", axis: "vertical" },
        children: ["row", "y"],
        item: { factor: 2 },
      },
      row: { layout: { type: "split", axis: "horizontal" }, children: ["a", "b"] },
      a: { ...leaf, item: { factor: 1 } },
      b: { ...leaf, item: { factor: 3 } },
      y: leaf,
      z: leaf,
    };
    const change = undock({ windows, window: "y" });
    expect(change.windows.root.children).toEqual(["a", "b", "z"]);
    expect(change.windows.a.item).toEqual({ factor: 0.5 });
    expect(change.windows.b.item).toEqual({ factor: 1.5 });
    expect(change.windows.column).toBeUndefined();
    expect(change.windows.row).toBeUndefined();
  });

  test("removes an empty container and then settles its parent", () => {
    const windows: Tree = {
      root: { layout: { type: "split" }, children: ["stack", "c"] },
      stack: { layout: { type: "tabs" }, children: ["a"] },
      a: leaf,
      c: leaf,
    };
    const change = undock({ windows, window: "a" });
    expect(change.dissolved).toEqual([
      { id: "stack", into: null },
      { id: "root", into: "c" },
    ]);
    expect(Object.keys(change.windows).toSorted()).toEqual(["a", "c"]);
  });

  test("keeps a window that has its own content when its last child leaves", () => {
    const windows: Tree = {
      board: { kind: "repo", layout: { type: "grid" }, children: ["a"] },
      a: leaf,
    };
    const change = undock({ windows, window: "a" });
    expect(change.dissolved).toEqual([]);
    expect(change.windows.board).toEqual({ kind: "repo", layout: { type: "grid" }, children: [] });
  });

  test("keeps a tab stack with one child", () => {
    const windows: Tree = {
      stack: { layout: { type: "tabs" }, children: ["a", "b"] },
      a: leaf,
      b: leaf,
    };
    expect(undock({ windows, window: "a" }).windows.stack.children).toEqual(["b"]);
  });
});

test("derives parents and descendants from the child lists", () => {
  const windows: Tree = {
    root: { layout: { type: "split" }, children: ["a", "stack"] },
    stack: { layout: { type: "tabs" }, children: ["b"] },
    a: leaf,
    b: leaf,
  };
  expect(getParents(windows)).toEqual({ a: "root", stack: "root", b: "stack" });
  expect(getDescendants({ windows, id: "root" })).toEqual(["a", "stack", "b"]);
});

test("reorders a child before or after a target", () => {
  expect(
    getReorderedChildren({ children: ["a", "b", "c"], child: "a", target: "c", after: true }),
  ).toEqual(["b", "c", "a"]);
  expect(
    getReorderedChildren({ children: ["a", "b", "c"], child: "c", target: "a", after: false }),
  ).toEqual(["c", "a", "b"]);
  expect(
    getReorderedChildren({ children: ["a", "b", "c"], child: "a", target: "b", after: false }),
  ).toEqual(["a", "b", "c"]);
});
