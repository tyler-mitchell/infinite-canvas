import { expect, test } from "vite-plus/test";

import {
  getInfiniteCanvasRectConnectorPath,
  getInfiniteCanvasViewportScreenRect,
  getInfiniteCanvasWindowConnectorPoint,
  getInfiniteCanvasWindowConnectorPath,
  getInfiniteCanvasWindowConnectorSegment,
  getInfiniteCanvasWindowProxyCullingRect,
  getInfiniteCanvasWorldPath,
  getInfiniteCanvasWorldPathPointAtProgress,
  getVisibleInfiniteCanvasWindowProxies,
} from "./scene-layer-geometry";
import type { InfiniteCanvasRect, InfiniteCanvasWindowProxy } from "./types";

function createWindowProxy(
  id: string,
  rect: Readonly<{
    height: number;
    width: number;
    x: number;
    y: number;
  }>,
  screenRect: InfiniteCanvasRect = rect,
): InfiniteCanvasWindowProxy<"card"> {
  const center = {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
  };
  const screenCenter = {
    x: screenRect.x + screenRect.width / 2,
    y: screenRect.y + screenRect.height / 2,
  };

  return {
    bodyLocalRect: rect,
    bodyWorldRect: rect,
    center,
    frameWorldRect: rect,
    id,
    isActive: false,
    isPinned: false,
    isSelected: false,
    kind: "card",
    mode: "normal",
    rect,
    screenCenter,
    screenRect,
    screenSize: {
      height: screenRect.height,
      width: screenRect.width,
    },
    size: {
      height: rect.height,
      width: rect.width,
    },
    title: id,
    zIndex: 0,
  };
}

test("viewport screen rect uses the screen-space origin", () => {
  expect(
    getInfiniteCanvasViewportScreenRect({
      height: 360,
      width: 640,
    }),
  ).toEqual({
    height: 360,
    width: 640,
    x: 0,
    y: 0,
  });
});

test("window proxy culling rect follows the requested scene-layer space", () => {
  const window = createWindowProxy(
    "card",
    {
      height: 120,
      width: 160,
      x: 800,
      y: 900,
    },
    {
      height: 60,
      width: 80,
      x: 20,
      y: 30,
    },
  );

  expect(getInfiniteCanvasWindowProxyCullingRect(window, "world")).toBe(window.rect);
  expect(getInfiniteCanvasWindowProxyCullingRect(window, "screen")).toBe(window.screenRect);
});

test("visible window proxies are culled in world space", () => {
  const visible = createWindowProxy("visible", {
    height: 80,
    width: 120,
    x: 20,
    y: 30,
  });
  const hidden = createWindowProxy("hidden", {
    height: 80,
    width: 120,
    x: 500,
    y: 30,
  });
  const visibleWindows = getVisibleInfiniteCanvasWindowProxies(
    [visible, hidden],
    {
      height: 220,
      width: 220,
      x: 0,
      y: 0,
    },
    "world",
  );

  expect(visibleWindows).toEqual([visible]);
});

test("visible window proxies are culled in screen space", () => {
  const visible = createWindowProxy(
    "visible",
    {
      height: 80,
      width: 120,
      x: 500,
      y: 500,
    },
    {
      height: 80,
      width: 120,
      x: 20,
      y: 30,
    },
  );
  const hidden = createWindowProxy(
    "hidden",
    {
      height: 80,
      width: 120,
      x: 20,
      y: 30,
    },
    {
      height: 80,
      width: 120,
      x: 500,
      y: 500,
    },
  );
  const visibleWindows = getVisibleInfiniteCanvasWindowProxies(
    [visible, hidden],
    {
      height: 220,
      width: 220,
      x: 0,
      y: 0,
    },
    "screen",
  );

  expect(visibleWindows).toEqual([visible]);
});

test("window connector points land on the padded rectangle edge toward the target", () => {
  const source = createWindowProxy("source", {
    height: 80,
    width: 100,
    x: 0,
    y: 0,
  });
  const target = createWindowProxy("target", {
    height: 80,
    width: 100,
    x: 200,
    y: 40,
  });
  const point = getInfiniteCanvasWindowConnectorPoint(source, target.center, {
    padding: 10,
  });

  expect(point.x).toBe(110);
  expect(point.y).toBe(52);
});

test("window connector segments trim card-to-card edges before scene rendering", () => {
  const source = createWindowProxy("source", {
    height: 80,
    width: 100,
    x: 0,
    y: 0,
  });
  const target = createWindowProxy("target", {
    height: 80,
    width: 100,
    x: 200,
    y: 40,
  });
  const segment = getInfiniteCanvasWindowConnectorSegment(source, target, {
    padding: 10,
  });

  expect(segment.start).toEqual({
    x: 110,
    y: 52,
  });
  expect(segment.end).toEqual({
    x: 190,
    y: 68,
  });
  expect(segment.length).toBeCloseTo(81.584, 3);
});

test("window connector paths can route through orthogonal waypoints", () => {
  const source = createWindowProxy("source", {
    height: 80,
    width: 100,
    x: 0,
    y: 0,
  });
  const target = createWindowProxy("target", {
    height: 80,
    width: 100,
    x: 280,
    y: 120,
  });
  const path = getInfiniteCanvasWindowConnectorPath(source, target, {
    padding: 8,
    route: "orthogonal",
  });

  expect(path.points.length).toBe(4);
  expect(path.segments.length).toBe(3);
  expect(path.length).toBeGreaterThan(0);
  expect(path.bounds).toMatchObject({
    x: 108,
  });
});

test("rect connector paths can be used for screen-space card bindings", () => {
  const path = getInfiniteCanvasRectConnectorPath(
    {
      height: 90,
      width: 180,
      x: 40,
      y: 60,
    },
    {
      height: 120,
      width: 220,
      x: 420,
      y: 110,
    },
    {
      padding: 4,
      route: "orthogonal",
    },
  );

  expect(path.points.length).toBe(4);
  expect(path.points.at(0)?.x).toBe(224);
  expect(path.points.at(0)?.y).toBeCloseTo(120.275, 3);
  expect(path.points.at(-1)?.x).toBe(416);
  expect(path.points.at(-1)?.y).toBeCloseTo(151.475, 3);
});

test("world paths expose progress points and scene transforms", () => {
  const path = getInfiniteCanvasWorldPath([
    {
      x: 0,
      y: 0,
    },
    {
      x: 100,
      y: 0,
    },
    {
      x: 100,
      y: 50,
    },
  ]);

  expect(path.length).toBe(150);
  expect(getInfiniteCanvasWorldPathPointAtProgress(path, 0.5)).toEqual({
    x: 75,
    y: 0,
  });
  expect(path.segments.map((segment) => segment.length)).toEqual([100, 50]);
  expect(path.segments.map((segment) => segment.midpoint)).toEqual([
    { x: 50, y: 0 },
    { x: 100, y: 25 },
  ]);
});

test("on an elbow, the routed midpoint is on the line and the endpoint average is not", () => {
  const path = getInfiniteCanvasWorldPath([
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 50 },
  ]);
  const routed = getInfiniteCanvasWorldPathPointAtProgress(path, 0.5);
  const endpointAverage = { x: 50, y: 25 };
  const isOnPath = (point: Readonly<{ x: number; y: number }>) =>
    path.segments.some((segment) => {
      const spansX = Math.min(segment.start.x, segment.end.x) <= point.x;
      const withinX = spansX && point.x <= Math.max(segment.start.x, segment.end.x);
      const spansY = Math.min(segment.start.y, segment.end.y) <= point.y;
      const withinY = spansY && point.y <= Math.max(segment.start.y, segment.end.y);
      const straddles =
        segment.start.x === segment.end.x
          ? point.x === segment.start.x
          : point.y === segment.start.y;

      return withinX && withinY && straddles;
    });

  expect(routed).not.toEqual(endpointAverage);
  expect(isOnPath(routed)).toBe(true);
  expect(isOnPath(endpointAverage)).toBe(false);
});

test("a window connector segment carries its own midpoint and angle in world units", () => {
  const source = createWindowProxy("source", {
    height: 80,
    width: 100,
    x: 0,
    y: 0,
  });
  const target = createWindowProxy("target", {
    height: 80,
    width: 100,
    x: 200,
    y: 40,
  });
  const segment = getInfiniteCanvasWindowConnectorSegment(source, target, {
    padding: 10,
  });

  expect(segment.midpoint).toEqual({ x: 150, y: 60 });
  expect(segment.angle).toBeCloseTo(0.1974, 4);
  expect(segment.length).toBeCloseTo(Math.hypot(segment.delta.x, segment.delta.y), 10);
});
