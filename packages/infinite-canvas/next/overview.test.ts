import { expect, test } from "vite-plus/test";
import {
  getDetailLevel,
  getMinimapLayout,
  getMinimapWorldPoint,
  getOffscreenIndicators,
} from "./overview";
import { createCanvasState } from "./state";

const viewport = { x: 0, y: 0, width: 400, height: 200 };

test("the minimap keeps one scale, contains the viewport, and maps points back to the world", () => {
  const size = { width: 100, height: 100 };
  const layout = getMinimapLayout({
    rects: { a: { x: 400, y: 0, width: 400, height: 200 } },
    viewport,
    size,
  })!;
  expect(layout.scale).toBe(0.125);
  expect(layout.viewport).toEqual({ x: 0, y: 37.5, width: 50, height: 25 });
  expect(layout.items.a).toEqual({ x: 50, y: 37.5, width: 50, height: 25 });
  expect(getMinimapWorldPoint({ layout, size, point: { x: 75, y: 50 } })).toEqual({
    x: 600,
    y: 100,
  });
  expect(getMinimapLayout({ rects: {}, viewport, size: { width: 0, height: 100 } })).toBeNull();
});

test("offscreen indicators skip visible rectangles, point at the edge, and sort by distance", () => {
  const indicators = getOffscreenIndicators({
    viewport,
    rects: {
      visible: { x: 100, y: 50, width: 50, height: 50 },
      far: { x: 2000, y: 50, width: 100, height: 100 },
      below: { x: 150, y: 400, width: 100, height: 100 },
    },
  });
  expect(indicators.map((indicator) => indicator.key)).toEqual(["below", "far"]);
  expect(indicators[0].edge).toEqual({ x: 0.5, y: 1 });
  expect(indicators[0].angle).toBeCloseTo(Math.PI / 2);
  expect(indicators[1].edge).toEqual({ x: 1, y: 0.5 });
});

test("the detail level changes at its thresholds and holds between them", () => {
  const thresholds = { summaryBelow: 180, fullAbove: 240 };
  expect(getDetailLevel({ width: 179, previous: "full", ...thresholds })).toBe("summary");
  expect(getDetailLevel({ width: 200, previous: "summary", ...thresholds })).toBe("summary");
  expect(getDetailLevel({ width: 200, previous: "full", ...thresholds })).toBe("full");
  expect(getDetailLevel({ width: 240, previous: "summary", ...thresholds })).toBe("full");
});

test("content rectangles list root windows without their children or viewport occluders", () => {
  const rect = { x: 0, y: 0, width: 100, height: 80 };
  const canvas = createCanvasState({
    windowDefinitions: { note: {} },
    viewport: { width: 800, height: 600 },
    viewportOccluders: [{ x: 0, y: 0, width: 50, height: 50 }],
    document: {
      content: {
        windows: { a: { kind: "note", title: "A", rect }, b: { kind: "note", title: "B", rect } },
      },
    },
  });
  canvas.actions.groupWindows.run({ id: "g", windows: ["b"] });
  expect(Object.keys(canvas.computed.contentRects.peek()).toSorted()).toEqual([
    "window:a",
    "window:g",
  ]);
  expect(Object.keys(canvas.computed.occupiedRects.peek()).toSorted()).toEqual([
    "occluder:0",
    "window:a",
    "window:g",
  ]);
});
