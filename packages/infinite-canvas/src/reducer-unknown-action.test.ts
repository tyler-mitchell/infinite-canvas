import { afterEach, expect, test, vi } from "vite-plus/test";

import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import { reduceInfiniteCanvasState } from "./operations";
import type { InfiniteCanvasAction } from "./types";

const state = createInfiniteCanvasState<"note">({
  viewport: { height: 800, width: 1200 },
  windows: [
    createInfiniteCanvasWindow({
      id: "only",
      kind: "note",
      title: "Only",
      rect: { x: 0, y: 0, width: 300, height: 200 },
    }),
  ],
});

afterEach(() => vi.restoreAllMocks());

test.each([
  { type: "window.teleport" },
  { type: "nonsense" },
  { type: "view.zoomIn" },
  { type: "view.zoom", direction: "out" },
  { type: "constructor" },
  { type: "toString" },
  { type: "__proto__" },
  { type: "window.close", windowId: 13 },
])("rejected action $type preserves state and reports its type", (input) => {
  const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  expect(reduceInfiniteCanvasState(state, input as unknown as InfiniteCanvasAction<"note">)).toBe(
    state,
  );
  expect(warning).toHaveBeenCalledExactlyOnceWith("Canvas action rejected", { type: input.type });
});

test("known actions still execute", () => {
  const panned = reduceInfiniteCanvasState(state, { delta: { x: 40, y: 0 }, type: "camera.panBy" });
  expect(panned.camera.center).not.toEqual(state.camera.center);
  const minimized = {
    ...state,
    windows: state.windows.map((window) => ({ ...window, mode: "minimized" as const })),
  };
  const revealed = reduceInfiniteCanvasState(minimized, {
    type: "window.reveal",
    windowId: "only",
  });
  expect(revealed.windows[0]?.mode).toBe("normal");
  expect(revealed.activeWindowId).toBe("only");
});
