import { expect, test } from "vite-plus/test";

import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import { isInfiniteCanvasWindowGrouped } from "./group-state";
import { reduceInfiniteCanvasState } from "./reducer";
import type { InfiniteCanvasState } from "./types";

/**
 * The two claims `selection.close` and `selection.minimize` make, and the one they left out.
 *
 * Both say "as a single undoable edit", which is checkable and true: each is one `command.execute`,
 * and the reducer checkpoints once per action however many windows the reduce walks.
 *
 * What `selection.minimize` did not say is that it detaches each window from its group on the way,
 * the same as `activeWindow.minimize`. Over a selection it is the sharper version of that: select a
 * whole group, minimize, and the shell is emptied rather than collapsed. Its description says so
 * now, and this is the assertion behind the sentence.
 */

type Kind = "note";

const pane = (id: string, x: number) =>
  createInfiniteCanvasWindow<Kind>({
    id,
    kind: "note",
    minSize: { height: 80, width: 120 },
    rect: { height: 200, width: 300, x, y: 0 },
    title: id,
  });

/** "a" docked rightward into a shell with "b"; "c" floats. All three selected. */
const withShell = (): InfiniteCanvasState<Kind> => {
  const base = {
    ...createInfiniteCanvasState<Kind>({ windows: [pane("a", 0), pane("b", 400), pane("c", 800)] }),
    viewport: { height: 800, width: 1200 },
  };
  const docked = reduceInfiniteCanvasState(
    { ...base, activeWindowId: "a" },
    { command: { direction: "right", type: "window.dockDirection" }, type: "command.execute" },
  );

  expect(isInfiniteCanvasWindowGrouped(docked, "a")).toBe(true);

  return {
    ...docked,
    selection: { anchorWindowId: "a", windowIds: ["a", "b", "c"] },
  };
};

const minimizeSelection = (state: InfiniteCanvasState<Kind>) =>
  reduceInfiniteCanvasState(state, {
    command: { type: "selection.minimize" },
    type: "command.execute",
  });

test("minimizing a selection takes its docked panes out of their group", () => {
  const minimized = minimizeSelection(withShell());

  expect(isInfiniteCanvasWindowGrouped(minimized, "a")).toBe(false);
  expect(isInfiniteCanvasWindowGrouped(minimized, "b")).toBe(false);
});

test("every minimizable window in the selection ends up minimized", () => {
  // The premise, so the detach assertions above are about a verb that ran.
  const minimized = minimizeSelection(withShell());

  for (const id of ["a", "b", "c"]) {
    expect(minimized.windows.find((window) => window.id === id)?.mode).toBe("minimized");
  }
});

test("minimizing a whole selection is one undoable edit, not one per window", () => {
  /*
   * The claim both descriptions make. Three windows collapse and the stack grows by one, so undoing
   * puts all three back in a single press rather than leaving the user pressing until they guess
   * how many there were.
   */
  const before = withShell();
  const after = minimizeSelection(before);

  expect(after.history.past).toHaveLength(before.history.past.length + 1);
});

test("closing a whole selection is one undoable edit too", () => {
  const before = withShell();
  const after = reduceInfiniteCanvasState(before, {
    command: { type: "selection.close" },
    type: "command.execute",
  });

  expect(after.windows).toHaveLength(0);
  expect(after.history.past).toHaveLength(before.history.past.length + 1);
});
