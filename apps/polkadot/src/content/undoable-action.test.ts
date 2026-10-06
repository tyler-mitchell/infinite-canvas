import { observable, when } from "@legendapp/state";
import { afterEach, expect, test, vi } from "vite-plus/test";

import { rememberUndoableAction, undoableAction$, undoLastAction } from "./undoable-action";

afterEach(() => {
  undoableAction$.set(null);
  vi.restoreAllMocks();
});

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
  const released$ = observable(false);

  rememberUndoableAction({
    describe: "Undo archiving",
    undo: async () => {
      calls.push("archiving");
      await when(released$);
    },
  });

  const first = undoLastAction();

  expect(undoableAction$.peek()).toBeNull();

  await undoLastAction();

  released$.set(true);
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

test("a failed inverse remains available for an explicit retry", async () => {
  const error = new Error("Storage unavailable");
  const undo = vi.fn().mockRejectedValueOnce(error).mockResolvedValue(undefined);
  const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  rememberUndoableAction({ describe: "Undo archiving", undo });
  await expect(undoLastAction()).rejects.toBe(error);
  expect(undoableAction$.peek()).toEqual({ describe: "Undo archiving", undo });
  expect(warning).toHaveBeenCalledWith("Could not undo action", {
    description: "Undo archiving",
    error,
  });

  await undoLastAction();
  expect(undo).toHaveBeenCalledTimes(2);
  expect(undoableAction$.peek()).toBeNull();
});

test("a failed inverse preserves a newer pending action", async () => {
  const released$ = observable(false);
  const error = new Error("Restore failed");
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  rememberUndoableAction({
    describe: "Undo first action",
    undo: async () => {
      await when(released$);
      throw error;
    },
  });
  const pending = undoLastAction();
  const newer = { describe: "Undo second action", undo: vi.fn(async () => undefined) };
  rememberUndoableAction(newer);
  released$.set(true);
  await expect(pending).rejects.toBe(error);
  expect(undoableAction$.peek()).toEqual(newer);
  expect(newer.undo).not.toHaveBeenCalled();
});
