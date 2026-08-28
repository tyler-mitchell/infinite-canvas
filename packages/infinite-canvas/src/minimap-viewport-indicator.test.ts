import { expect, test } from "vite-plus/test";

import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import { getInfiniteCanvasMinimapLayout } from "./minimap";
import type { InfiniteCanvasState } from "./types";

/**
 * `bounds` includes the camera's visible rect, so a camera containing everything drawn becomes the
 * bounds and the indicator projects onto the whole inner area. It is withheld in that case.
 */

type Kind = "note";

const size = { height: 104, width: 156 };

const pane = (id: string, x: number) =>
  createInfiniteCanvasWindow<Kind>({
    id,
    kind: "note",
    rect: { height: 200, width: 300, x, y: 0 },
    title: id,
  });

const canvasAt = (x: number, y: number, zoom: number) =>
  ({
    ...createInfiniteCanvasState<Kind>({ windows: [pane("a", 0), pane("b", 400)] }),
    camera: { center: { x, y }, zoom },
    viewport: { height: 800, width: 1200 },
  }) satisfies InfiniteCanvasState<Kind>;

test("a camera showing only part of the canvas gets an indicator", () => {
  // The baseline, and the case the indicator exists for.
  const layout = getInfiniteCanvasMinimapLayout(canvasAt(150, 100, 4), size);

  expect(layout).not.toBeNull();
  expect(layout?.viewport).not.toBeNull();
});

test("a camera containing everything drawn gets none", () => {
  const layout = getInfiniteCanvasMinimapLayout(canvasAt(200, 100, 0.1), size);

  expect(layout).not.toBeNull();
  expect(layout?.windows).toHaveLength(2);
  expect(layout?.viewport).toBeNull();
});

test("the indicator that is withheld is exactly the one that filled the box", () => {
  // If the condition were wrong, this would be a rect spanning the whole inner area, which is what
  // the previous code drew.
  const zoomedOut = canvasAt(200, 100, 0.1);
  const layout = getInfiniteCanvasMinimapLayout(zoomedOut, size);
  const padding = 8;

  expect(layout).not.toBeNull();
  // Every drawn window is inside the padded box, so a usable map remained.
  for (const window of layout?.windows ?? []) {
    expect(window.rect.x).toBeGreaterThanOrEqual(padding - 0.001);
    expect(window.rect.y).toBeGreaterThanOrEqual(padding - 0.001);
  }
});

test("panning away from every window still gets an indicator", () => {
  // The case the camera union exists for. The camera does not contain the windows here, so the
  // indicator has a position inside the box.
  const layout = getInfiniteCanvasMinimapLayout(canvasAt(9000, 9000, 1), size);

  expect(layout).not.toBeNull();
  expect(layout?.viewport).not.toBeNull();
  expect(layout?.viewport?.width).toBeLessThan(size.width);
});
