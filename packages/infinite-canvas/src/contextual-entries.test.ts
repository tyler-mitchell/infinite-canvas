import { expect, test } from "vite-plus/test";

import { getInfiniteCanvasContextualEntries } from "./contextual-entries";
import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import type { InfiniteCanvasHotkeyAction } from "./keyboard";
import type { InfiniteCanvasCommands, InfiniteCanvasState } from "./types";

type Kind = "note";

const canvas = (): InfiniteCanvasState<Kind> => ({
  ...createInfiniteCanvasState<Kind>({
    windows: [
      createInfiniteCanvasWindow<Kind>({
        id: "a",
        kind: "note",
        rect: { height: 200, width: 300, x: 0, y: 0 },
        title: "a",
      }),
    ],
  }),
  viewport: { height: 800, width: 1200 },
});

/** Records what reached the reducer, so a consumer verb taking that path is visible. */
const recorder = () => {
  const dispatched: unknown[] = [];

  return {
    actions: { executeCommand: (command: unknown) => dispatched.push(command) },
    dispatched,
  };
};

const cutRelation = (): InfiniteCanvasHotkeyAction<Kind> => ({
  description: "Cut the selected connection.",
  hotkeys: ["Backspace"],
  id: "relation.cut",
  label: "Cut connection",
  run: () => undefined,
});

const entries = (
  state: InfiniteCanvasState<Kind>,
  hotkeyActions: readonly InfiniteCanvasHotkeyAction<Kind>[] = [],
  actions: unknown = recorder().actions,
) =>
  getInfiniteCanvasContextualEntries(state, {
    actions: actions as InfiniteCanvasCommands<Kind>,
    hotkeyActions,
  });

test("a consumer verb appears beside the canvas's own", () => {
  const merged = entries(canvas(), [cutRelation()]);
  const cut = merged.find((entry) => entry.id === "relation.cut");

  expect(cut?.label).toBe("Cut connection");
  expect(merged.some((entry) => entry.id === "view.fitAll")).toBe(true);
});

test("a consumer verb carries no framework group", () => {
  const merged = entries(canvas(), [cutRelation()]);

  expect(merged.find((entry) => entry.id === "relation.cut")?.group).toBeUndefined();
  expect(merged.find((entry) => entry.id === "view.fitAll")?.group).toBe("view");
});

test("a consumer verb is enabled by its own predicate, against live state", () => {
  const whenSelected: InfiniteCanvasHotkeyAction<Kind> = {
    ...cutRelation(),
    isEnabled: (state) => state.selection.windowIds.length > 0,
  };
  const idle = entries({ ...canvas(), selection: { anchorWindowId: null, windowIds: [] } }, [
    whenSelected,
  ]);
  const selected = entries({ ...canvas(), selection: { anchorWindowId: "a", windowIds: ["a"] } }, [
    whenSelected,
  ]);

  expect(idle.find((entry) => entry.id === "relation.cut")?.enabled).toBe(false);
  expect(selected.find((entry) => entry.id === "relation.cut")?.enabled).toBe(true);
});

test("an absent predicate means always", () => {
  expect(entries(canvas(), [cutRelation()]).find((e) => e.id === "relation.cut")?.enabled).toBe(
    true,
  );
});

test("a consumer verb sharing an id replaces the canvas command", () => {
  const override = { ...cutRelation(), id: "view.fitAll", label: "Fit all, my way" };
  const matching = entries(canvas(), [override]).filter((entry) => entry.id === "view.fitAll");

  expect(matching).toHaveLength(1);
  expect(matching[0]?.label).toBe("Fit all, my way");
});

test("every id is unique across both vocabularies", () => {
  const merged = entries(canvas(), [cutRelation(), { ...cutRelation(), id: "view.fitAll" }]);

  expect(new Set(merged.map((entry) => entry.id)).size).toBe(merged.length);
});

test("a canvas verb runs through the reducer", () => {
  const { actions, dispatched } = recorder();

  // `void` because a caller that does not report completion ignores the result, which is what a
  // keypress and a palette row do. The point of the union is that a caller which *does* can await.
  void entries(canvas(), [], actions)
    .find((entry) => entry.id === "view.fitAll")
    ?.run();

  expect(dispatched).toEqual([{ type: "view.fitAll" }]);
});

test("a consumer verb runs its own closure and never the reducer", () => {
  const { actions, dispatched } = recorder();
  const ran: string[] = [];

  // Braced rather than expression-bodied: `run` returns `Promise<void> | void` so a consumer verb
  // can say when its write landed, and a union — unlike bare `void` — does not absorb `push`'s
  // return. The cost of stating that in the type, paid here.
  void entries(
    canvas(),
    [
      {
        ...cutRelation(),
        run: () => {
          ran.push("cut");
        },
      },
    ],
    actions,
  )
    .find((entry) => entry.id === "relation.cut")
    ?.run();

  expect(ran).toEqual(["cut"]);
  expect(dispatched).toHaveLength(0);
});

/**
 * A consumer verb that writes can say when the write landed, and the entry carries that through.
 *
 * `run` returned `void`, so a verb doing asynchronous work had no way to report completion and a
 * surface answering "done" to something that cannot see the screen answered before it was true.
 * Polkadot's `connection.cut` is exactly that shape: it deletes a row and reloads.
 *
 * The framework itself never awaits this — a keypress does not care. What it must do is not throw
 * the promise away between the consumer and whoever reports.
 */
test("a consumer verb's promise reaches the caller rather than being dropped", async () => {
  const order: string[] = [];
  const entry = entries(canvas(), [
    {
      ...cutRelation(),
      /*
       * A timer, not `Promise.resolve()`. A dropped promise still leaves `await undefined` yielding
       * one microtask, and a consumer that only awaits microtasks finishes inside that slack — so
       * the first version of this test passed with the promise thrown away, proving nothing. Work
       * that cannot complete without a macrotask separates carrying it from dropping it.
       */
      run: async () => {
        await new Promise<void>((resolve) => {
          setTimeout(resolve, 0);
        });

        order.push("written");
      },
    },
  ]).find((candidate) => candidate.id === "relation.cut");

  await entry?.run();
  order.push("reported");

  // Reversed if the promise is dropped: "reported" lands first and the report is a lie.
  expect(order).toEqual(["written", "reported"]);
});

test("a canvas verb still finishes when it returns, with nothing to await", () => {
  /*
   * The reducer path is synchronous, so widening the type must not have made it thenable — a caller
   * awaiting every entry would otherwise be waiting on a microtask for nothing.
   *
   * Not asserted as `undefined`: this branch returns whatever `executeCommand` returns, which is
   * `void` in the real dispatcher and whatever a double happens to hand back here. What matters is
   * that nothing to wait on comes out of it.
   */
  const { actions } = recorder();
  const entry = entries(canvas(), [], actions).find((candidate) => candidate.id === "view.fitAll");

  expect(entry?.run()).not.toBeInstanceOf(Promise);
});

test("a consumer verb is handed the state it was resolved against", () => {
  const seen: (string | null)[] = [];
  const state = { ...canvas(), activeWindowId: "a" };

  void entries(state, [
    {
      ...cutRelation(),
      run: (given) => {
        seen.push(given.activeWindowId);
      },
    },
  ])
    .find((entry) => entry.id === "relation.cut")
    ?.run();

  expect(seen).toEqual(["a"]);
});
