import { expect, test } from "vite-plus/test";

import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import { isInfiniteCanvasWindowGrouped } from "./group-state";
import { reduceInfiniteCanvasState } from "./reducer";
import type { InfiniteCanvasState } from "./types";

/**
 * The lifecycle verbs detach a docked pane before acting. Maximize is the one that matters:
 * restoring does not re-attach, so a toggle is a one-way door for a pane.
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

/** "a" docked rightward, which pulls "b" into a shell with it. */
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

  return docked;
};

const maximize = (state: InfiniteCanvasState<Kind>) =>
  reduceInfiniteCanvasState(state, {
    command: { type: "activeWindow.toggleMaximized" },
    type: "command.execute",
  });

test("maximizing takes a docked pane out of its group", () => {
  expect(isInfiniteCanvasWindowGrouped(maximize(withShell()), "a")).toBe(false);
});

test("restoring does not put it back", () => {
  /*
   * The claim the description makes, and the reason it has to. `toggleMaximized` reads as
   * reversible; for a docked pane it is not, and nothing between the two presses re-attaches.
   */
  const restored = maximize(maximize(withShell()));

  expect(restored.windows.find((window) => window.id === "a")?.mode).not.toBe("maximized");
  expect(isInfiniteCanvasWindowGrouped(restored, "a")).toBe(false);
});

test("minimizing takes a docked pane out of its group too", () => {
  const minimized = reduceInfiniteCanvasState(withShell(), {
    command: { type: "activeWindow.minimize" },
    type: "command.execute",
  });

  expect(isInfiniteCanvasWindowGrouped(minimized, "a")).toBe(false);
});

test("pinning leaves a docked pane where it is", () => {
  /*
   * The sibling that does *not* detach — it routes straight to `toggleWindowPinned` with no group
   * call. Asserted because the other three do, which makes "the lifecycle verbs detach" the obvious
   * wrong generalisation to draw from this file.
   */
  const pinned = reduceInfiniteCanvasState(withShell(), {
    command: { type: "activeWindow.togglePinned" },
    type: "command.execute",
  });

  expect(pinned.windows.find((window) => window.id === "a")?.isPinned).toBe(true);
  expect(isInfiniteCanvasWindowGrouped(pinned, "a")).toBe(true);
});
