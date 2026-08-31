import { expect, test } from "vite-plus/test";

import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import { isInfiniteCanvasWindowGrouped } from "./group-state";
import { reduceInfiniteCanvasState } from "./reducer";
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
  const pinned = reduceInfiniteCanvasState(withShell(), {
    command: { type: "activeWindow.togglePinned" },
    type: "command.execute",
  });

  expect(pinned.windows.find((window) => window.id === "a")?.isPinned).toBe(true);
  expect(isInfiniteCanvasWindowGrouped(pinned, "a")).toBe(true);
});
