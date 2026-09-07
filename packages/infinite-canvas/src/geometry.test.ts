import { expect, test } from "vite-plus/test";

import { DEFAULT_INFINITE_CANVAS_ZOOM, MIN_RENDERABLE_INFINITE_CANVAS_ZOOM } from "./constants";
import {
  getConstrainedZoom,
  getInfiniteCanvasContentViewport,
  getInfiniteCanvasContentWorldRect,
  getVisibleWorldRect,
  getWheelZoomFactor,
  getWindowBodyRect,
  getWindowHeaderRect,
  getWorldLengthWithScreenFloor,
  projectWorldRectToScreen,
  resizeRectFromHandle,
  screenPointToWorldPoint,
  snapScreenTransformToDevicePixels,
  snapScreenValueToDevicePixel,
  worldPointToScreenPoint,
  worldRectToScreenRect,
  worldRectToScreenTransform,
  zoomCameraAtScreenPoint,
} from "./geometry";

const CHROME = { bottom: 100, left: 200, right: 0, top: 50 };
const CENTERED_CAMERA = { center: { x: 0, y: 0 }, zoom: 1 };
const VIEWPORT = { height: 800, width: 1000 };

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

test("a stroke never renders thinner than one screen pixel", () => {
  for (const scale of [1, 0.5, 0.1, 0.02]) {
    const worldWidth = getWorldLengthWithScreenFloor(1, scale);

    expect(worldWidth * scale).toBeGreaterThanOrEqual(1 - 1e-9);
  }
});

test("above 100% zoom the floor is inert and the authored width wins", () => {
  expect(getWorldLengthWithScreenFloor(1, 2)).toBe(1);
  expect(getWorldLengthWithScreenFloor(3, 4)).toBe(3);
});

test("a thicker authored stroke is never thinned to reach the floor", () => {
  expect(getWorldLengthWithScreenFloor(4, 0.5)).toBe(4);
});

test("a non-positive scale passes the authored width through instead of dividing by zero", () => {
  expect(getWorldLengthWithScreenFloor(2, 0)).toBe(2);
  expect(getWorldLengthWithScreenFloor(2, -1)).toBe(2);
  expect(Number.isFinite(getWorldLengthWithScreenFloor(2, 0))).toBe(true);
});

test("the floor is configurable for callers that need a thicker minimum", () => {
  expect(getWorldLengthWithScreenFloor(1, 0.5, 2)).toBe(4);
});

test("the content world rect is the unoccluded region, not the whole viewport", () => {
  const content = getInfiniteCanvasContentWorldRect(CENTERED_CAMERA, VIEWPORT, CHROME);

  expect(content).toEqual({ height: 650, width: 800, x: -300, y: -350 });
});

test("asymmetric chrome moves the visible centre off the camera centre", () => {
  const content = getInfiniteCanvasContentWorldRect(CENTERED_CAMERA, VIEWPORT, CHROME);
  const visible = getVisibleWorldRect(CENTERED_CAMERA, VIEWPORT, 0);

  expect(content.x + content.width / 2).toBe(100);
  expect(content.y + content.height / 2).toBe(-25);
  expect(visible.x + visible.width / 2).toBe(0);
  expect(visible.y + visible.height / 2).toBe(0);
});

test("with no chrome it agrees with the unpadded visible rect", () => {
  const content = getInfiniteCanvasContentWorldRect(CENTERED_CAMERA, VIEWPORT);

  expect(content).toEqual(getVisibleWorldRect(CENTERED_CAMERA, VIEWPORT, 0));
});

test("the content world rect projects back onto the content viewport", () => {
  const camera = { center: { x: 120, y: -80 }, zoom: 1.75 };
  const content = getInfiniteCanvasContentWorldRect(camera, VIEWPORT, CHROME);
  const projected = worldRectToScreenRect(camera, VIEWPORT, content);
  const expected = getInfiniteCanvasContentViewport(VIEWPORT, CHROME);

  expect(projected.left).toBeCloseTo(expected.x, 5);
  expect(projected.top).toBeCloseTo(expected.y, 5);
  expect(projected.width).toBeCloseTo(expected.width, 5);
  expect(projected.height).toBeCloseTo(expected.height, 5);
});

test("zoom scales the world rect while the screen region it covers stays put", () => {
  const zoomed = getInfiniteCanvasContentWorldRect(
    { center: { x: 0, y: 0 }, zoom: 2 },
    VIEWPORT,
    CHROME,
  );

  expect(zoomed).toEqual({ height: 325, width: 400, x: -150, y: -175 });
});

test("chrome wider than the viewport clamps instead of inverting the rect", () => {
  const collapsed = getInfiniteCanvasContentWorldRect(CENTERED_CAMERA, VIEWPORT, {
    bottom: 900,
    left: 900,
    right: 900,
    top: 900,
  });

  expect(collapsed.width).toBeGreaterThan(0);
  expect(collapsed.height).toBeGreaterThan(0);
});

test("the header and body fill the frame between its borders, spending each one once", () => {
  const chrome = {
    borderWidth: 2,
    cornerSize: 8,
    groupLabelSize: 12,
    headerAccentHeight: 2,
    headerHeight: 32,
    resizeHandleSize: 10,
  };
  const rect = { height: 240, width: 360, x: 0, y: 0 };
  const header = getWindowHeaderRect(rect, chrome);
  const body = getWindowBodyRect(rect, chrome);

  // The header draws its own height, with the border outside it.
  expect(header.height).toBe(32);
  expect(header.y).toBe(chrome.borderWidth);
  // The body starts where the header ends and stops at the far border.
  expect(body.y).toBe(header.y + header.height);
  expect(body.y + body.height).toBe(rect.height - chrome.borderWidth);
  expect(body.height).toBe(204);
  // Neither box counts a border the other already spent.
  expect(header.height + body.height + chrome.borderWidth * 2).toBe(rect.height);
  expect(header.width).toBe(body.width);
  expect(body.width).toBe(356);
});

test("a degenerate zoom yields a finite rect rather than an infinite one", () => {
  const degenerate = getInfiniteCanvasContentWorldRect(
    { center: { x: 0, y: 0 }, zoom: 0 },
    VIEWPORT,
    CHROME,
  );

  expect(Number.isFinite(degenerate.width)).toBe(true);
  expect(Number.isFinite(degenerate.height)).toBe(true);
});
