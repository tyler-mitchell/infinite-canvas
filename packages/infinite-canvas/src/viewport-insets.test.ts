import { expect, test } from "vite-plus/test";

import { navigateCameraToWindow } from "./camera-navigation";
import { resolveInfiniteCanvasViewportInsets } from "./constants";
import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import {
  fitCameraToWorldRect,
  getInfiniteCanvasContentViewport,
  getInfiniteCanvasInsetCameraCenter,
  screenPointToWorldPoint,
} from "./geometry";
import { getInfiniteCanvasOffscreenIndicators } from "./offscreen";
import { reduceInfiniteCanvasState } from "./operations";
import type { InfiniteCanvasRect, InfiniteCanvasViewport } from "./types";

const VIEWPORT: InfiniteCanvasViewport = { height: 800, width: 1200 };
const RECT: InfiniteCanvasRect = { height: 200, width: 400, x: 0, y: 0 };

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
  const camera = fitCameraToWorldRect({
    viewport: VIEWPORT,
    rect: RECT,
    paddingPx: 80,
    insets: {
      bottom: 0,
      left: 320,
      right: 0,
      top: 0,
    },
  });

  expect(camera).not.toBeNull();

  const screen = screenPointOf(camera as NonNullable<typeof camera>, { x: 200, y: 100 });

  expect(screen.x).toBeCloseTo(760, 6);
  expect(screen.y).toBeCloseTo(400, 6);
});

test("fitCameraToWorldRect with insets — zooms to the unoccluded width, so a wide panel means a smaller fit", () => {
  const withoutPanel = fitCameraToWorldRect({ viewport: VIEWPORT, rect: RECT, paddingPx: 0 });
  const withPanel = fitCameraToWorldRect({
    viewport: VIEWPORT,
    rect: RECT,
    paddingPx: 0,
    insets: {
      bottom: 0,
      left: 600,
      right: 0,
      top: 0,
    },
  });

  expect(withPanel?.zoom).toBeLessThan(withoutPanel?.zoom ?? 0);
});

test("fitCameraToWorldRect with insets — is unchanged when no insets are given", () => {
  expect(fitCameraToWorldRect({ viewport: VIEWPORT, rect: RECT, paddingPx: 80 })).toEqual(
    fitCameraToWorldRect({
      viewport: VIEWPORT,
      rect: RECT,
      paddingPx: 80,
      insets: {
        bottom: 0,
        left: 0,
        right: 0,
        top: 0,
      },
    }),
  );
});

test("navigateCamera — centring a window accounts for chrome on one edge", () => {
  const base = createInfiniteCanvasState<"note">({
    viewport: VIEWPORT,
    viewportInsets: { left: 400 },
    windows: [
      createInfiniteCanvasWindow<"note">({
        id: "note",
        kind: "note",
        rect: { height: 200, width: 400, x: 1000, y: 500 },
      }),
    ],
  });
  const navigated = navigateCameraToWindow(base, { windowId: "note" });
  const screen = screenPointOf(navigated.camera, { x: 1200, y: 600 });

  expect(screen.x).toBeCloseTo(800, 6);
  expect(screen.y).toBeCloseTo(400, 6);
});

test("navigateCamera — a canvas that never sets insets is unchanged", () => {
  const windows = [
    createInfiniteCanvasWindow<"note">({
      id: "note",
      kind: "note",
      rect: { height: 200, width: 400, x: 1000, y: 500 },
    }),
  ];

  expect(
    navigateCameraToWindow(createInfiniteCanvasState<"note">({ viewport: VIEWPORT, windows }), {
      windowId: "note",
    }).camera,
  ).toEqual(
    navigateCameraToWindow(
      createInfiniteCanvasState<"note">({
        viewport: VIEWPORT,
        viewportInsets: { bottom: 0, left: 0, right: 0, top: 0 },
        windows,
      }),
      { windowId: "note" },
    ).camera,
  );
});

test("getInfiniteCanvasOffscreenIndicators — the ring sits inside what the user can see", () => {
  const state = createInfiniteCanvasState<"note">({
    viewport: VIEWPORT,
    viewportInsets: { left: 400 },
    windows: [
      createInfiniteCanvasWindow<"note">({
        id: "note",
        kind: "note",
        rect: { height: 100, width: 100, x: -5000, y: 0 },
      }),
    ],
  });
  const [indicator] = getInfiniteCanvasOffscreenIndicators(state, { insetPx: 0 });

  expect(indicator).toBeDefined();
  expect(indicator?.point.x).toBeCloseTo(400, 6);
});

test("viewportInsets.set — the store's action reaches state, with unnamed edges filled", () => {
  const base = createInfiniteCanvasState<"note">({ viewport: VIEWPORT, windows: [] });
  const next = reduceInfiniteCanvasState(base, {
    insets: resolveInfiniteCanvasViewportInsets({ left: 320 }),
    type: "viewportInsets.set",
  });

  expect(next.viewportInsets).toEqual({ bottom: 0, left: 320, right: 0, top: 0 });
});

test("fitCameraToWorldRect with insets — agrees with the framework's own screen projection", () => {
  const insets = { bottom: 24, left: 320, right: 0, top: 56 };
  const camera = fitCameraToWorldRect({ viewport: VIEWPORT, rect: RECT, paddingPx: 40, insets });

  expect(camera).not.toBeNull();

  const projected = screenPointToWorldPoint(camera as NonNullable<typeof camera>, VIEWPORT, {
    x: insets.left + (VIEWPORT.width - insets.left - insets.right) / 2,
    y: insets.top + (VIEWPORT.height - insets.top - insets.bottom) / 2,
  });

  expect(projected.x).toBeCloseTo(200, 6);
  expect(projected.y).toBeCloseTo(100, 6);
});

const atBearings = (...rects: readonly InfiniteCanvasRect[]) =>
  createInfiniteCanvasState<"note">({
    viewport: VIEWPORT,
    windows: rects.map((rect, index) =>
      createInfiniteCanvasWindow<"note">({ id: `w${String(index)}`, kind: "note", rect }),
    ),
  });

const FAR_WEST: InfiniteCanvasRect = { height: 100, width: 100, x: -4000, y: 0 };
const FURTHER_WEST: InfiniteCanvasRect = { height: 100, width: 100, x: -9000, y: 0 };
const FAR_EAST: InfiniteCanvasRect = { height: 100, width: 100, x: 4000, y: 0 };

test("getInfiniteCanvasOffscreenIndicators — folds targets that land on the same pixel", () => {
  const [indicator, ...rest] = getInfiniteCanvasOffscreenIndicators(
    atBearings(FAR_WEST, FURTHER_WEST),
  );

  expect(rest).toHaveLength(0);
  expect(indicator?.id).toBe("w0");
  expect(indicator?.targetCount).toBe(2);
});

test("getInfiniteCanvasOffscreenIndicators — leaves distinct bearings alone", () => {
  expect(
    getInfiniteCanvasOffscreenIndicators(atBearings(FAR_WEST, FAR_EAST)).map(
      (indicator) => indicator.targetCount,
    ),
  ).toEqual([1, 1]);
});

test("getInfiniteCanvasOffscreenIndicators — mergeWithinPx 0 restores one arrow per target", () => {
  expect(
    getInfiniteCanvasOffscreenIndicators(atBearings(FAR_WEST, FURTHER_WEST), {
      mergeWithinPx: 0,
    }),
  ).toHaveLength(2);
});
