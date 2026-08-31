import {
  createInfiniteCanvasState,
  createInfiniteCanvasWindow,
  serializeInfiniteCanvasState,
} from "@hyphened/infinite-canvas";
import { expect, test } from "vite-plus/test";

import type { WindowKind } from "./window-registry";

const windowsPathInStoredLayout = (windowCount: number): unknown => {
  const state = createInfiniteCanvasState<WindowKind>({
    camera: { center: { x: 0, y: 0 }, zoom: 1 },
    windows: Array.from({ length: windowCount }, (_unused, index) =>
      createInfiniteCanvasWindow<WindowKind>({
        id: `window-${String(index)}`,
        kind: "note",
        rect: { height: 240, width: 360, x: 0, y: 0 },
        title: `Note ${String(index)}`,
      }),
    ),
  });

  return (serializeInfiniteCanvasState(state) as unknown as { windows?: unknown }).windows;
};

test("the stored layout carries its windows at `windows`, which the removal summary counts", () => {
  expect(Array.isArray(windowsPathInStoredLayout(2))).toBe(true);
  expect(windowsPathInStoredLayout(2)).toHaveLength(2);
});

test("an empty canvas still carries the key", () => {
  expect(Array.isArray(windowsPathInStoredLayout(0))).toBe(true);
  expect(windowsPathInStoredLayout(0)).toHaveLength(0);
});
