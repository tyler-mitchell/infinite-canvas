import { expect, test } from "vite-plus/test";

import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import { createInfiniteCanvasGroupWindowNode } from "./group-tree";
import { reduceInfiniteCanvasState } from "./reducer";
import { applyInfiniteCanvasRecipe, captureInfiniteCanvasRecipe } from "./recipes";
import type { InfiniteCanvasGroup, InfiniteCanvasState } from "./types";

/**
 * Layout recipes — the fifth module from the README-claims audit, and the one that mutates the
 * document rather than merely drawing it, so a defect here corrupts a user's layout instead of
 * misrendering it.
 *
 * Every claim asserted below is quoted from `README.md` or `recipes.ts`. None had a test.
 */

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

/**
 * `createInfiniteCanvasState` seeds `activeWindowId` to the first selectable window, which seeds
 * `selection.windowIds` with it. Capture takes "the ones asked for, else the selection, else
 * everything", so a fixture that means *the whole canvas* has to say so — the first draft of this
 * file did not, captured one window, and read the resulting single-window `size` as a bug. The
 * precedence rule is asserted directly below rather than left as a trap.
 */
const BOTH = ["a", "b"] as const;

test("a recipe is stored relative to its own top-left, so it drops anywhere", () => {
  // "stored with its origin at (0, 0) and a `size`, so the same recipe drops into any region of
  // an unbounded world."
  const recipe = capture(state(), BOTH)!;

  expect(recipe).not.toBeNull();
  expect(Math.min(...recipe.windows.map((w) => w.rect.x))).toBe(0);
  expect(Math.min(...recipe.windows.map((w) => w.rect.y))).toBe(0);
  // Union of a 300x200 at (100,100) and a 300x200 at (600,400).
  expect(recipe.size).toEqual({ height: 500, width: 800 });
});

test("recipes translate; they do not scale", () => {
  // The headline claim, and the reason it exists: fitting an arrangement into a smaller region
  // would shrink windows below their own `minSize`, quietly violating a constraint the rest of
  // the framework enforces.
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

  // (1000 - 800) / 2 and (1000 - 500) / 2.
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
  // "Half a group is not a group: its tree would name windows the recipe never took, so those
  // windows are captured as floating instead."
  const grouped: InfiniteCanvasState<Kind> = { ...state(), groups: [group(["a", "b"])] };

  expect(capture(grouped, BOTH)!.groups).toHaveLength(1);
  // Capturing only one member must drop the group rather than restore a shell missing a pane.
  expect(capture(grouped, ["a"])!.groups).toHaveLength(0);
  expect(capture(grouped, ["a"])!.windows.map((w) => w.windowId)).toEqual(["a"]);
});

test("applying skips windows the canvas has lost", () => {
  // "Applying it rearranges the windows that exist and skips the ones the canvas has lost."
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
  // "`reconcileInfiniteCanvasGroups` runs on the way back in, so a recipe saved before a window
  // was closed never restores a shell laying out a ghost."
  const grouped: InfiniteCanvasState<Kind> = { ...state(), groups: [group(["a", "b"])] };
  const recipe = capture(grouped, BOTH)!;

  expect(recipe.groups).toHaveLength(1);

  // The canvas has since lost `b`. Restoring must not bring back a two-pane shell.
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
  // "Applying a recipe is one undo entry, for free, because it is one document mutation." The
  // reducer path is the only place that claim can be checked.
  const before = state();
  const recipe = capture(before, BOTH)!;
  const applied = reduceInfiniteCanvasState(before, {
    placement: { origin: { x: 500, y: 500 } },
    recipe,
    type: "recipe.apply",
  });

  expect(applied.history.past).toHaveLength(1);
  // And undoing it returns the document exactly.
  const undone = reduceInfiniteCanvasState(applied, {
    command: { type: "history.undo" },
    type: "command.execute",
  });

  expect(undone.windows.map((w) => w.rect.x)).toEqual(before.windows.map((w) => w.rect.x));
});

test("capturing an empty canvas yields no recipe rather than an empty one", () => {
  const empty: InfiniteCanvasState<Kind> = {
    ...createInfiniteCanvasState<Kind>({ windows: [] }),
    viewport: { height: 800, width: 1200 },
  };

  expect(capture(empty)).toBeNull();
});

test("capture prefers an explicit list, then the selection, then everything", () => {
  // The precedence that caught this file's own author. A fresh state selects its first window, so
  // an unqualified capture takes that window alone rather than the canvas.
  const selected = state();

  expect(selected.selection.windowIds).toEqual(["a"]);
  expect(capture(selected)!.windows.map((w) => w.windowId)).toEqual(["a"]);
  expect(capture(selected, BOTH)!.windows.map((w) => w.windowId)).toEqual(["a", "b"]);

  const unselected: InfiniteCanvasState<Kind> = {
    ...selected,
    selection: { anchorWindowId: null, windowIds: [] },
  };

  expect(capture(unselected)!.windows.map((w) => w.windowId)).toEqual(["a", "b"]);
});
