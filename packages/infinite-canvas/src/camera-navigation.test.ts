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

/**
 * Camera navigation — the sixth module from the README-claims audit.
 *
 * README: "frame a window, the selection, all visible windows, a world point, or an arbitrary
 * rect, with `center`, `centerAtZoom`, or `fit` behavior." That is five targets times three
 * behaviours, and nothing asserted any cell of it.
 *
 * The behaviours differ in exactly one respect worth guarding — which parts of the camera they
 * are allowed to touch. `center` moves the camera and must leave zoom alone; `centerAtZoom` sets
 * both; `fit` derives both from the viewport. A regression that let `center` change zoom would
 * be invisible in a screenshot and infuriating in use.
 */

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
  // A point is a degenerate rect centred on it, so every behaviour can treat targets uniformly.
  expect(getCameraNavigationTargetRect(current, { point: { x: 5, y: 7 }, type: "point" })).toEqual({
    height: 1,
    width: 1,
    x: 4.5,
    y: 6.5,
  });
  // `visibleWindows` spans both.
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
  // The distinction that matters: navigating to a window must not silently rescale the canvas.
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

  // A zoom beyond the policy is constrained rather than accepted.
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

  // Both windows must fit: the visible half-extent at the fitted zoom covers the target bounds.
  const halfWidth = 1_200 / 2 / fitted.camera.zoom;
  const halfHeight = 800 / 2 / fitted.camera.zoom;

  expect(fitted.camera.center.x - halfWidth).toBeLessThanOrEqual(-800);
  expect(fitted.camera.center.x + halfWidth).toBeGreaterThanOrEqual(1_400);
  expect(fitted.camera.center.y - halfHeight).toBeLessThanOrEqual(-400);
  expect(fitted.camera.center.y + halfHeight).toBeGreaterThanOrEqual(800);

  // maxZoom is a ceiling on how far `fit` may zoom *in* for a small target.
  const capped = navigateCamera(state(), {
    behavior: { maxZoom: 1.25, type: "fit" },
    target: { point: { x: 0, y: 0 }, type: "point" },
  });

  expect(capped.camera.zoom).toBeLessThanOrEqual(1.25);
});

test("`fit` is unavailable without a measured viewport, and navigating is a no-op", () => {
  // A 0x0 viewport cannot frame anything; the guard exists so the camera is not sent to NaN.
  const unmeasured: InfiniteCanvasState<Kind> = {
    ...state(),
    viewport: { height: 0, width: 0 },
  };
  const request = {
    behavior: { type: "fit" } as const,
    target: { type: "visibleWindows" } as const,
  };

  expect(isCameraNavigationAvailable(unmeasured, request)).toBe(false);
  // `center` needs no viewport, so it stays available.
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
    selection: { anchorWindowId: null, windowIds: [] },
  };

  expect(getCameraNavigationTargetRect(empty, { type: "selection" })).toBeNull();
  expect(isCameraNavigationAvailable(empty, { target: { type: "selection" } })).toBe(false);
});

test("the frame helper is the pure half, usable without producing a state", () => {
  // `getCameraNavigationFrame` is exported so a consumer can preview or animate toward a camera
  // without committing one; it must agree with what `navigateCamera` would apply.
  const current = state();
  const rect = getCameraNavigationTargetRect(current, { type: "window", windowId: "b" })!;
  const frame = getCameraNavigationFrame(current, rect, { type: "center" });
  const applied = navigateCamera(current, {
    behavior: { type: "center" },
    target: { type: "window", windowId: "b" },
  });

  expect(frame).toEqual(applied.camera);
});
