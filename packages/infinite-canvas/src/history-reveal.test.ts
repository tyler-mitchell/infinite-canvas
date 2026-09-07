import { expect, test } from "vite-plus/test";

import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import {
  getInfiniteCanvasDocument,
  pushInfiniteCanvasHistory,
  redoInfiniteCanvasHistory,
  undoInfiniteCanvasHistory,
} from "./history";
import type { InfiniteCanvasRect, InfiniteCanvasState } from "./types";

const canvas = (rect: InfiniteCanvasRect): InfiniteCanvasState<"note"> =>
  createInfiniteCanvasState<"note">({
    camera: { center: { x: 0, y: 0 }, zoom: 1 },
    viewport: { height: 800, width: 1200 },
    windows: [
      createInfiniteCanvasWindow<"note", undefined>({
        data: undefined,
        id: "a",
        kind: "note",
        rect,
        title: "a",
      }),
    ],
  });

/**
 * The state after moving the window, with the previous document on the undo stack.
 *
 * Built from the history primitives rather than a command, because the point under test is what
 * undo does with two documents, not which command produced them.
 */
const afterMove = (from: InfiniteCanvasRect, to: InfiniteCanvasRect) => {
  const before = canvas(from);
  const moved = canvas(to);

  return {
    ...moved,
    history: pushInfiniteCanvasHistory(moved.history, getInfiniteCanvasDocument(before)),
  } satisfies InfiniteCanvasState<"note">;
};

const NEAR = { height: 200, width: 300, x: 0, y: 0 };

test("undoing a change that is off screen brings the camera to it", () => {
  /*
   * The failure this closes: the reverted change can be anywhere, so a person presses undo, sees
   * nothing move, and presses undo again. Two edits then disappear with no feedback.
   */
  const moved = afterMove(NEAR, { height: 200, width: 300, x: 9000, y: 9000 });
  const undone = undoInfiniteCanvasHistory(moved);

  expect(undone.camera).not.toStrictEqual(moved.camera);
});

test("undoing a change already in view leaves the camera alone", () => {
  /*
   * The guard, and it matters as much as the move. An unnecessary jump is more disruptive than no
   * jump: undoing a typo in front of you must not re-frame the canvas.
   */
  const nudged = afterMove(NEAR, { height: 200, width: 300, x: 40, y: 0 });
  const undone = undoInfiniteCanvasHistory(nudged);

  expect(undone.camera).toStrictEqual(nudged.camera);
});

test("redo reveals its change the same way", () => {
  /*
   * The camera is pushed away between the two, because undo has already framed this region and
   * redo covers the same one. Asserting that redo moves the camera from where undo left it tests
   * nothing: not moving is the correct answer there, and the first version of this test failed for
   * that reason rather than because redo was broken.
   */
  const moved = afterMove(NEAR, { height: 200, width: 300, x: 9000, y: 9000 });
  const undone = undoInfiniteCanvasHistory(moved);
  const elsewhere = { ...undone, camera: { center: { x: -50_000, y: -50_000 }, zoom: 1 } };
  const redone = redoInfiniteCanvasHistory(elsewhere);

  expect(redone.camera).not.toStrictEqual(elsewhere.camera);
});

test("the revealed region is reported whether or not the camera moved", () => {
  /*
   * A change already on screen still needs marking. The camera staying put is the right answer to
   * "where", and it is not an answer to "what just happened".
   */
  const nudged = afterMove(NEAR, { height: 200, width: 300, x: 40, y: 0 });
  const undone = undoInfiniteCanvasHistory(nudged);

  expect(undone.camera).toStrictEqual(nudged.camera);
  expect(undone.revealedChange?.rect).toStrictEqual({ height: 200, width: 340, x: 0, y: 0 });
});

test("a second reveal of the same region still counts as a new one", () => {
  /*
   * Undoing twice in the same place produces the same rectangle. A marker keyed on geometry would
   * not restart, so the second undo would look like nothing happened — the exact failure this
   * feature exists to remove. The token is what makes the two distinguishable.
   */
  const move = () => afterMove(NEAR, { height: 200, width: 300, x: 40, y: 0 });
  const once = undoInfiniteCanvasHistory(move());
  // A fresh identical edit, carrying the earlier token forward as a real session would.
  const twice = undoInfiniteCanvasHistory({
    ...move(),
    revealedChange: once.revealedChange,
  });

  expect(twice.revealedChange?.rect).toStrictEqual(once.revealedChange?.rect);
  expect(twice.revealedChange?.token).toBeGreaterThan(once.revealedChange?.token ?? 0);
});

test("an empty history changes nothing at all, camera included", () => {
  const state = canvas(NEAR);

  expect(undoInfiniteCanvasHistory(state).camera).toStrictEqual(state.camera);
  expect(redoInfiniteCanvasHistory(state).camera).toStrictEqual(state.camera);
});
