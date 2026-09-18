import { getSelectedWindowIds } from "./selection";
import { expect, test } from "vite-plus/test";
import { createInfiniteCanvasStore } from "./store";

import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import { createInfiniteCanvasGroupWindowNode } from "./group-tree";
import { applyInfiniteCanvasRecipe, captureInfiniteCanvasRecipe } from "./recipes";
import type { InfiniteCanvasGroup, InfiniteCanvasState } from "./types";

type Kind = "pane";

const windowAt = (id: string, x: number, y: number) =>
  createInfiniteCanvasWindow<Kind>({
    id,
    kind: "pane",
    rect: { height: 200, width: 300, x, y },
    title: id,
  });

const group = (windowIds: readonly string[]): InfiniteCanvasGroup => ({
  id: "shell",
  rect: { height: 400, width: 800, x: 0, y: 0 },
  title: "Shell",
  tree: {
    activeChildId: null,
    axis: "horizontal",
    children: windowIds.map((id) => createInfiniteCanvasGroupWindowNode(id, 1)),
    id: "shell::root",
    kind: "container",
    layout: "split",
    weight: 1,
  },
  zIndex: 1,
});

const state = (): InfiniteCanvasState<Kind> => ({
  ...createInfiniteCanvasState<Kind>({
    windows: [windowAt("a", 100, 100), windowAt("b", 600, 400)],
  }),
  viewport: { height: 800, width: 1200 },
});

const capture = (source: InfiniteCanvasState<Kind>, windowIds?: readonly string[]) =>
  captureInfiniteCanvasRecipe(source, {
    name: "Layout",
    recipeId: "r1",
    ...(windowIds && { windowIds }),
  });

const BOTH = ["a", "b"] as const;

test("a recipe is stored relative to its own top-left, so it drops anywhere", () => {
  const recipe = capture(state(), BOTH)!;

  expect(recipe).not.toBeNull();
  expect(Math.min(...recipe.windows.map((w) => w.rect.x))).toBe(0);
  expect(Math.min(...recipe.windows.map((w) => w.rect.y))).toBe(0);
  expect(recipe.size).toEqual({ height: 500, width: 800 });
});

test("recipes translate; they do not scale", () => {
  const recipe = capture(state(), BOTH)!;
  const applied = applyInfiniteCanvasRecipe(state(), recipe, {
    rect: { height: 100, width: 200, x: 0, y: 0 },
  });

  for (const window of applied.windows) {
    expect(window.rect.width).toBe(300);
    expect(window.rect.height).toBe(200);
  }
});

test("an arrangement placed into a rect is centred in it at natural size", () => {
  const recipe = capture(state(), BOTH)!;
  const applied = applyInfiniteCanvasRecipe(state(), recipe, {
    rect: { height: 1000, width: 1000, x: 0, y: 0 },
  });
  const left = Math.min(...applied.windows.map((w) => w.rect.x));
  const top = Math.min(...applied.windows.map((w) => w.rect.y));

  expect(left).toBe(100);
  expect(top).toBe(250);
});

test("an origin placement pins the top-left exactly", () => {
  const recipe = capture(state(), BOTH)!;
  const applied = applyInfiniteCanvasRecipe(state(), recipe, { origin: { x: -50, y: 25 } });

  expect(Math.min(...applied.windows.map((w) => w.rect.x))).toBe(-50);
  expect(Math.min(...applied.windows.map((w) => w.rect.y))).toBe(25);
});

test("a group is captured only when every one of its members is", () => {
  const grouped: InfiniteCanvasState<Kind> = { ...state(), groups: [group(["a", "b"])] };

  expect(capture(grouped, BOTH)!.groups).toHaveLength(1);
  expect(capture(grouped, ["a"])!.groups).toHaveLength(0);
  expect(capture(grouped, ["a"])!.windows.map((w) => w.windowId)).toEqual(["a"]);
});

test("applying skips windows the canvas has lost", () => {
  const recipe = capture(state(), BOTH)!;
  const withoutB: InfiniteCanvasState<Kind> = {
    ...createInfiniteCanvasState<Kind>({ windows: [windowAt("a", 0, 0)] }),
    viewport: { height: 800, width: 1200 },
  };
  const applied = applyInfiniteCanvasRecipe(withoutB, recipe, { origin: { x: 0, y: 0 } });

  expect(applied.windows.map((w) => w.id)).toEqual(["a"]);
  expect(applied.windows[0]!.rect.x).toBe(0);
});

test("a restored recipe never lays out a ghost", () => {
  const grouped: InfiniteCanvasState<Kind> = { ...state(), groups: [group(["a", "b"])] };
  const recipe = capture(grouped, BOTH)!;

  expect(recipe.groups).toHaveLength(1);

  const withoutB: InfiniteCanvasState<Kind> = {
    ...createInfiniteCanvasState<Kind>({ windows: [windowAt("a", 0, 0)] }),
    viewport: { height: 800, width: 1200 },
  };
  const applied = applyInfiniteCanvasRecipe(withoutB, recipe, { origin: { x: 0, y: 0 } });
  const live = new Set(applied.windows.map((w) => w.id));

  for (const restored of applied.groups) {
    const named = JSON.stringify(restored.tree).match(/"id":"([^"]+)"/g) ?? [];

    for (const entry of named) {
      const id = entry.slice(6, -1);

      if (id !== "shell::root") {
        expect(live.has(id)).toBe(true);
      }
    }
  }
});

test("applying a recipe is a single undo entry", () => {
  const before = state();
  const recipe = capture(before, BOTH)!;
  const store = createInfiniteCanvasStore({ initialState: before });
  store.dispatch({
    placement: { origin: { x: 500, y: 500 } },
    recipe,
    type: "recipe.apply",
  });

  expect(store.history.undos$.peek()).toBe(1);
  store.dispatch({ type: "history.undo" });
  expect(store.getState().windows.map((w) => w.rect.x)).toEqual(
    before.windows.map((w) => w.rect.x),
  );
});

test("capturing an empty canvas yields no recipe rather than an empty one", () => {
  const empty: InfiniteCanvasState<Kind> = {
    ...createInfiniteCanvasState<Kind>({ windows: [] }),
    viewport: { height: 800, width: 1200 },
  };

  expect(capture(empty)).toBeNull();
});

test("capture prefers an explicit list, then the selection, then everything", () => {
  const selected = state();

  expect(getSelectedWindowIds(selected.selection)).toEqual(["a"]);
  expect(capture(selected)!.windows.map((w) => w.windowId)).toEqual(["a"]);
  expect(capture(selected, BOTH)!.windows.map((w) => w.windowId)).toEqual(["a", "b"]);

  const unselected: InfiniteCanvasState<Kind> = {
    ...selected,
    selection: { anchorTarget: null, targets: [] },
  };

  expect(capture(unselected)!.windows.map((w) => w.windowId)).toEqual(["a", "b"]);
});
