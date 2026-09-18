import { getSelectedWindowIds } from "./selection";
import { expect, test } from "vite-plus/test";

import { getInfiniteCanvasContextualEntries } from "./contextual-entries";
import { createInfiniteCanvasStore } from "./store";
import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import type { InfiniteCanvasHotkeyAction } from "./keyboard";
import type { InfiniteCanvasDispatch, InfiniteCanvasState } from "./types";

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
    dispatch: (action: unknown) => dispatched.push(action),
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
  dispatch: unknown = recorder().dispatch,
) =>
  getInfiniteCanvasContextualEntries(state, {
    commands: createInfiniteCanvasStore({ initialState: state }).getContextualCommands({
      includeDisabled: true,
    }),
    dispatch: dispatch as InfiniteCanvasDispatch<Kind>,
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
    isEnabled: (state) => getSelectedWindowIds(state.selection).length > 0,
  };
  const idle = entries({ ...canvas(), selection: { anchorTarget: null, targets: [] } }, [
    whenSelected,
  ]);
  const selected = entries(
    {
      ...canvas(),
      selection: {
        anchorTarget: { type: "window" as const, id: "a" },
        targets: [{ type: "window" as const, id: "a" }],
      },
    },
    [whenSelected],
  );

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
  const { dispatch, dispatched } = recorder();

  void entries(canvas(), [], dispatch)
    .find((entry) => entry.id === "view.fitAll")
    ?.run();

  expect(dispatched).toEqual([{ type: "view.fitAll" }]);
});

test("a consumer verb runs its own closure and never the reducer", () => {
  const { dispatch, dispatched } = recorder();
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
    dispatch,
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
  const { dispatch } = recorder();
  const entry = entries(canvas(), [], dispatch).find((candidate) => candidate.id === "view.fitAll");

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
