import { expect, test } from "vite-plus/test";

import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import { createInfiniteCanvasGroup } from "./group-state";
import {
  EMPTY_INFINITE_CANVAS_HISTORY,
  INFINITE_CANVAS_HISTORY_LIMIT,
  canRedoInfiniteCanvas,
  canUndoInfiniteCanvas,
  getInfiniteCanvasDocument,
  isSameInfiniteCanvasDocument,
  pushInfiniteCanvasHistory,
  redoInfiniteCanvasHistory,
  undoInfiniteCanvasHistory,
} from "./history";
import { captureInfiniteCanvasRecipe, applyInfiniteCanvasRecipe } from "./recipes";
import type { InfiniteCanvasState } from "./types";

type Kind = "note";

const windowAt = (id: string, x: number, y: number) =>
  createInfiniteCanvasWindow<Kind>({ id, kind: "note", rect: { height: 100, width: 100, x, y } });

const baseState = (): InfiniteCanvasState<Kind> =>
  createInfiniteCanvasState<Kind>({
    windows: [windowAt("a", 0, 0), windowAt("b", 200, 0), windowAt("c", 400, 0)],
  });

const ALL = ["a", "b", "c"] as const;

const moveWindow = (state: InfiniteCanvasState<Kind>, id: string, x: number) => ({
  ...state,
  windows: state.windows.map((window) =>
    window.id === id ? { ...window, rect: { ...window.rect, x } } : window,
  ),
});

const commitEdit = (state: InfiniteCanvasState<Kind>, next: InfiniteCanvasState<Kind>) => ({
  ...next,
  history: pushInfiniteCanvasHistory(state.history, getInfiniteCanvasDocument(state)),
});

test("the document is what was arranged, not how it is being looked at", () => {
  const state = baseState();
  const document = getInfiniteCanvasDocument(state);

  expect(Object.keys(document).toSorted()).toStrictEqual([
    "activeWorkspaceId",
    "groups",
    "windows",
    "workspaces",
  ]);
});

test("undo restores the document and leaves the camera alone", () => {
  const state = baseState();
  const moved = commitEdit(state, moveWindow(state, "a", 999));
  const panned = { ...moved, camera: { center: { x: 50, y: 60 }, zoom: 2 } };
  const undone = undoInfiniteCanvasHistory(panned);

  expect(undone.windows.find((window) => window.id === "a")?.rect.x).toBe(0);
  expect(undone.camera).toStrictEqual({ center: { x: 50, y: 60 }, zoom: 2 });
});

test("reference equality is the change test, so a no-op edit is not an edit", () => {
  const state = baseState();

  expect(
    isSameInfiniteCanvasDocument(
      getInfiniteCanvasDocument(state),
      getInfiniteCanvasDocument(state),
    ),
  ).toBe(true);
  expect(
    isSameInfiniteCanvasDocument(
      getInfiniteCanvasDocument(state),
      getInfiniteCanvasDocument(moveWindow(state, "a", 1)),
    ),
  ).toBe(false);
});

test("PERSIST-003: three edits undo in reverse order, each restoring its own prior document", () => {
  const s0 = baseState();
  const s1 = commitEdit(s0, moveWindow(s0, "a", 10));
  const s2 = commitEdit(s1, moveWindow(s1, "b", 20));
  const s3 = commitEdit(s2, moveWindow(s2, "c", 30));

  const xOf = (state: InfiniteCanvasState<Kind>, id: string) =>
    state.windows.find((window) => window.id === id)?.rect.x;

  expect([xOf(s3, "a"), xOf(s3, "b"), xOf(s3, "c")]).toStrictEqual([10, 20, 30]);

  const u1 = undoInfiniteCanvasHistory(s3);
  const u2 = undoInfiniteCanvasHistory(u1);
  const u3 = undoInfiniteCanvasHistory(u2);

  expect([xOf(u1, "a"), xOf(u1, "b"), xOf(u1, "c")]).toStrictEqual([10, 20, 400]);
  expect([xOf(u2, "a"), xOf(u2, "b"), xOf(u2, "c")]).toStrictEqual([10, 200, 400]);
  expect([xOf(u3, "a"), xOf(u3, "b"), xOf(u3, "c")]).toStrictEqual([0, 200, 400]);
});

test("PERSIST-003: redo replays the undone edits in order", () => {
  const s0 = baseState();
  const s1 = commitEdit(s0, moveWindow(s0, "a", 10));
  const s2 = commitEdit(s1, moveWindow(s1, "b", 20));

  const back = undoInfiniteCanvasHistory(undoInfiniteCanvasHistory(s2));
  const forward = redoInfiniteCanvasHistory(redoInfiniteCanvasHistory(back));

  expect(forward.windows.find((window) => window.id === "a")?.rect.x).toBe(10);
  expect(forward.windows.find((window) => window.id === "b")?.rect.x).toBe(20);
});

test("PERSIST-003: a new edit orphans the redo branch", () => {
  const s0 = baseState();
  const s1 = commitEdit(s0, moveWindow(s0, "a", 10));
  const undone = undoInfiniteCanvasHistory(s1);

  expect(canRedoInfiniteCanvas(undone)).toBe(true);

  const diverged = commitEdit(undone, moveWindow(undone, "b", 77));

  expect(canRedoInfiniteCanvas(diverged)).toBe(false);
});

test("undo and redo at the ends of the stack are no-ops, not errors", () => {
  const state = baseState();

  expect(canUndoInfiniteCanvas(state)).toBe(false);
  expect(undoInfiniteCanvasHistory(state)).toBe(state);
  expect(canRedoInfiniteCanvas(state)).toBe(false);
  expect(redoInfiniteCanvasHistory(state)).toBe(state);
});

test("undo clears the live interaction — it cannot survive the document it was editing", () => {
  const state = baseState();
  const edited = commitEdit(state, moveWindow(state, "a", 10));
  const mid = {
    ...edited,
    interaction: { kind: "move" as const },
  } as unknown as InfiniteCanvasState<Kind>;

  expect(undoInfiniteCanvasHistory(mid).interaction).toBeNull();
});

test("the stack is bounded, dropping the oldest entry rather than growing forever", () => {
  const overLimit = INFINITE_CANVAS_HISTORY_LIMIT + 25;
  const filled = Array.from({ length: overLimit }).reduce<InfiniteCanvasState<Kind>>(
    (state, _entry, index) => commitEdit(state, moveWindow(state, "a", index + 1)),
    baseState(),
  );

  expect(filled.history.past).toHaveLength(INFINITE_CANVAS_HISTORY_LIMIT);
});

test("the empty history assigns into a state of any window kind", () => {
  expect(EMPTY_INFINITE_CANVAS_HISTORY.past).toStrictEqual([]);
  expect(EMPTY_INFINITE_CANVAS_HISTORY.future).toStrictEqual([]);
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

  expect(state.selection.windowIds).toStrictEqual(["a"]);

  const fromSelection = captureInfiniteCanvasRecipe(state, { name: "sel", recipeId: "r1" });

  expect(fromSelection?.windows.map((window) => window.windowId)).toStrictEqual(["a"]);

  const requested = captureInfiniteCanvasRecipe(state, {
    name: "req",
    recipeId: "r2",
    windowIds: ["b", "c"],
  });

  expect(requested?.windows.map((window) => window.windowId)).toStrictEqual(["b", "c"]);

  const cleared = { ...state, selection: { ...state.selection, windowIds: [] } };
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

const editEveryDocumentField = (state: InfiniteCanvasState<Kind>): InfiniteCanvasState<Kind> => ({
  ...state,
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
      selection: { anchorWindowId: null, windowIds: [] },
      title: "Research",
      windowIds: ["a"],
    },
  ],
});

test("undo restores every field of the document, whatever they are", () => {
  const state = baseState();
  const before = getInfiniteCanvasDocument(state);
  const edited = commitEdit(state, editEveryDocumentField(state));

  const moved = Object.keys(before).filter(
    (field) =>
      getInfiniteCanvasDocument(edited)[field as keyof typeof before] !==
      before[field as keyof typeof before],
  );

  expect(moved.toSorted()).toEqual(["activeWorkspaceId", "groups", "windows", "workspaces"]);
  expect(getInfiniteCanvasDocument(undoInfiniteCanvasHistory(edited))).toEqual(before);
});
