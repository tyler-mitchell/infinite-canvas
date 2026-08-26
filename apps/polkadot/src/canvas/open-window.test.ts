import {
  createInfiniteCanvasState,
  createInfiniteCanvasWindow,
  type InfiniteCanvasCommand,
  type InfiniteCanvasCommands,
  type InfiniteCanvasWindow,
} from "@hyphened/infinite-canvas";
import { expect, test } from "vite-plus/test";

import { openContentWindow } from "./open-window";
import type { WindowKind } from "./window-registry";

/**
 * The first test in this app, and the reason it is this one.
 *
 * `apps/polkadot` had no test file at all and no `test` script, so `vp run -r test` skipped it
 * entirely — every test written for this project so far went into the framework, while the app
 * grew three content gateways, a store, a drop policy and a per-kind opener with nothing covering
 * any of it. That is the wrong way round for the half that changes fastest.
 *
 * `openContentWindow` is where to start because it holds a *rule* rather than a translation, and
 * the rule has more than one caller. The library rail always revealed an already-open note instead
 * of opening a second window, but it did that itself — so the rule lived in one caller, and the
 * moment collections started opening items, that surface did not have it. Two windows bound to one
 * record is not a feature this app offers; it is the state where editing in one and reading the
 * other looks like the save failed.
 */

type Recorder = Readonly<{
  actions: InfiniteCanvasCommands<WindowKind>;
  commands: InfiniteCanvasCommand[];
  opened: InfiniteCanvasWindow<WindowKind>[];
}>;

/**
 * Only the two verbs this function reaches for.
 *
 * A cast rather than a full stub of the command surface: `InfiniteCanvasCommands` is forty-odd
 * verbs and building all of them would test the stub. What is asserted below is which of the two
 * it called, which is exactly what the rule is about.
 */
const recorder = (): Recorder => {
  const commands: InfiniteCanvasCommand[] = [];
  const opened: InfiniteCanvasWindow<WindowKind>[] = [];

  return {
    actions: {
      executeCommand: (command: InfiniteCanvasCommand) => commands.push(command),
      openWindow: (window: InfiniteCanvasWindow<WindowKind>) => opened.push(window),
    } as unknown as InfiniteCanvasCommands<WindowKind>,
    commands,
    opened,
  };
};

const noteWindow = (input: Readonly<{ id: string; itemId: string; minimized?: boolean }>) =>
  createInfiniteCanvasWindow<WindowKind, { itemId: string }>({
    data: { itemId: input.itemId },
    id: input.id,
    kind: "note",
    mode: input.minimized === true ? "minimized" : "normal",
    rect: { height: 240, width: 360, x: 0, y: 0 },
    title: input.id,
  });

const canvasWith = (windows: readonly InfiniteCanvasWindow<WindowKind>[]) =>
  createInfiniteCanvasState<WindowKind>({
    viewport: { height: 800, width: 1200 },
    windows: [...windows],
  });

const SIZE = { height: 240, width: 360 };
const MIN_SIZE = { height: 200, width: 240 };

test("an item with no window on the canvas gets one", () => {
  const { actions, commands, opened } = recorder();

  openContentWindow({
    actions,
    data: { itemId: "content_item:fresh" },
    kind: "note",
    minSize: MIN_SIZE,
    size: SIZE,
    state: canvasWith([]),
    title: "Fresh",
  });

  expect(opened).toHaveLength(1);
  expect(opened[0]?.data).toEqual({ itemId: "content_item:fresh" });
  expect(commands).toEqual([]);
});

test("an item already on the canvas is revealed, not opened twice", () => {
  const { actions, commands, opened } = recorder();

  openContentWindow({
    actions,
    data: { itemId: "content_item:open" },
    kind: "note",
    minSize: MIN_SIZE,
    size: SIZE,
    state: canvasWith([noteWindow({ id: "existing", itemId: "content_item:open" })]),
    title: "Open",
  });

  expect(opened).toEqual([]);
  expect(commands).toEqual([{ type: "window.reveal", windowId: "existing" }]);
});

test("reveal rather than focus, because the window may be minimized or on another desktop", () => {
  /*
   * The distinction that makes this rule work at all. A bare focus on a minimized window leaves it
   * minimized, and on a window filed onto another desktop it aims at something the canvas is not
   * drawing — so clicking a collection row would appear to do nothing. `window.reveal` is the
   * framework's one verb that goes there, restores it, and focuses it.
   */
  const { actions, commands } = recorder();

  openContentWindow({
    actions,
    data: { itemId: "content_item:away" },
    kind: "note",
    minSize: MIN_SIZE,
    size: SIZE,
    state: canvasWith([noteWindow({ id: "away", itemId: "content_item:away", minimized: true })]),
    title: "Away",
  });

  expect(commands).toEqual([{ type: "window.reveal", windowId: "away" }]);
});

test("a caller that knows where the window goes keeps that rect exactly", () => {
  /*
   * The drop path depends on this, and it is the half of placement that must not change when the
   * other half does. Automatic placement is a policy that has already been rewritten once — a
   * cascade counted windows, its replacement looks for a vacancy — and both would move this rect,
   * one by an offset and one to the nearest free spot. Neither may: a drop landed under the
   * pointer on purpose, and the two windows below sit exactly where it is going.
   */
  const { actions, opened } = recorder();
  // Deliberately on top of both windows below, which is the case a vacancy search exists to move.
  const rect = { height: 120, width: 360, x: 0, y: 0 };

  openContentWindow({
    actions,
    data: { itemId: "content_item:dropped" },
    kind: "image",
    minSize: MIN_SIZE,
    rect,
    size: SIZE,
    state: canvasWith([
      noteWindow({ id: "a", itemId: "content_item:a" }),
      noteWindow({ id: "b", itemId: "content_item:b" }),
    ]),
    title: "Dropped",
  });

  expect(opened[0]?.rect).toEqual(rect);
});
