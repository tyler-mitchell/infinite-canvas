import { getSelectedWindowIds } from "./selection";
import { expect, test } from "vite-plus/test";
import { createInfiniteCanvasStore } from "./store";

import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import { reduceInfiniteCanvasState } from "./operations";
import type { InfiniteCanvasState } from "./types";

type Kind = "note";

const pane = (id: string, closable = true) =>
  createInfiniteCanvasWindow<Kind>({
    capabilities: closable ? undefined : { closable: false },
    id,
    kind: "note",
    rect: { height: 200, width: 300, x: 0, y: 0 },
    title: id,
  });

const seed = (): InfiniteCanvasState<Kind> => {
  const base = createInfiniteCanvasState<Kind>({
    windows: [pane("a"), pane("b"), pane("c"), pane("d"), pane("console", false)],
  });

  return {
    ...base,
    selection: {
      anchorTarget: { type: "window" as const, id: "a" },
      targets: [
        { type: "window" as const, id: "a" },
        { type: "window" as const, id: "b" },
        { type: "window" as const, id: "c" },
        { type: "window" as const, id: "d" },
        { type: "window" as const, id: "console" },
      ],
    },
  };
};

const closeSelection = (state: InfiniteCanvasState<Kind>) =>
  reduceInfiniteCanvasState(state, { type: "selection.close" });

test("every closable window in the selection is closed", () => {
  const closed = closeSelection(seed());

  expect(closed.windows.map((window) => window.id)).toEqual(["console"]);
});

test("a window that refuses to close survives, rather than the whole verb refusing", () => {
  const closed = closeSelection(seed());

  expect(closed.windows).toHaveLength(1);
  expect(closed.windows[0]?.id).toBe("console");
});

test("closing four windows is a single undo entry", () => {
  const store = createInfiniteCanvasStore({ initialState: seed() });
  store.dispatch({ type: "selection.close" });
  expect(store.history.undos$.peek()).toBe(1);
});

test("undo brings all four back at once", () => {
  const store = createInfiniteCanvasStore({ initialState: seed() });
  store.dispatch({ type: "selection.close" });
  expect(store.getState().windows.map((window) => window.id)).toEqual(["console"]);
  store.dispatch({ type: "history.undo" });
  const undone = store.getState();
  expect(undone.windows.map((window) => window.id).sort()).toEqual(["a", "b", "c", "console", "d"]);
});

test("bulk close retains the surviving selection", () => {
  const closed = closeSelection(seed());

  expect(getSelectedWindowIds(closed.selection)).toEqual(["console"]);
  expect(
    closed.selection.anchorTarget?.type === "window" ? closed.selection.anchorTarget.id : null,
  ).toBe("console");
});

test("a selection of only unclosable windows changes nothing", () => {
  const base = createInfiniteCanvasState<Kind>({ windows: [pane("console", false)] });
  const state: InfiniteCanvasState<Kind> = {
    ...base,
    selection: {
      anchorTarget: { type: "window" as const, id: "console" },
      targets: [{ type: "window" as const, id: "console" }],
    },
  };

  expect(closeSelection(state).windows).toBe(state.windows);
});

test("bulk close preserves protected windows and non-window selection", () => {
  const target = { id: "relation-1", kind: "relation", type: "edge" } as const;
  const state: InfiniteCanvasState<Kind> = {
    ...seed(),
    selection: {
      anchorTarget: target,
      targets: [
        { type: "window" as const, id: "a" },
        { type: "window" as const, id: "b" },
        { type: "window" as const, id: "c" },
        { type: "window" as const, id: "d" },
        { type: "window" as const, id: "console" },
        target,
      ],
    },
  };
  const closed = reduceInfiniteCanvasState(state, { type: "selection.close" });

  expect(closed.windows.map((window) => window.id)).toEqual(["console"]);
  expect(getSelectedWindowIds(closed.selection)).toEqual(["console"]);
  expect(closed.selection.anchorTarget).toEqual(target);
  expect(closed.selection.targets).toEqual([{ type: "window", id: "console" }, target]);
});
