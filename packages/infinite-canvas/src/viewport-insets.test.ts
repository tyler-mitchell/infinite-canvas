import { expect, test } from "vite-plus/test";

import {
  fitCameraToWorldRect,
  getInfiniteCanvasContentViewport,
  getInfiniteCanvasInsetCameraCenter,
  resolveInfiniteCanvasViewportInsets,
  screenPointToWorldPoint,
} from "./geometry";
import type { InfiniteCanvasRect, InfiniteCanvasViewport } from "./types";

/**
 * Insets exist because every previous inset in this framework was one number for all four edges.
 *
 * So the tests that matter are the asymmetric ones. A symmetric inset is indistinguishable from
 * padding and would pass against the old behaviour, which is exactly why it proves nothing — each
 * case below fails if any single edge is dropped or if two edges are averaged together.
 */

const VIEWPORT: InfiniteCanvasViewport = { height: 800, width: 1200 };
const RECT: InfiniteCanvasRect = { height: 200, width: 400, x: 0, y: 0 };

/** Where a camera actually puts a world point on screen. The independent check for every case. */
function screenPointOf(
  camera: Readonly<{ center: Readonly<{ x: number; y: number }>; zoom: number }>,
  world: Readonly<{ x: number; y: number }>,
) {
  return {
    x: (world.x - camera.center.x) * camera.zoom + VIEWPORT.width / 2,
    y: (world.y - camera.center.y) * camera.zoom + VIEWPORT.height / 2,
  };
}

test("resolveInfiniteCanvasViewportInsets — fills every edge a consumer did not name", () => {
  expect(resolveInfiniteCanvasViewportInsets({ left: 320 })).toEqual({
    bottom: 0,
    left: 320,
    right: 0,
    top: 0,
  });
});

test("resolveInfiniteCanvasViewportInsets — resolves an absent input to no insets at all", () => {
  expect(resolveInfiniteCanvasViewportInsets()).toEqual({
    bottom: 0,
    left: 0,
    right: 0,
    top: 0,
  });
});

test("getInfiniteCanvasContentViewport — takes each edge off its own side", () => {
  expect(
    getInfiniteCanvasContentViewport(VIEWPORT, {
      bottom: 40,
      left: 320,
      right: 0,
      top: 56,
    }),
  ).toEqual({ height: 800 - 56 - 40, width: 1200 - 320, x: 320, y: 56 });
});

test("getInfiniteCanvasContentViewport — clamps rather than inverting when chrome covers everything", () => {
  const content = getInfiniteCanvasContentViewport(VIEWPORT, {
    bottom: 0,
    left: 900,
    right: 900,
    top: 0,
  });

  expect(content.width).toBeGreaterThan(0);
});

test("getInfiniteCanvasInsetCameraCenter — shifts by half the asymmetry, in world units", () => {
  // 320px of chrome on the left means the visible middle sits 160px right of the viewport's
  // middle, so the camera has to move 160px *left* in world terms to put the point there.
  expect(
    getInfiniteCanvasInsetCameraCenter({ x: 0, y: 0 }, 2, {
      bottom: 0,
      left: 320,
      right: 0,
      top: 0,
    }),
  ).toEqual({ x: -80, y: 0 });
});

test("getInfiniteCanvasInsetCameraCenter — cancels when opposing edges match, because that is padding", () => {
  expect(
    getInfiniteCanvasInsetCameraCenter({ x: 10, y: 20 }, 1, {
      bottom: 64,
      left: 64,
      right: 64,
      top: 64,
    }),
  ).toEqual({ x: 10, y: 20 });
});

test("fitCameraToWorldRect with insets — puts the rect's centre in the middle of the unoccluded region, not the viewport", () => {
  const camera = fitCameraToWorldRect(VIEWPORT, RECT, 80, undefined, {
    bottom: 0,
    left: 320,
    right: 0,
    top: 0,
  });

  expect(camera).not.toBeNull();

  const screen = screenPointOf(camera as NonNullable<typeof camera>, { x: 200, y: 100 });

  // The middle of what the user can see: 320 + (1200 - 320) / 2.
  expect(screen.x).toBeCloseTo(760, 6);
  expect(screen.y).toBeCloseTo(400, 6);
});

test("fitCameraToWorldRect with insets — zooms to the unoccluded width, so a wide panel means a smaller fit", () => {
  const withoutPanel = fitCameraToWorldRect(VIEWPORT, RECT, 0);
  const withPanel = fitCameraToWorldRect(VIEWPORT, RECT, 0, undefined, {
    bottom: 0,
    left: 600,
    right: 0,
    top: 0,
  });

  expect(withPanel?.zoom).toBeLessThan(withoutPanel?.zoom ?? 0);
});

test("fitCameraToWorldRect with insets — is unchanged when no insets are given", () => {
  expect(fitCameraToWorldRect(VIEWPORT, RECT, 80)).toEqual(
    fitCameraToWorldRect(VIEWPORT, RECT, 80, undefined, {
      bottom: 0,
      left: 0,
      right: 0,
      top: 0,
    }),
  );
});

test("fitCameraToWorldRect with insets — agrees with the framework's own screen projection", () => {
  const insets = { bottom: 24, left: 320, right: 0, top: 56 };
  const camera = fitCameraToWorldRect(VIEWPORT, RECT, 40, undefined, insets);

  expect(camera).not.toBeNull();

  const projected = screenPointToWorldPoint(
    camera as NonNullable<typeof camera>,
    VIEWPORT,
    // The centre of the unoccluded region, in screen space.
    {
      x: insets.left + (VIEWPORT.width - insets.left - insets.right) / 2,
      y: insets.top + (VIEWPORT.height - insets.top - insets.bottom) / 2,
    },
  );

  expect(projected.x).toBeCloseTo(200, 6);
  expect(projected.y).toBeCloseTo(100, 6);
});
