import { expect, test } from "vite-plus/test";

import { rememberUndoableAction, undoableAction$, undoLastAction } from "./undoable-action";

/**
 * Taking back the last thing done to the library, which the canvas's own undo cannot reach.
 *
 * `history.undo` covers windows, groups and the camera. Archiving writes to the database, outside
 * anything the framework's history knows about — measured on 2026-08-27, disconnecting two notes and
 * pressing undo answers "Undo is not available right now."
 *
 * Everything here is about the offer's lifetime rather than about archiving, because the action
 * carries its own inverse: what is worth pinning is when the offer stands, when it is withdrawn, and
 * that it cannot be taken twice.
 */

const track = () => {
  const calls: string[] = [];

  return {
    calls,
    remember: (name: string) => {
      rememberUndoableAction({
        describe: `Undo ${name}`,
        undo: async () => {
          calls.push(name);

          return Promise.resolve();
        },
      });
    },
  };
};

test("nothing is offered until something reversible happens", () => {
  undoableAction$.set(null);

  expect(undoableAction$.peek()).toBeNull();
});

test("the offer names the act, so it cannot be mistaken for the canvas's own undo", () => {
  // Two rows reading "Undo" would be two controls with one name. The palette renders `describe`
  // verbatim, which is why it is a sentence rather than a noun.
  const { remember } = track();

  remember("archiving “Quarterly notes”");

  expect(undoableAction$.peek()?.describe).toBe("Undo archiving “Quarterly notes”");
});

test("undoing runs the inverse the action carried", () => {
  const { calls, remember } = track();

  remember("archiving");

  return undoLastAction().then(() => {
    expect(calls).toStrictEqual(["archiving"]);
  });
});

test("the offer is withdrawn once taken, so it cannot be taken twice", async () => {
  /*
   * The double-press case, and the reason the clear happens before the reversal rather than after:
   * a slow database write would otherwise leave the row on screen long enough to press again, and
   * undoing an undo is not something this models.
   */
  const { calls, remember } = track();

  remember("archiving");
  await undoLastAction();

  expect(undoableAction$.peek()).toBeNull();

  await undoLastAction();

  expect(calls).toStrictEqual(["archiving"]);
});

test("a second press while the first is still writing does nothing", async () => {
  /*
   * The case the ordering exists for, and the one an awaited test cannot see.
   *
   * A first version of this suite asserted the withdrawal only after `undoLastAction` resolved, and
   * by then the clear has happened whichever side of the write it sits on — so moving the clear to
   * *after* the reversal left every test green. The race is real and needs the reversal held open:
   * a database write takes long enough for a second press, and undoing an undo is not modelled.
   */
  const calls: string[] = [];
  let release = () => undefined as void;
  const held = new Promise<void>((resolve) => {
    release = () => {
      resolve();
    };
  });

  rememberUndoableAction({
    describe: "Undo archiving",
    undo: async () => {
      calls.push("archiving");
      await held;
    },
  });

  const first = undoLastAction();

  // Still in flight — and already withdrawn, which is the whole claim.
  expect(undoableAction$.peek()).toBeNull();

  await undoLastAction();

  release();
  await first;

  expect(calls).toStrictEqual(["archiving"]);
});

test("a second reversible act replaces the first rather than stacking behind it", async () => {
  /*
   * One entry is the claim, not a shortcut. What this answers is "I just did that and did not mean
   * to", which is one step deep; a stack would raise how-deep and how-long questions with nothing
   * behind either answer. The older act stays reachable the way it always was — through the archive
   * list.
   */
  const { calls, remember } = track();

  remember("archiving one");
  remember("archiving two");

  expect(undoableAction$.peek()?.describe).toBe("Undo archiving two");

  await undoLastAction();

  expect(calls).toStrictEqual(["archiving two"]);
});
