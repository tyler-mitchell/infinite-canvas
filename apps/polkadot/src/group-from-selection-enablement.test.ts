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

/**
 * "Group selected" is offered only when the framework would actually take two windows.
 *
 * `createInfiniteCanvasGroup` drops members that are minimized or already inside another group —
 * dropped rather than stolen, since a window lives in at most one tree. Counting the raw selection
 * therefore offered this verb in cases where nothing would happen, or where a single survivor would
 * become a one-pane group nobody asked for.
 *
 * Both outcomes reported "done", and the camera flew to the bounds of the whole selection either
 * way. That is the specific failure these pin: not a wrong group, but a confident report over a
 * canvas that did not change.
 */

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

/**
 * "a" docked rightward, which pulls "b" into a shell with it; "c" stays floating.
 *
 * Through the pure executor rather than the reducer, which this package does not publish. The
 * difference is workspace reconciliation, and there are no workspaces here.
 */
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
  // The baseline. Without this the assertions below could all pass on a verb that is never offered.
  expect(isOffered(selecting(base(), ["a", "b"]))).toBe(true);
});

test("two windows already in the same group do not", () => {
  // Every named window is dropped, nothing survives, and the canvas comes back identical.
  expect(isOffered(selecting(withShell(), ["a", "b"]))).toBe(false);
});

test("one docked and one free window do not, because a group of one is not the gesture", () => {
  /*
   * The case a raw `length >= 2` check could not see, and the more misleading of the two: one
   * survivor is enough for the framework, so this did not quietly do nothing — it built a
   * single-pane group around "c" and flew the camera to bounds spanning "a" as well.
   */
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
