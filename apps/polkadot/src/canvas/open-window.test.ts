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

type Recorder = Readonly<{
  actions: InfiniteCanvasCommands<WindowKind>;
  commands: InfiniteCanvasCommand[];
  navigations: unknown[];
  opened: InfiniteCanvasWindow<WindowKind>[];
}>;

const recorder = (): Recorder => {
  const commands: InfiniteCanvasCommand[] = [];
  const navigations: unknown[] = [];
  const opened: InfiniteCanvasWindow<WindowKind>[] = [];

  return {
    actions: {
      executeCommand: (command: InfiniteCanvasCommand) => commands.push(command),
      navigateToRect: (request: unknown) => navigations.push(request),
      openWindow: (window: InfiniteCanvasWindow<WindowKind>) => opened.push(window),
    } as unknown as InfiniteCanvasCommands<WindowKind>,
    commands,
    navigations,
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
  const { actions, opened } = recorder();
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

test("a window that would open too small to use brings the camera with it", () => {
  const { actions, navigations } = recorder();
  const zoomedOut = { ...canvasWith([]), camera: { center: { x: 0, y: 0 }, zoom: 0.36 } };

  openContentWindow({
    actions,
    data: { itemId: "content_item:tiny" },
    kind: "note",
    minSize: MIN_SIZE,
    size: SIZE,
    state: zoomedOut,
    title: "Tiny",
  });

  expect(navigations).toHaveLength(1);
});

test("a window that opens readable is left where the camera already was", () => {
  const { actions, navigations } = recorder();

  openContentWindow({
    actions,
    data: { itemId: "content_item:readable" },
    kind: "note",
    minSize: MIN_SIZE,
    size: SIZE,
    state: canvasWith([]),
    title: "Readable",
  });

  expect(navigations).toEqual([]);
});
