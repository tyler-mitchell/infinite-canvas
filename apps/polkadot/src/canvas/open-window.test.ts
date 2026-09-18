import {
  createInfiniteCanvasState,
  createInfiniteCanvasWindow,
  type InfiniteCanvasAction,
  type InfiniteCanvasCommand,
  type InfiniteCanvasDispatch,
  type InfiniteCanvasWindow,
  type InfiniteCanvasWindowPlacement,
} from "@hyphened/infinite-canvas";
import { expect, test } from "vite-plus/test";

import { openContentWindow } from "./open-window";
import type { WindowKind } from "./window-registry";

type Opened = Readonly<{
  placement: InfiniteCanvasWindowPlacement | undefined;
  window: InfiniteCanvasWindow<WindowKind>;
}>;

type Recorder = Readonly<{
  commands: InfiniteCanvasCommand[];
  dispatch: InfiniteCanvasDispatch<WindowKind>;
  opened: Opened[];
}>;

const recorder = (): Recorder => {
  const commands: InfiniteCanvasCommand[] = [];
  const opened: Opened[] = [];

  return {
    commands,
    dispatch: (action: InfiniteCanvasAction<WindowKind>) => {
      if (action.type === "window.reveal") {
        commands.push(action);
      }

      if (action.type === "window.open") {
        opened.push({ placement: action.placement, window: action.window });
      }
    },
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
  const { commands, dispatch, opened } = recorder();

  openContentWindow({
    dispatch,
    data: { itemId: "content_item:fresh" },
    kind: "note",
    minSize: MIN_SIZE,
    size: SIZE,
    state: canvasWith([]),
    title: "Fresh",
  });

  expect(opened).toHaveLength(1);
  expect(opened[0]?.window.data).toEqual({ itemId: "content_item:fresh" });
  // The reveal names the new window, so nothing else on the canvas was revealed instead.
  expect(commands).toEqual([{ type: "window.reveal", windowId: opened[0]?.window.id }]);
});

test("a window with no rect of its own asks the canvas to place it", () => {
  const { dispatch, opened } = recorder();

  openContentWindow({
    dispatch,
    data: { itemId: "content_item:placed" },
    kind: "note",
    minSize: MIN_SIZE,
    size: SIZE,
    state: canvasWith([]),
    title: "Placed",
  });

  // The rect the caller supplies carries the size only. The canvas decides the position.
  expect(opened[0]?.placement).toEqual({ gapPx: 24, region: "center" });
  expect(opened[0]?.window.rect).toEqual({ ...SIZE, x: 0, y: 0 });
});

test("an item already on the canvas is revealed, not opened twice", () => {
  const { commands, dispatch, opened } = recorder();

  openContentWindow({
    dispatch,
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
  const { commands, dispatch } = recorder();

  openContentWindow({
    dispatch,
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
  const { dispatch, opened } = recorder();
  const rect = { height: 120, width: 360, x: 0, y: 0 };

  openContentWindow({
    dispatch,
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

  expect(opened[0]?.window.rect).toEqual(rect);
  // A caller-supplied rect is exact, so the canvas is not asked to place it.
  expect(opened[0]?.placement).toBeUndefined();
});

test("a window the canvas placed is revealed, because it can land off screen", () => {
  const { commands, dispatch, opened } = recorder();

  openContentWindow({
    dispatch,
    data: { itemId: "content_item:placed" },
    kind: "note",
    minSize: MIN_SIZE,
    size: SIZE,
    state: canvasWith([]),
    title: "Placed",
  });

  expect(commands).toEqual([{ type: "window.reveal", windowId: opened[0]?.window.id }]);
});

test("a window the caller placed is left alone, because the caller chose where to look", () => {
  const { commands, dispatch } = recorder();

  openContentWindow({
    dispatch,
    data: { itemId: "content_item:dropped" },
    kind: "image",
    minSize: MIN_SIZE,
    rect: { height: 240, width: 360, x: 90, y: 90 },
    size: SIZE,
    state: canvasWith([]),
    title: "Dropped",
  });

  expect(commands).toEqual([]);
});
