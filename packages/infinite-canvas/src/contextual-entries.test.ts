import { expect, test } from "vite-plus/test";

import {
  getInfiniteCanvasContextualEntries,
  runInfiniteCanvasContextualEntry,
} from "./contextual-entries";
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

const cutRelation = (): InfiniteCanvasHotkeyAction<Kind> => ({
  description: "Cut the selected connection.",
  hotkeys: ["Backspace"],
  id: "relation.cut",
  label: "Cut connection",
  run: () => undefined,
});

test("a consumer verb appears beside the canvas's own", () => {
  const entries = getInfiniteCanvasContextualEntries(canvas(), { actions: [cutRelation()] });
  const cut = entries.find((entry) => entry.id === "relation.cut");

  expect(cut?.source).toBe("consumer");
  expect(cut?.label).toBe("Cut connection");
  expect(entries.some((entry) => entry.source === "canvas")).toBe(true);
});

test("no actions is the list the framework already returned", () => {
  const merged = getInfiniteCanvasContextualEntries(canvas());

  expect(merged.every((entry) => entry.source === "canvas")).toBe(true);
  expect(merged.length).toBeGreaterThan(0);
});

test("a consumer verb is enabled by its own predicate, against live state", () => {
  const onlyWithSelection: InfiniteCanvasHotkeyAction<Kind> = {
    ...cutRelation(),
    isEnabled: (state) => state.selection.windowIds.length > 0,
  };
  const idle = getInfiniteCanvasContextualEntries(
    { ...canvas(), selection: { anchorWindowId: null, windowIds: [] } },
    { actions: [onlyWithSelection] },
  );
  const selected = getInfiniteCanvasContextualEntries(
    { ...canvas(), selection: { anchorWindowId: "a", windowIds: ["a"] } },
    { actions: [onlyWithSelection] },
  );

  expect(idle.find((entry) => entry.id === "relation.cut")?.enabled).toBe(false);
  expect(selected.find((entry) => entry.id === "relation.cut")?.enabled).toBe(true);
});

test("an absent predicate means always", () => {
  const entries = getInfiniteCanvasContextualEntries(canvas(), { actions: [cutRelation()] });

  expect(entries.find((entry) => entry.id === "relation.cut")?.enabled).toBe(true);
});

test("a consumer verb sharing an id replaces the canvas command rather than joining it", () => {
  const override: InfiniteCanvasHotkeyAction<Kind> = {
    ...cutRelation(),
    id: "view.fitAll",
    label: "Fit all, my way",
  };
  const entries = getInfiniteCanvasContextualEntries(canvas(), { actions: [override] });
  const matching = entries.filter((entry) => entry.id === "view.fitAll");

  expect(matching).toHaveLength(1);
  expect(matching[0]?.source).toBe("consumer");
  expect(matching[0]?.label).toBe("Fit all, my way");
});

test("every id is unique across both vocabularies", () => {
  const entries = getInfiniteCanvasContextualEntries(canvas(), {
    actions: [cutRelation(), { ...cutRelation(), id: "view.fitAll" }],
  });

  expect(new Set(entries.map((entry) => entry.id)).size).toBe(entries.length);
});

test("running a consumer entry calls its own run and never the reducer", () => {
  const ran: string[] = [];
  const dispatched: unknown[] = [];
  const actions = {
    executeCommand: (command: unknown) => dispatched.push(command),
  } as unknown as InfiniteCanvasCommands<Kind>;
  const state = canvas();
  const entries = getInfiniteCanvasContextualEntries(state, {
    actions: [{ ...cutRelation(), run: () => ran.push("cut") }],
  });
  const cut = entries.find((entry) => entry.id === "relation.cut");

  runInfiniteCanvasContextualEntry(cut!, { actions, state });

  expect(ran).toEqual(["cut"]);
  expect(dispatched).toHaveLength(0);
});

test("running a canvas entry dispatches its command", () => {
  const dispatched: unknown[] = [];
  const actions = {
    executeCommand: (command: unknown) => dispatched.push(command),
  } as unknown as InfiniteCanvasCommands<Kind>;
  const state = canvas();
  const fitAll = getInfiniteCanvasContextualEntries(state).find(
    (entry) => entry.id === "view.fitAll",
  );

  runInfiniteCanvasContextualEntry(fitAll!, { actions, state });

  expect(dispatched).toEqual([{ type: "view.fitAll" }]);
});
