import { d } from "typegpu";
import { describe, expect, test } from "vite-plus/test";
import {
  type Camera,
  containsPoint,
  createOccupancyGrid,
  findFreeArea,
  intersectsRect,
  markArea,
  type Rect,
  resizeRect,
  screenToWorld,
  type SizeLimits,
  unionRects,
  worldToScreen,
} from "./cpu";
import { containsPoint as containsPointOnGpu, Rect as RectSchema, View } from "./gpu";

const camera: Camera = { center: { x: 200, y: 150 }, zoom: 1 };
const viewport = { width: 800, height: 600 };

describe("a DOM consumer works entirely in plain objects from ./cpu", () => {
  const windows: Rect[] = [
    { x: 0, y: 0, width: 120, height: 80 },
    { x: 200, y: 40, width: 160, height: 90 },
    { x: 60, y: 200, width: 100, height: 100 },
  ];

  test("a pointer in screen space finds the window under it", () => {
    const onScreen = worldToScreen({ point: { x: 80, y: 60 }, camera, viewport });
    const back = screenToWorld({ point: onScreen, camera, viewport });
    expect(windows.findIndex((window) => containsPoint(window, back))).toBe(0);
  });

  test("the round trip holds a tenth of a pixel, which is why ./cpu exists", () => {
    const world = { x: 400.1, y: 0.1 };
    const onScreen = worldToScreen({ point: world, camera, viewport });
    const back = screenToWorld({ point: onScreen, camera, viewport });
    expect(Math.abs(back.x - 400.1)).toBeLessThan(1e-12);
    expect(Math.abs(back.y - 0.1)).toBeLessThan(1e-12);
  });

  test("the same round trip through the kernel loses it", () => {
    const gpuCamera = View({
      center: d.vec2f(200, 150),
      viewport: d.vec2f(800, 600),
      zoom: 1,
    });
    const rect = RectSchema({ x: 400, y: 0, width: 0.05, height: 1 });
    expect(rect.width).not.toBe(0.05);
    expect(containsPointOnGpu(rect, d.vec2f(400.1, 0.5))).toBe(
      containsPoint({ x: 400, y: 0, width: Math.fround(0.05), height: 1 }, { x: 400.1, y: 0.5 }),
    );
    expect(gpuCamera.center.x).toBe(200);
  });

  test("resizing a window keeps a fractional delta intact", () => {
    const limits: SizeLimits = {
      min: { width: 40, height: 40 },
      max: { width: Infinity, height: Infinity },
    };
    const resized = resizeRect({
      rect: { x: 0, y: 0, width: 120, height: 80 },
      handle: "south-east",
      delta: { x: 30.1, y: 20 },
      limits,
    });
    expect(resized.width).toBe(150.1);
  });

  test("the bounds of every window contain each of them", () => {
    const bounds = unionRects(windows)!;
    windows.forEach((window) => expect(intersectsRect(bounds, window)).toBe(true));
  });

  test("a grid places a span and then reports it taken", () => {
    const grid = createOccupancyGrid({ columns: 12, rows: 4 });
    const at = findFreeArea({ grid, span: { columns: 3, rows: 2 } })!;
    expect(at).toEqual({ column: 0, row: 0 });
    const taken = markArea({ grid, area: { ...at, columns: 3, rows: 2 } });
    expect(findFreeArea({ grid: taken, span: { columns: 3, rows: 2 } })).not.toEqual(at);
  });
});
