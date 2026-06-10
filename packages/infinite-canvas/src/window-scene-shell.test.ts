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
    height: 198,
    width: 316,
    x: 2,
    y: 40,
  });
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
    height: 198,
    width: 316,
    x: 2,
    y: 40,
  });
  expect(projection.bodyWorldRect).toEqual({
    height: 198,
    width: 316,
    x: 102,
    y: 120,
  });
  expect(projection.frameScreenTransform).toMatchObject({
    height: 240,
    scale: 0.5,
    width: 320,
    x: 350,
    y: 270,
  });
  expect(projection.bodyScreenTransform).toMatchObject({
    height: 198,
    scale: 0.5,
    width: 316,
    x: 351,
    y: 290,
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

  expect(projection.frameScreenTransform).toMatchObject({
    height: 220,
    scale: 0.65,
    width: 320,
    x: 350.5,
    y: 229.5,
  });
  expect(projection.bodyScreenTransform).toMatchObject({
    height: 178,
    scale: 0.65,
    width: 316,
    x: 351.5,
    y: 255.5,
  });
});
