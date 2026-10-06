import { getSelectedWindowIds } from "./selection";
import { expect, test } from "vite-plus/test";

import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import { createInfiniteCanvasGroup } from "./group-state";
import { createInfiniteCanvasStore } from "./store";
import { captureInfiniteCanvasRecipe, applyInfiniteCanvasRecipe } from "./recipes";
import type { DocumentContent, InfiniteCanvasState } from "./types";

type Kind = "note";

const windowAt = (id: string, x: number, y: number) =>
  createInfiniteCanvasWindow<Kind>({ id, kind: "note", rect: { height: 100, width: 100, x, y } });

const baseState = (): InfiniteCanvasState<Kind> =>
  createInfiniteCanvasState<Kind>({
    windows: [windowAt("a", 0, 0), windowAt("b", 200, 0), windowAt("c", 400, 0)],
  });

const ALL = ["a", "b", "c"] as const;

test("native history records document content", () => {
  const store = createInfiniteCanvasStore({ initialState: baseState() });
  store.dispatch({ type: "window.setTitle", windowId: "a", title: "Edited" });
  expect(
    Object.keys(store.history.getHistory()[0]!).toSorted((a, b) => a.localeCompare(b)),
  ).toStrictEqual(["activeWorkspaceId", "connections", "groups", "windows", "workspaces"]);
});

test("undo restores the document and leaves the camera alone", () => {
  const store = createInfiniteCanvasStore({
    initialState: {
      ...baseState(),
      camera: { center: { x: 50, y: 60 }, zoom: 2 },
    },
  });
  store.dispatch({
    type: "window.setRect",
    windowId: "a",
    rect: { x: 999, y: 0, width: 100, height: 100 },
  });
  store.dispatch({ type: "history.undo" });
  const undone = store.getState();
  expect(undone.windows.find((window) => window.id === "a")?.rect.x).toBe(0);
  expect(undone.camera).toStrictEqual({ center: { x: 50, y: 60 }, zoom: 2 });
});

test("an unchanged document creates no undo entry", () => {
  const store = createInfiniteCanvasStore({ initialState: baseState() });
  store.dispatch({
    type: "window.setTitle",
    windowId: "a",
    title: store.getState().windows[0]!.title,
  });
  expect(store.history.undos$.peek()).toBe(0);
});

test("PERSIST-003: three edits undo in reverse order, each restoring its own prior document", () => {
  const store = createInfiniteCanvasStore({ initialState: baseState() });
  for (const [index, windowId] of ALL.entries()) {
    store.dispatch({
      type: "window.setRect",
      windowId,
      rect: { x: (index + 1) * 10, y: 0, width: 100, height: 100 },
    });
  }
  const s3 = store.getState();

  const xOf = (state: InfiniteCanvasState<Kind>, id: string) =>
    state.windows.find((window) => window.id === id)?.rect.x;

  expect([xOf(s3, "a"), xOf(s3, "b"), xOf(s3, "c")]).toStrictEqual([10, 20, 30]);

  store.dispatch({ type: "history.undo" });
  const u1 = store.getState();
  store.dispatch({ type: "history.undo" });
  const u2 = store.getState();
  store.dispatch({ type: "history.undo" });
  const u3 = store.getState();

  expect([xOf(u1, "a"), xOf(u1, "b"), xOf(u1, "c")]).toStrictEqual([10, 20, 400]);
  expect([xOf(u2, "a"), xOf(u2, "b"), xOf(u2, "c")]).toStrictEqual([10, 200, 400]);
  expect([xOf(u3, "a"), xOf(u3, "b"), xOf(u3, "c")]).toStrictEqual([0, 200, 400]);
});

test("PERSIST-003: redo replays the undone edits in order", () => {
  const store = createInfiniteCanvasStore({ initialState: baseState() });
  store.dispatch({
    type: "window.setRect",
    windowId: "a",
    rect: { x: 10, y: 0, width: 100, height: 100 },
  });
  store.dispatch({
    type: "window.setRect",
    windowId: "b",
    rect: { x: 20, y: 0, width: 100, height: 100 },
  });
  store.dispatch({ type: "history.undo" });
  store.dispatch({ type: "history.undo" });
  store.dispatch({ type: "history.redo" });
  store.dispatch({ type: "history.redo" });
  const forward = store.getState();
  expect(forward.windows.find((window) => window.id === "a")?.rect.x).toBe(10);
  expect(forward.windows.find((window) => window.id === "b")?.rect.x).toBe(20);
});

test("PERSIST-003: a new edit orphans the redo branch", () => {
  const store = createInfiniteCanvasStore({ initialState: baseState(), history: { limit: 3 } });
  store.dispatch({ type: "window.setTitle", windowId: "a", title: "First" });
  store.dispatch({ type: "history.undo" });
  expect(store.history.redos$.peek()).toBe(1);
  store.dispatch({ type: "window.setTitle", windowId: "b", title: "New branch" });
  expect(store.history.redos$.peek()).toBe(0);
});

test("undo and redo at the ends of the stack are no-ops, not errors", () => {
  const store = createInfiniteCanvasStore({ initialState: baseState() });
  const state = store.getState();
  store.dispatch({ type: "history.undo" });
  store.dispatch({ type: "history.redo" });
  expect(store.getState()).toBe(state);
  expect(store.history.undos$.peek()).toBe(0);
  expect(store.history.redos$.peek()).toBe(0);
});

test("undo clears the live interaction — it cannot survive the document it was editing", () => {
  const store = createInfiniteCanvasStore({ initialState: baseState() });
  store.dispatch({
    type: "interaction.startMove",
    pointerId: 1,
    point: { x: 0, y: 0 },
    target: { type: "window", id: "a" },
  });
  store.dispatch({ type: "interaction.step", pointerId: 1, point: { x: 100, y: 0 } });
  store.dispatch({ type: "history.undo" });
  expect(store.getState().interaction).toBeNull();
  expect(store.getState().windows[0]!.rect.x).toBe(0);
});

test("the stack is bounded, dropping the oldest entry rather than growing forever", () => {
  const store = createInfiniteCanvasStore({ initialState: baseState(), history: { limit: 3 } });
  for (const title of ["One", "Two", "Three", "Four", "Five"])
    store.dispatch({ type: "window.setTitle", windowId: "a", title });
  expect(store.history.undos$.peek()).toBe(3);
  expect(store.history.getHistory()).toHaveLength(4);
});

test("stores have independent history", () => {
  const first = createInfiniteCanvasStore({ initialState: baseState() });
  const second = createInfiniteCanvasStore({ initialState: baseState() });
  first.dispatch({ type: "window.setTitle", windowId: "a", title: "Changed" });
  expect(first.history.undos$.peek()).toBe(1);
  expect(second.history.undos$.peek()).toBe(0);
});

test("RECIPE: a captured arrangement is stored relative to its own origin", () => {
  const state = baseState();
  const recipe = captureInfiniteCanvasRecipe(state, {
    name: "row",
    recipeId: "r1",
    windowIds: ALL,
  });

  expect(recipe).not.toBeNull();
  expect(recipe?.windows.map((window) => window.rect.x)).toStrictEqual([0, 200, 400]);
  expect(recipe?.size.width).toBe(500);
});

test("RECIPE: applying at an origin translates rather than scales", () => {
  const state = baseState();
  const recipe = captureInfiniteCanvasRecipe(state, {
    name: "row",
    recipeId: "r1",
    windowIds: ALL,
  });
  const applied = applyInfiniteCanvasRecipe(state, recipe!, { origin: { x: 1000, y: 500 } });

  expect(applied.windows.map((window) => window.rect.x)).toStrictEqual([1000, 1200, 1400]);
  expect(applied.windows.map((window) => window.rect.width)).toStrictEqual([100, 100, 100]);
});

test("RECIPE: applying into a rect centres the arrangement at natural size", () => {
  const state = baseState();
  const recipe = captureInfiniteCanvasRecipe(state, {
    name: "row",
    recipeId: "r1",
    windowIds: ALL,
  });
  const applied = applyInfiniteCanvasRecipe(state, recipe!, {
    rect: { height: 100, width: 900, x: 0, y: 0 },
  });

  expect(applied.windows[0]?.rect.x).toBe(200);
  expect(applied.windows.map((window) => window.rect.width)).toStrictEqual([100, 100, 100]);
});

test("RECIPE: a window the canvas has lost is skipped, not resurrected", () => {
  const state = baseState();
  const recipe = captureInfiniteCanvasRecipe(state, {
    name: "row",
    recipeId: "r1",
    windowIds: ALL,
  });
  const withoutC = { ...state, windows: state.windows.filter((window) => window.id !== "c") };
  const applied = applyInfiniteCanvasRecipe(withoutC, recipe!, { origin: { x: 0, y: 0 } });

  expect(applied.windows.map((window) => window.id)).toStrictEqual(["a", "b"]);
});

test("RECIPE: a group is captured only when every member comes along", () => {
  const grouped = createInfiniteCanvasGroup(baseState(), {
    groupId: "g1",
    rect: { height: 100, width: 300, x: 0, y: 0 },
    windowIds: ["a", "b"],
  });
  const partial = captureInfiniteCanvasRecipe(grouped, {
    name: "partial",
    recipeId: "r1",
    windowIds: ["a", "c"],
  });
  const whole = captureInfiniteCanvasRecipe(grouped, {
    name: "whole",
    recipeId: "r2",
    windowIds: ["a", "b", "c"],
  });

  expect(partial?.groups).toStrictEqual([]);
  expect(whole?.groups.map((group) => group.groupId)).toStrictEqual(["g1"]);
});

test("RECIPE: capture takes the requested ids, else the selection, else everything", () => {
  const state = baseState();

  expect(getSelectedWindowIds(state.selection)).toStrictEqual(["a"]);

  const fromSelection = captureInfiniteCanvasRecipe(state, { name: "sel", recipeId: "r1" });

  expect(fromSelection?.windows.map((window) => window.windowId)).toStrictEqual(["a"]);

  const requested = captureInfiniteCanvasRecipe(state, {
    name: "req",
    recipeId: "r2",
    windowIds: ["b", "c"],
  });

  expect(requested?.windows.map((window) => window.windowId)).toStrictEqual(["b", "c"]);

  const cleared = { ...state, selection: { anchorTarget: null, targets: [] } };
  const everything = captureInfiniteCanvasRecipe(cleared, { name: "all", recipeId: "r3" });

  expect(everything?.windows.map((window) => window.windowId)).toStrictEqual(["a", "b", "c"]);
});

test("RECIPE: capturing nothing returns null rather than an empty recipe", () => {
  const empty = createInfiniteCanvasState<Kind>({ windows: [] });

  expect(captureInfiniteCanvasRecipe(empty, { name: "none", recipeId: "r1" })).toBeNull();
});

test("RECIPE: applying a recipe naming no live window leaves the state untouched", () => {
  const state = baseState();
  const recipe = captureInfiniteCanvasRecipe(state, {
    name: "row",
    recipeId: "r1",
    windowIds: ALL,
  });
  const elsewhere = createInfiniteCanvasState<Kind>({ windows: [windowAt("z", 0, 0)] });

  expect(applyInfiniteCanvasRecipe(elsewhere, recipe!, { origin: { x: 0, y: 0 } })).toBe(elsewhere);
});

const editEveryDocumentField = (state: InfiniteCanvasState<Kind>): DocumentContent<Kind> => ({
  connections: [{ id: "edge", kind: "link", from: "a", to: "b" }],
  activeWorkspaceId: "research",
  groups: [
    {
      id: "shell",
      rect: { height: 400, width: 800, x: 0, y: 0 },
      title: "Shell",
      tree: { id: "a", kind: "window", weight: 1 },
      zIndex: 1,
    },
  ],
  windows: state.windows.filter((window) => window.id !== "c"),
  workspaces: [
    {
      camera: state.camera,
      id: "research",
      selection: { anchorTarget: null, targets: [] },
      title: "Research",
      windowIds: ["a"],
    },
  ],
});

test("undo restores windows, groups, connections, workspaces, and the active workspace", () => {
  const store = createInfiniteCanvasStore({ initialState: baseState() });
  const before = store.snapshot();
  store.document$.assign(editEveryDocumentField(store.getState()));
  expect(store.history.undos$.peek()).toBe(1);
  expect(store.snapshot()).toMatchObject({
    activeWorkspaceId: "research",
    connections: [{ id: "edge", kind: "link", from: "a", to: "b" }],
    groups: [
      {
        id: "shell",
        title: "Shell",
        zIndex: 1,
        rect: { x: 0, y: 0, width: 800, height: 400 },
        tree: { id: "a", kind: "window", weight: 1 },
      },
    ],
    windows: [
      { id: "a", kind: "note", rect: { x: 0, y: 0, width: 100, height: 100 } },
      { id: "b", kind: "note", rect: { x: 200, y: 0, width: 100, height: 100 } },
    ],
    workspaces: [
      {
        id: "research",
        title: "Research",
        windowIds: ["a"],
        camera: { center: { x: 0, y: 0 }, zoom: 1 },
        selection: { anchorTarget: null, targets: [] },
      },
    ],
  });
  store.dispatch({ type: "history.undo" });
  expect(store.history.undos$.peek()).toBe(0);
  expect(store.history.redos$.peek()).toBe(1);
  expect(store.snapshot()).toMatchObject({
    activeWorkspaceId: null,
    connections: [],
    groups: [],
    windows: [
      { id: "a", kind: "note", rect: { x: 0, y: 0, width: 100, height: 100 } },
      { id: "b", kind: "note", rect: { x: 200, y: 0, width: 100, height: 100 } },
      { id: "c", kind: "note", rect: { x: 400, y: 0, width: 100, height: 100 } },
    ],
    workspaces: [],
  });
  expect(store.snapshot()).toEqual(before);
});
