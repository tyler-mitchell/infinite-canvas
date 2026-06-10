import { expect, test } from "vite-plus/test";

import { DEFAULT_INFINITE_CANVAS_HUD_POLICY, resolveInfiniteCanvasHudPolicy } from "./canvas-hud";

test("hud policy defaults every region on", () => {
  expect(resolveInfiniteCanvasHudPolicy()).toBe(DEFAULT_INFINITE_CANVAS_HUD_POLICY);
  expect(DEFAULT_INFINITE_CANVAS_HUD_POLICY).toEqual({
    cameraControls: true,
    minimizedDock: true,
    pointerModeControls: true,
    statusCard: true,
    zoomControls: true,
  });
});

test("hud policy booleans toggle every region at once", () => {
  expect(resolveInfiniteCanvasHudPolicy(true)).toEqual(DEFAULT_INFINITE_CANVAS_HUD_POLICY);
  expect(resolveInfiniteCanvasHudPolicy(false)).toEqual({
    cameraControls: false,
    minimizedDock: false,
    pointerModeControls: false,
    statusCard: false,
    zoomControls: false,
  });
});

test("hud policy objects override only the provided regions", () => {
  expect(resolveInfiniteCanvasHudPolicy({})).toEqual(DEFAULT_INFINITE_CANVAS_HUD_POLICY);
  expect(
    resolveInfiniteCanvasHudPolicy({
      pointerModeControls: false,
      statusCard: false,
    }),
  ).toEqual({
    cameraControls: true,
    minimizedDock: true,
    pointerModeControls: false,
    statusCard: false,
    zoomControls: true,
  });
});

test("hud policy resolution never mutates the shared default", () => {
  resolveInfiniteCanvasHudPolicy({ cameraControls: false });

  expect(DEFAULT_INFINITE_CANVAS_HUD_POLICY.cameraControls).toBe(true);
});
