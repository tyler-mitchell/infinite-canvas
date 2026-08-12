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

/**
 * C2's second tranche — history and recipes (P4), the other half of the surface that was
 * capability-complete and verification-empty.
 *
 * These were reading-audited on 2026-07-09 and found sound; that audit explicitly said it "does
 * not close C2 — it only narrows the range of what an eventual test might catch". This is that
 * test. Everything here is a pure function over state, so none of it needs a DOM.
 */

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

/** Commit an edit the way the reducer does: push the PREVIOUS document, then keep the new one. */
const commitEdit = (state: InfiniteCanvasState<Kind>, next: InfiniteCanvasState<Kind>) => ({
  ...next,
  history: pushInfiniteCanvasHistory(state.history, getInfiniteCanvasDocument(state)),
});

// ── The document is windows + groups, and nothing else ────────────────────────────────────

test("the document is what was arranged, not how it is being looked at", () => {
  // Windows, groups, and — since 2026-08-12 — workspaces. A workspace is part of the layout:
  // which windows belong to which named set is an edit, and switching between them writes the
  // outgoing set's camera and selection, which is why the exit criterion asks for it to be
  // one undo entry. Camera, viewport, interaction and snap preview stay out: panning is not
  // an edit and undo must never scroll the canvas out from under someone.
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
  // Panning is not an edit, and undo must never scroll the canvas out from under someone who
  // just wanted their window back.
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

// ── PERSIST-003 — a sequence of edits undoes and redoes transactionally ───────────────────

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
  // Keeping it would let a redo resurrect a document that never followed from what the user is
  // now looking at.
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
  // Typed at `never` so a readonly-array covariance makes it fit every `Kind`. A regression here
  // is a type error rather than a runtime one, so this asserts the shape it must keep.
  expect(EMPTY_INFINITE_CANVAS_HISTORY.past).toStrictEqual([]);
  expect(EMPTY_INFINITE_CANVAS_HISTORY.future).toStrictEqual([]);
});

// ── RECIPE — capture and apply ────────────────────────────────────────────────────────────

test("RECIPE: a captured arrangement is stored relative to its own origin", () => {
  const state = baseState();
  const recipe = captureInfiniteCanvasRecipe(state, {
    name: "row",
    recipeId: "r1",
    windowIds: ALL,
  });

  expect(recipe).not.toBeNull();
  // Windows sit at x 0/200/400 — the recipe normalizes to the arrangement's own top-left, so it
  // can be dropped anywhere in an unbounded world.
  expect(recipe?.windows.map((window) => window.rect.x)).toStrictEqual([0, 200, 400]);
  expect(recipe?.size.width).toBe(500);
});

test("RECIPE: applying at an origin translates rather than scales", () => {
  // A recipe that scaled would shrink windows below their own minSize — a constraint the rest
  // of the framework enforces. Sizes must come back identical.
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

  // 900 wide region, 500 wide arrangement → 200 of slack on each side.
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
  // Half a group is not a group — its tree would name a window the recipe never took.
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
  // This precedence is the real semantic, and it is the one an assertion written from the plan's
  // prose got wrong: `createInfiniteCanvasState` seeds the selection with the active window, so a
  // "fresh" canvas is never the everything case. Encoded here so the next reader does not have to
  // rediscover it.
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
