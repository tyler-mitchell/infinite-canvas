import { expect, test } from "vite-plus/test";

import { DEFAULT_INFINITE_CANVAS_CHROME } from "./constants";
import {
  frameLocalPointToScenePoint,
  frameLocalRectToScenePlane,
  getInfiniteCanvasWindowBodyProjection,
  getInfiniteCanvasWindowSceneShell,
} from "./window-scene-shell";

test("frame-local coordinates map to world-space scene coordinates", () => {
  const frameRect = {
    height: 200,
    width: 300,
  };

  expect(frameLocalPointToScenePoint(frameRect, { x: 0, y: 0 })).toEqual({
    x: -150,
    y: 100,
  });
  expect(frameLocalPointToScenePoint(frameRect, { x: 300, y: 200 })).toEqual({
    x: 150,
    y: -100,
  });
  expect(
    frameLocalRectToScenePlane(frameRect, {
      height: 40,
      width: 280,
      x: 10,
      y: 20,
    }),
  ).toEqual({
    center: {
      x: 0,
      y: 60,
    },
    height: 40,
    width: 280,
  });
});

test("scene shell preserves body layout while inflating thin visual strokes by zoom", () => {
  const shell = getInfiniteCanvasWindowSceneShell(
    {
      height: 240,
      width: 320,
      x: 100,
      y: 80,
    },
    DEFAULT_INFINITE_CANVAS_CHROME,
    0.25,
  );

  expect(shell.shellLayout.bodyRect).toEqual({
    height: 196,
    width: 316,
    x: 2,
    y: 42,
  });
  // The scene splits the frame the way the DOM chrome draws it, spending each border once.
  expect(shell.shellLayout.headerRect).toEqual({
    height: 40,
    width: 316,
    x: 2,
    y: 2,
  });
  expect(
    shell.shellLayout.headerRect.height +
      shell.shellLayout.bodyRect.height +
      shell.chromeMetrics.layoutBorderWidth * 2,
  ).toBe(240);
  // Layout keeps the true border while the drawn stroke thickens to stay visible when zoomed out.
  expect(shell.chromeMetrics.layoutBorderWidth).toBe(2);
  expect(shell.chromeMetrics.borderWidth).toBe(4);
  expect(shell.chromeMetrics.resizeHandleSize).toBe(40);
});

test("body projection derives DOM placement from the same scene proxy shell", () => {
  const projection = getInfiniteCanvasWindowBodyProjection(
    {
      height: 240,
      width: 320,
      x: 100,
      y: 80,
    },
    {
      center: {
        x: 200,
        y: 140,
      },
      zoom: 0.5,
    },
    {
      height: 600,
      width: 800,
    },
    DEFAULT_INFINITE_CANVAS_CHROME,
  );

  expect(projection.bodyLocalRect).toEqual({
    height: 196,
    width: 316,
    x: 2,
    y: 42,
  });
  expect(projection.bodyWorldRect).toEqual({
    height: 196,
    width: 316,
    x: 102,
    y: 122,
  });
  expect(projection.frameScreenTransform).toMatchObject({
    height: 240,
    scale: 0.5,
    width: 320,
    x: 350,
    y: 270,
  });
  expect(projection.bodyScreenTransform).toMatchObject({
    height: 196,
    scale: 0.5,
    width: 316,
    x: 351,
    y: 291,
  });
});

test("body projection can snap frame and body transforms to the device pixel grid", () => {
  const projection = getInfiniteCanvasWindowBodyProjection(
    {
      height: 220,
      width: 320,
      x: 23.477,
      y: -68.092,
    },
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
    DEFAULT_INFINITE_CANVAS_CHROME,
    2,
  );

  /*
   * Every edge lands on the grid, not only the origin. Snapping the origin alone left the far edge
   * wherever a fractional extent put it, which drew a crisp top border and a blurred bottom one.
   */
  const onDevicePixelGrid = (value: number) => Math.abs(value * 2 - Math.round(value * 2)) < 1e-9;

  for (const transform of [projection.frameScreenTransform, projection.bodyScreenTransform]) {
    expect(onDevicePixelGrid(transform.x)).toBe(true);
    expect(onDevicePixelGrid(transform.y)).toBe(true);
    expect(onDevicePixelGrid(transform.x + transform.width * transform.scale)).toBe(true);
    expect(onDevicePixelGrid(transform.y + transform.height * transform.scale)).toBe(true);
  }

  expect(projection.frameScreenTransform).toMatchObject({ scale: 0.65, x: 350.5, y: 229.5 });
  // The body starts one border lower than the header ends, so its screen y moves 2 * 0.65 down
  // from 255.5 to 256.8, which the half-pixel grid at this ratio takes to 257.
  expect(projection.bodyScreenTransform).toMatchObject({ scale: 0.65, x: 351.5, y: 257 });
});

test("the grid check rejects a far edge left on a fraction, which is what used to ship", () => {
  const onDevicePixelGrid = (value: number) => Math.abs(value * 2 - Math.round(value * 2)) < 1e-9;

  // The body is where it showed: an unsnapped height of 178 put the bottom edge at 371.2.
  expect(onDevicePixelGrid(255.5 + 178 * 0.65)).toBe(false);
  expect(onDevicePixelGrid(255.5 + 178.46153846153845 * 0.65)).toBe(true);
});
