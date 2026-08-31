import { expect, test } from "vite-plus/test";

import { executeInfiniteCanvasCommand } from "./commands";
import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import { getVisibleWindowBounds } from "./selection";
import type { InfiniteCanvasState } from "./types";

type Kind = "note";

const pane = (id: string, x: number) =>
  createInfiniteCanvasWindow<Kind>({
    id,
    kind: "note",
    rect: { height: 200, width: 300, x, y: 0 },
    title: id,
  });

const canvas = (): InfiniteCanvasState<Kind> => ({
  ...createInfiniteCanvasState<Kind>({ windows: [pane("a", 0), pane("b", 4000)] }),
  activeWindowId: "a",
  viewport: { height: 800, width: 1200 },
});

const pin = (state: InfiniteCanvasState<Kind>) =>
  executeInfiniteCanvasCommand(state, { type: "activeWindow.togglePinned" });

const windowById = (state: InfiniteCanvasState<Kind>, id: string) =>
  state.windows.find((window) => window.id === id);

test("pinning raises the window above every unpinned one", () => {
  const pinned = pin(canvas());

  expect(windowById(pinned, "a")?.isPinned).toBe(true);
  expect(windowById(pinned, "b")?.isPinned).toBe(false);
});

test("pinning does not move the window", () => {
  const before = canvas();
  const after = pin(before);

  expect(windowById(after, "a")?.rect).toStrictEqual(windowById(before, "a")?.rect);
});

test("panning leaves a pinned window exactly where it was", () => {
  const pinned = pin(canvas());
  const panned = executeInfiniteCanvasCommand(pinned, {
    amountPx: 200,
    direction: "right",
    type: "view.pan",
  });

  expect(windowById(panned, "a")?.rect).toStrictEqual(windowById(pinned, "a")?.rect);
  expect(panned.camera.center.x).not.toBe(pinned.camera.center.x);
});

test("fit-all measures a pinned window like any other", () => {
  const plain = canvas();
  const pinned = pin({ ...plain, activeWindowId: "b" });

  expect(getVisibleWindowBounds(pinned)).toStrictEqual(getVisibleWindowBounds(plain));
});
