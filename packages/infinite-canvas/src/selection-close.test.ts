import { expect, test } from "vite-plus/test";

import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import { reduceInfiniteCanvasState } from "./reducer";
import type { InfiniteCanvasState } from "./types";

/**
 * Closing a selection is one edit.
 *
 * The lifecycle verbs act on the active window because the actions beneath them take a single
 * id, which left "select five windows and close them" with no verb at all. The reason it is one
 * command rather than a loop at the call site is undo: every document change is a history
 * checkpoint, so five dispatches would be five entries and recovering from a mistaken close
 * would mean pressing undo five times.
 */

type Kind = "note";

const pane = (id: string, closable = true) =>
  createInfiniteCanvasWindow<Kind>({
    capabilities: closable ? undefined : { closable: false },
    id,
    kind: "note",
    rect: { height: 200, width: 300, x: 0, y: 0 },
    title: id,
  });

/** Four closable windows and one that refuses, all selected. */
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
  // A selection mixing a pinned-open console with four scratch windows closes the four, which
  // is what the user asked for. Refusing wholesale would make one unclosable window veto a verb
  // aimed at five.
  const closed = closeSelection(seed());

  expect(closed.windows).toHaveLength(1);
  expect(closed.windows[0]?.id).toBe("console");
});

test("closing four windows is a single undo entry", () => {
  // The whole reason this is one command. A loop over `window.close` at the call site would
  // leave four entries here, and this assertion is what would catch someone rewriting it that
  // way for readability.
  const before = seed();
  const closed = closeSelection(before);

  expect(closed.history.past).toHaveLength(before.history.past.length + 1);
});

test("undo brings all four back at once", () => {
  // The property the entry count is a proxy for.
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

  // Reference equality is the change test throughout this codebase: a command that cannot do
  // anything must not produce a new document, or it would land a history entry for a no-op.
  expect(closeSelection(state).windows).toBe(state.windows);
});
