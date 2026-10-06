import { expect, test } from "vite-plus/test";

import {
  getCameraNavigationFrame,
  getCameraNavigationTargetRect,
  isCameraNavigationAvailable,
  navigateCamera,
} from "./camera-navigation";
import { DEFAULT_INFINITE_CANVAS_ZOOM } from "./constants";
import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import type { InfiniteCanvasState } from "./types";

type Kind = "note";

const state = (): InfiniteCanvasState<Kind> => ({
  ...createInfiniteCanvasState<Kind>({
    camera: { center: { x: 0, y: 0 }, zoom: 0.5 },
    windows: [
      createInfiniteCanvasWindow<Kind>({
        id: "a",
        kind: "note",
        rect: { height: 200, width: 400, x: 1_000, y: 600 },
        title: "A",
      }),
      createInfiniteCanvasWindow<Kind>({
        id: "b",
        kind: "note",
        rect: { height: 200, width: 400, x: -800, y: -400 },
        title: "B",
      }),
    ],
  }),
  viewport: { height: 800, width: 1200 },
});

test("every target kind resolves to the rect it names", () => {
  const current = state();

  expect(getCameraNavigationTargetRect(current, { type: "window", windowId: "a" })).toEqual({
    height: 200,
    width: 400,
    x: 1_000,
    y: 600,
  });
  expect(
    getCameraNavigationTargetRect(current, {
      rect: { height: 10, width: 20, x: 1, y: 2 },
      type: "rect",
    }),
  ).toEqual({ height: 10, width: 20, x: 1, y: 2 });
  expect(getCameraNavigationTargetRect(current, { point: { x: 5, y: 7 }, type: "point" })).toEqual({
    height: 1,
    width: 1,
    x: 4.5,
    y: 6.5,
  });
  expect(getCameraNavigationTargetRect(current, { type: "visibleWindows" })).toEqual({
    height: 1_200,
    width: 2_200,
    x: -800,
    y: -400,
  });
});

test("an unknown window is not a navigable target", () => {
  const current = state();

  expect(getCameraNavigationTargetRect(current, { type: "window", windowId: "ghost" })).toBeNull();
  expect(
    isCameraNavigationAvailable(current, { target: { type: "window", windowId: "ghost" } }),
  ).toBe(false);
});

test("`center` moves the camera and leaves zoom exactly alone", () => {
  const current = state();
  const next = navigateCamera(current, {
    behavior: { type: "center" },
    target: { type: "window", windowId: "a" },
  });

  expect(next.camera.center).toEqual({ x: 1_200, y: 700 });
  expect(next.camera.zoom).toBe(current.camera.zoom);
});

test("`centerAtZoom` sets both, through the zoom policy", () => {
  const next = navigateCamera(state(), {
    behavior: { type: "centerAtZoom", zoom: 2 },
    target: { type: "window", windowId: "a" },
  });

  expect(next.camera.center).toEqual({ x: 1_200, y: 700 });
  expect(next.camera.zoom).toBe(2);

  const clamped = navigateCamera(state(), {
    behavior: { type: "centerAtZoom", zoom: 10_000 },
    target: { type: "window", windowId: "a" },
  });

  expect(clamped.camera.zoom).toBeLessThanOrEqual(DEFAULT_INFINITE_CANVAS_ZOOM.maxZoom);
});

test("`fit` frames the target inside the viewport and respects maxZoom", () => {
  const fitted = navigateCamera(state(), {
    behavior: { type: "fit" },
    target: { type: "visibleWindows" },
  });

  const halfWidth = 1_200 / 2 / fitted.camera.zoom;
  const halfHeight = 800 / 2 / fitted.camera.zoom;

  expect(fitted.camera.center.x - halfWidth).toBeLessThanOrEqual(-800);
  expect(fitted.camera.center.x + halfWidth).toBeGreaterThanOrEqual(1_400);
  expect(fitted.camera.center.y - halfHeight).toBeLessThanOrEqual(-400);
  expect(fitted.camera.center.y + halfHeight).toBeGreaterThanOrEqual(800);

  const capped = navigateCamera(state(), {
    behavior: { maxZoom: 1.25, type: "fit" },
    target: { point: { x: 0, y: 0 }, type: "point" },
  });

  expect(capped.camera.zoom).toBeLessThanOrEqual(1.25);
});

test("capped fit keeps the target centered between unequal viewport insets", () => {
  const current = {
    ...state(),
    viewportInsets: { left: 300, right: 100, top: 120, bottom: 40 },
  };
  const next = navigateCamera(current, {
    behavior: { type: "fit", maxZoom: 0.75 },
    target: { type: "window", windowId: "a" },
  });
  expect(next.camera.zoom).toBe(0.75);
  expect((1200 - next.camera.center.x) * next.camera.zoom + 600).toBeCloseTo(700);
  expect((700 - next.camera.center.y) * next.camera.zoom + 400).toBeCloseTo(440);
});

test("`fit` is unavailable without a measured viewport, and navigating is a no-op", () => {
  const unmeasured: InfiniteCanvasState<Kind> = {
    ...state(),
    viewport: { height: 0, width: 0 },
  };
  const request = {
    behavior: { type: "fit" } as const,
    target: { type: "visibleWindows" } as const,
  };

  expect(isCameraNavigationAvailable(unmeasured, request)).toBe(false);
  expect(
    isCameraNavigationAvailable(unmeasured, {
      behavior: { type: "center" },
      target: { type: "visibleWindows" },
    }),
  ).toBe(true);

  expect(navigateCamera(unmeasured, request).camera).toEqual(unmeasured.camera);
});

test("navigating to a target that does not exist leaves the camera untouched", () => {
  const current = state();
  const next = navigateCamera(current, { target: { type: "window", windowId: "ghost" } });

  expect(next.camera).toEqual(current.camera);
  expect(next).toBe(current);
});

test("an empty selection is not a target", () => {
  const empty: InfiniteCanvasState<Kind> = {
    ...state(),
    selection: { anchorTarget: null, targets: [] },
  };

  expect(getCameraNavigationTargetRect(empty, { type: "selection" })).toBeNull();
  expect(isCameraNavigationAvailable(empty, { target: { type: "selection" } })).toBe(false);
});

test("a request from outside TypeScript leaves the camera alone", () => {
  const current = state();
  // A caller through the store handle or a serialized command carries no compile-time check.
  const unknown = {
    behavior: { type: "instant" },
    target: { type: "rect", rect: current.windows[0]!.rect },
  } as unknown as Parameters<typeof navigateCamera<Kind>>[1];

  expect(
    getCameraNavigationFrame({
      state: current,
      rect: current.windows[0]!.rect,
      behavior: unknown.behavior,
    }),
  ).toBeNull();
  expect(navigateCamera(current, unknown)).toBe(current);
  expect(
    getCameraNavigationTargetRect(current, { type: "elsewhere" } as unknown as Parameters<
      typeof getCameraNavigationTargetRect<Kind>
    >[1]),
  ).toBeNull();
});

test("the frame helper is the pure half, usable without producing a state", () => {
  const current = state();
  const rect = getCameraNavigationTargetRect(current, { type: "window", windowId: "b" })!;
  const frame = getCameraNavigationFrame({ state: current, rect, behavior: { type: "center" } });
  const applied = navigateCamera(current, {
    behavior: { type: "center" },
    target: { type: "window", windowId: "b" },
  });

  expect(frame).toEqual(applied.camera);
});

test.each([
  ["horizontal", 1.5],
  ["vertical", 2],
  ["both", 1.5],
] as const)("%s framing uses the requested viewport coverage", (framingMode, zoom) => {
  const next = navigateCamera(state(), {
    target: { type: "window", windowId: "a" },
    behavior: { type: "fit", framingMode, framingSize: 0.5, paddingPx: 0 },
  });
  expect(next.camera.zoom).toBe(zoom);
});

test("composition places the target offset at the requested visible screen position", () => {
  const current = { ...state(), viewportInsets: { left: 200, right: 0, top: 0, bottom: 0 } };
  const next = navigateCamera(current, {
    target: { type: "point", point: { x: 1000, y: 200 } },
    behavior: { type: "centerAtZoom", zoom: 1 },
    composition: { screenPosition: { x: 0.25, y: 0.75 }, targetOffset: { x: 50, y: 20 } },
  });
  expect((1050 - next.camera.center.x) * next.camera.zoom + 600).toBeCloseTo(450);
  expect((220 - next.camera.center.y) * next.camera.zoom + 400).toBeCloseTo(600);
});
