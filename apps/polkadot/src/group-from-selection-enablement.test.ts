import {
  createInfiniteCanvasState,
  createInfiniteCanvasWindow,
  executeInfiniteCanvasCommand,
  type InfiniteCanvasCommands,
  type InfiniteCanvasState,
} from "@hyphened/infinite-canvas";
import { expect, test } from "vite-plus/test";

import { getAppAction, isAppActionEnabled } from "./app-actions";
import type { WindowKind } from "./canvas/window-registry";

const context = (state: InfiniteCanvasState<WindowKind>) => ({
  actions: {} as InfiniteCanvasCommands<WindowKind>,
  canvasId: "canvas_document:canvas-1",
  canvasTitle: "Main canvas",
  goToCanvas: () => undefined,
  projectId: "project:project-1",
  refreshRoute: () => undefined,
  state,
});

const pane = (id: string, x: number) =>
  createInfiniteCanvasWindow<WindowKind>({
    id,
    kind: "note",
    rect: { height: 200, width: 300, x, y: 0 },
    title: id,
  });

const base = (): InfiniteCanvasState<WindowKind> => ({
  ...createInfiniteCanvasState<WindowKind>({
    windows: [pane("a", 0), pane("b", 400), pane("c", 800)],
  }),
  viewport: { height: 800, width: 1600 },
});

const withShell = (): InfiniteCanvasState<WindowKind> => {
  const docked = executeInfiniteCanvasCommand(
    { ...base(), activeWindowId: "a" },
    {
      direction: "right",
      type: "window.dockDirection",
    },
  );

  expect(docked.groups).toHaveLength(1);

  return docked;
};

const isOffered = (state: InfiniteCanvasState<WindowKind>) => {
  const action = getAppAction("group.createFromSelection");

  expect(action).toBeDefined();

  return action === undefined ? false : isAppActionEnabled(action, context(state));
};

const selecting = (state: InfiniteCanvasState<WindowKind>, windowIds: readonly string[]) => ({
  ...state,
  selection: { anchorWindowId: windowIds.at(-1) ?? null, windowIds },
});

test("two floating windows offer the verb", () => {
  expect(isOffered(selecting(base(), ["a", "b"]))).toBe(true);
});

test("two windows already in the same group do not", () => {
  expect(isOffered(selecting(withShell(), ["a", "b"]))).toBe(false);
});

test("one docked and one free window do not, because a group of one is not the gesture", () => {
  expect(isOffered(selecting(withShell(), ["a", "c"]))).toBe(false);
});

test("a selection is enough when two of its windows are free, whatever else is in it", () => {
  const state = withShell();
  const withFourth = {
    ...state,
    windows: [...state.windows, pane("d", 1200)],
  };

  expect(isOffered(selecting(withFourth, ["a", "c", "d"]))).toBe(true);
});
