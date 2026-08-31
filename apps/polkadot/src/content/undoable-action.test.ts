import { expect, test } from "vite-plus/test";

import { rememberUndoableAction, undoableAction$, undoLastAction } from "./undoable-action";

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
  const { calls, remember } = track();

  remember("archiving");
  await undoLastAction();

  expect(undoableAction$.peek()).toBeNull();

  await undoLastAction();

  expect(calls).toStrictEqual(["archiving"]);
});

test("a second press while the first is still writing does nothing", async () => {
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

  expect(undoableAction$.peek()).toBeNull();

  await undoLastAction();

  release();
  await first;

  expect(calls).toStrictEqual(["archiving"]);
});

test("a second reversible act replaces the first rather than stacking behind it", async () => {
  const { calls, remember } = track();

  remember("archiving one");
  remember("archiving two");

  expect(undoableAction$.peek()?.describe).toBe("Undo archiving two");

  await undoLastAction();

  expect(calls).toStrictEqual(["archiving two"]);
});
