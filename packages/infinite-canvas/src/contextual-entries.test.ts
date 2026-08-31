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

  void entries(canvas(), [], actions)
    .find((entry) => entry.id === "view.fitAll")
    ?.run();

  expect(dispatched).toEqual([{ type: "view.fitAll" }]);
});

test("a consumer verb runs its own closure and never the reducer", () => {
  const { actions, dispatched } = recorder();
  const ran: string[] = [];

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

test("a consumer verb's promise reaches the caller rather than being dropped", async () => {
  const order: string[] = [];
  const entry = entries(canvas(), [
    {
      ...cutRelation(),
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

  expect(order).toEqual(["written", "reported"]);
});

test("a canvas verb still finishes when it returns, with nothing to await", () => {
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
