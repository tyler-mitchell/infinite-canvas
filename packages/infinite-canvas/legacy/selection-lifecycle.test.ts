import { expect, test } from "vite-plus/test";
import { createInfiniteCanvasStore } from "./store";

import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import { isInfiniteCanvasWindowGrouped } from "./group-state";
import { reduceInfiniteCanvasState } from "./operations";
import type { InfiniteCanvasState } from "./types";

type Kind = "note";

const pane = (id: string, x: number) =>
  createInfiniteCanvasWindow<Kind>({
    id,
    kind: "note",
    minSize: { height: 80, width: 120 },
    rect: { height: 200, width: 300, x, y: 0 },
    title: id,
  });

const withShell = (): InfiniteCanvasState<Kind> => {
  const base = {
    ...createInfiniteCanvasState<Kind>({ windows: [pane("a", 0), pane("b", 400), pane("c", 800)] }),
    viewport: { height: 800, width: 1200 },
  };
  const docked = reduceInfiniteCanvasState(
    { ...base, activeWindowId: "a" },
    { direction: "right", type: "window.dockDirection" },
  );

  expect(isInfiniteCanvasWindowGrouped(docked, "a")).toBe(true);

  return {
    ...docked,
    selection: {
      anchorTarget: { type: "window" as const, id: "a" },
      targets: [
        { type: "window" as const, id: "a" },
        { type: "window" as const, id: "b" },
        { type: "window" as const, id: "c" },
      ],
    },
  };
};

const minimizeSelection = (state: InfiniteCanvasState<Kind>) =>
  reduceInfiniteCanvasState(state, { type: "selection.minimize" });

test("minimizing a selection takes its docked panes out of their group", () => {
  const minimized = minimizeSelection(withShell());

  expect(isInfiniteCanvasWindowGrouped(minimized, "a")).toBe(false);
  expect(isInfiniteCanvasWindowGrouped(minimized, "b")).toBe(false);
});

test("every minimizable window in the selection ends up minimized", () => {
  const minimized = minimizeSelection(withShell());

  for (const id of ["a", "b", "c"]) {
    expect(minimized.windows.find((window) => window.id === id)?.mode).toBe("minimized");
  }
});

test("minimizing a whole selection is one undoable edit, not one per window", () => {
  const store = createInfiniteCanvasStore({ initialState: withShell() });
  store.dispatch({ type: "selection.minimize" });
  expect(store.history.undos$.peek()).toBe(1);
});

test("closing a whole selection is one undoable edit too", () => {
  const store = createInfiniteCanvasStore({ initialState: withShell() });
  store.dispatch({ type: "selection.close" });
  expect(store.getState().windows).toHaveLength(0);
  expect(store.history.undos$.peek()).toBe(1);
});
