import { expect, test } from "vite-plus/test";

import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import { isInfiniteCanvasWindowGrouped } from "./group-state";
import { getCanvasLayout } from "./layout";
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

  return docked;
};

const maximize = (state: InfiniteCanvasState<Kind>) =>
  reduceInfiniteCanvasState(state, { type: "activeWindow.toggleMaximized" });

test("maximizing takes a docked pane out of its group", () => {
  expect(isInfiniteCanvasWindowGrouped(maximize(withShell()), "a")).toBe(false);
});

test("restoring does not put it back", () => {
  const restored = maximize(maximize(withShell()));

  expect(restored.windows.find((window) => window.id === "a")?.mode).not.toBe("maximized");
  expect(isInfiniteCanvasWindowGrouped(restored, "a")).toBe(false);
});

test("minimizing a grouped window releases it at its displayed bounds", () => {
  const state = withShell();
  const displayedRect = getCanvasLayout(state).windowRects.get("a");
  const minimized = reduceInfiniteCanvasState(state, { type: "window.minimize", windowId: "a" });

  expect(displayedRect).toBeDefined();
  expect(minimized.windows.find((window) => window.id === "a")?.rect).toEqual(displayedRect);
  expect(isInfiniteCanvasWindowGrouped(minimized, "a")).toBe(false);
});

test("maximizing a grouped window keeps its displayed bounds for restore", () => {
  const state = withShell();
  const displayedRect = getCanvasLayout(state).windowRects.get("a");
  const maximized = reduceInfiniteCanvasState(state, { type: "window.maximize", windowId: "a" });
  const restored = reduceInfiniteCanvasState(maximized, { type: "window.restore", windowId: "a" });

  expect(displayedRect).toBeDefined();
  expect(maximized.windows.find((window) => window.id === "a")?.restoreRect).toEqual(displayedRect);
  expect(restored.windows.find((window) => window.id === "a")?.rect).toEqual(displayedRect);
  expect(isInfiniteCanvasWindowGrouped(restored, "a")).toBe(false);
});

test("maximizing a minimized window preserves its original restore bounds", () => {
  const state = withShell();
  const rect = getCanvasLayout(state).windowRects.get("a");
  const maximized = reduceInfiniteCanvasState(state, { type: "window.maximize", windowId: "a" });
  const minimized = reduceInfiniteCanvasState(maximized, {
    type: "window.minimize",
    windowId: "a",
  });
  const maximizedAgain = reduceInfiniteCanvasState(minimized, {
    type: "window.maximize",
    windowId: "a",
  });
  const restored = reduceInfiniteCanvasState(maximizedAgain, {
    type: "window.restore",
    windowId: "a",
  });

  expect(rect).toBeDefined();
  expect(restored.windows.find((window) => window.id === "a")?.rect).toEqual(rect);
  expect(isInfiniteCanvasWindowGrouped(restored, "a")).toBe(false);
});

test("minimizing takes a docked pane out of its group too", () => {
  const minimized = reduceInfiniteCanvasState(withShell(), { type: "activeWindow.minimize" });

  expect(isInfiniteCanvasWindowGrouped(minimized, "a")).toBe(false);
});

test("pinning leaves a docked pane where it is", () => {
  const pinned = reduceInfiniteCanvasState(withShell(), { type: "activeWindow.togglePinned" });

  expect(pinned.windows.find((window) => window.id === "a")?.isPinned).toBe(true);
  expect(isInfiniteCanvasWindowGrouped(pinned, "a")).toBe(true);
});
