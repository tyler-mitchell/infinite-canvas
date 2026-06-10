import { expect, test } from "vite-plus/test";

import {
  DEFAULT_INFINITE_CANVAS_ZOOM,
  MIN_RENDERABLE_INFINITE_CANVAS_ZOOM,
} from "#/experiments/infinite-canvas/constants";
import {
  getConstrainedZoom,
  getWheelZoomFactor,
  projectWorldRectToScreen,
  resizeRectFromHandle,
  screenPointToWorldPoint,
  snapScreenTransformToDevicePixels,
  snapScreenValueToDevicePixel,
  worldPointToScreenPoint,
  worldRectToScreenTransform,
  zoomCameraAtScreenPoint,
} from "#/experiments/infinite-canvas/geometry";

test("world and screen projection round-trip through one camera contract", () => {
  const camera = {
    center: {
      x: 120,
      y: -80,
    },
    zoom: 1.75,
  };
  const viewport = {
    height: 720,
    width: 1280,
  };
  const point = {
    x: -240,
    y: 180,
  };
  const projected = worldPointToScreenPoint(camera, viewport, point);
  const roundTrip = screenPointToWorldPoint(camera, viewport, projected);

  expect(roundTrip.x).toBeCloseTo(point.x, 5);
  expect(roundTrip.y).toBeCloseTo(point.y, 5);
});

test("zooming at an anchor preserves the world point under that screen point", () => {
  const camera = {
    center: {
      x: 0,
      y: 0,
    },
    zoom: 1,
  };
  const viewport = {
    height: 900,
    width: 1440,
  };
  const anchor = {
    x: 1120,
    y: 260,
  };
  const anchoredWorldPoint = screenPointToWorldPoint(camera, viewport, anchor);
  const nextCamera = zoomCameraAtScreenPoint(camera, viewport, anchor, 2.2);
  const nextAnchor = worldPointToScreenPoint(nextCamera, viewport, anchoredWorldPoint);

  expect(nextAnchor.x).toBeCloseTo(anchor.x, 5);
  expect(nextAnchor.y).toBeCloseTo(anchor.y, 5);
});

test("wheel zoom factor is continuous and directionally symmetric", () => {
  const zoomIn = getWheelZoomFactor(-24);
  const zoomOut = getWheelZoomFactor(24);
  const largerZoomIn = getWheelZoomFactor(-48);

  expect(zoomIn).toBeGreaterThan(1);
  expect(zoomIn).toBeLessThan(1.15);
  expect(zoomOut).toBeLessThan(1);
  expect(zoomIn * zoomOut).toBeCloseTo(1, 5);
  expect(largerZoomIn).toBeGreaterThan(zoomIn);
});

test("wheel zoom factor clamps unusually large wheel bursts", () => {
  expect(getWheelZoomFactor(-10_000)).toBeCloseTo(getWheelZoomFactor(-1_000), 5);
  expect(getWheelZoomFactor(10_000)).toBeCloseTo(getWheelZoomFactor(1_000), 5);
});

test("default zoom policy uses a 12 percent floor", () => {
  expect(DEFAULT_INFINITE_CANVAS_ZOOM.minZoom).toBe(0.12);
  expect(getConstrainedZoom(0)).toBe(0.12);
});

test("custom zoom policy can opt below the default floor while preserving render safety", () => {
  expect(getConstrainedZoom(0, { ...DEFAULT_INFINITE_CANVAS_ZOOM, minZoom: 0 })).toBe(
    MIN_RENDERABLE_INFINITE_CANVAS_ZOOM,
  );
});

test("wheel zoom sensitivity is policy driven", () => {
  const baseZoomIn = getWheelZoomFactor(-24, {
    ...DEFAULT_INFINITE_CANVAS_ZOOM,
    wheelSensitivity: 1,
  });
  const fasterZoomIn = getWheelZoomFactor(-24, {
    ...DEFAULT_INFINITE_CANVAS_ZOOM,
    wheelSensitivity: 1.8,
  });

  expect(fasterZoomIn).toBeGreaterThan(baseZoomIn);
});

test("screen transform keeps world dimensions separate from visual zoom", () => {
  const camera = {
    center: {
      x: -90,
      y: 75,
    },
    zoom: 0.65,
  };
  const viewport = {
    height: 960,
    width: 1440,
  };
  const rect = {
    height: 220,
    width: 320,
    x: 180,
    y: -40,
  };
  const transform = worldRectToScreenTransform(camera, viewport, rect);

  expect(transform.height).toBe(rect.height);
  expect(transform.width).toBe(rect.width);
  expect(transform.scale).toBe(camera.zoom);
});

test("screen transform can snap translation to the device pixel grid", () => {
  expect(snapScreenValueToDevicePixel(10.26, 2)).toBe(10.5);
  expect(
    snapScreenTransformToDevicePixels(
      {
        height: 220,
        scale: 0.65,
        width: 320,
        x: 350.26,
        y: 270.74,
      },
      2,
    ),
  ).toEqual({
    height: 220,
    scale: 0.65,
    width: 320,
    x: 350.5,
    y: 270.5,
  });
});

test("projected screen rect exposes raw and device-pixel-snapped projection", () => {
  const projection = projectWorldRectToScreen(
    {
      center: {
        x: 100,
        y: 40,
      },
      zoom: 0.65,
    },
    {
      height: 600,
      width: 800,
    },
    {
      height: 220,
      width: 320,
      x: 23.477,
      y: -68.092,
    },
    2,
  );

  expect(projection.rawScreenTransform.x).toBeCloseTo(350.26005, 5);
  expect(projection.rawScreenTransform.y).toBeCloseTo(229.7402, 5);
  expect(projection.screenTransform.x).toBe(350.5);
  expect(projection.screenTransform.y).toBe(229.5);
  expect(projection.screenRect).toEqual({
    height: 143,
    left: 350.5,
    top: 229.5,
    width: 208,
  });
});

test("west resize respects minimum width without drifting past the clamp", () => {
  const nextRect = resizeRectFromHandle(
    {
      height: 240,
      width: 320,
      x: 100,
      y: 200,
    },
    "west",
    {
      x: 260,
      y: 0,
    },
    {
      height: 160,
      width: 180,
    },
  );

  expect(nextRect.width).toBe(180);
  expect(nextRect.x).toBe(240);
  expect(nextRect.y).toBe(200);
  expect(nextRect.height).toBe(240);
});
