import {
  createInfiniteCanvasState,
  createInfiniteCanvasWindow,
  serializeInfiniteCanvasState,
} from "@hyphened/infinite-canvas";
import { expect, test } from "vite-plus/test";

import type { WindowKind } from "./window-registry";

/**
 * The one place the database reads inside the layout, pinned from this side.
 *
 * `canvas_document.layout` is the framework's serialized state and the database stores it whole —
 * except in `fn::canvas_removal_summary`, which does `array::len($source.layout.windows)` so the
 * removal dialog can say how many windows a delete would take. That is a SurQL string reaching into
 * a shape the framework owns, and nothing else in either package connects the two.
 *
 * The failure it guards is quiet and lands somewhere expensive: rename `windows` upstream and
 * `array::len` over a missing path answers 0, so a confirmation for a destructive, non-reversible
 * act would report that nothing is lost. No error, no failing typecheck — SurQL is a string.
 *
 * So this asserts the path the SurQL walks, from the serializer the app actually stores. It is not a
 * test of the framework; it is this app stating what it depends on, in the package that breaks.
 */

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

  // An object, not a JSON string — `createCanvas` takes `layout: object` and the driver stores it.
  return (serializeInfiniteCanvasState(state) as unknown as { windows?: unknown }).windows;
};

test("the stored layout carries its windows at `windows`, which the removal summary counts", () => {
  expect(Array.isArray(windowsPathInStoredLayout(2))).toBe(true);
  expect(windowsPathInStoredLayout(2)).toHaveLength(2);
});

/** An empty canvas must count 0 rather than be absent, or `array::len` answers NONE instead of 0. */
test("an empty canvas still carries the key", () => {
  expect(Array.isArray(windowsPathInStoredLayout(0))).toBe(true);
  expect(windowsPathInStoredLayout(0)).toHaveLength(0);
});
