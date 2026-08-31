import { expect, test } from "vite-plus/test";

import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import { reduceInfiniteCanvasState } from "./reducer";
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
      anchorWindowId: "a",
      windowIds: ["a", "b", "c", "d", "console"],
    },
  };
};

const closeSelection = (state: InfiniteCanvasState<Kind>) =>
  reduceInfiniteCanvasState(state, {
    command: { type: "selection.close" },
    type: "command.execute",
  });

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
  const before = seed();
  const closed = closeSelection(before);

  expect(closed.history.past).toHaveLength(before.history.past.length + 1);
});

test("undo brings all four back at once", () => {
  const closed = closeSelection(seed());
  const undone = reduceInfiniteCanvasState(closed, {
    command: { type: "history.undo" },
    type: "command.execute",
  });

  expect(undone.windows.map((window) => window.id).sort()).toEqual(["a", "b", "c", "console", "d"]);
});

test("the selection is cleared, because what it named is gone", () => {
  const closed = closeSelection(seed());

  expect(closed.selection.windowIds).toEqual([]);
  expect(closed.selection.anchorWindowId).toBeNull();
});

test("a selection of only unclosable windows changes nothing", () => {
  const base = createInfiniteCanvasState<Kind>({ windows: [pane("console", false)] });
  const state: InfiniteCanvasState<Kind> = {
    ...base,
    selection: { anchorWindowId: "console", windowIds: ["console"] },
  };

  expect(closeSelection(state).windows).toBe(state.windows);
});
