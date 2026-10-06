import { expect, test } from "vite-plus/test";

import { getInfiniteCanvasContentWorldRect, getInfiniteCanvasOccluderWorldRects } from "./geometry";
import { getInfiniteCanvasVacantRect } from "./window-placement";
import type { InfiniteCanvasCamera, InfiniteCanvasViewport } from "./types";

const camera: InfiniteCanvasCamera = { center: { x: 0, y: 0 }, zoom: 1 };
const viewport: InfiniteCanvasViewport = { height: 900, width: 1440 };

const MINIMAP = { height: 80, width: 140, x: 1284, y: 804 };

test("a screen-space occluder lands where the camera is looking", () => {
  const [world] = getInfiniteCanvasOccluderWorldRects(camera, viewport, [MINIMAP]);

  expect(world).toEqual({ height: 80, width: 140, x: 564, y: 354 });
});

test("zooming out grows the world an occluder covers, because it holds its screen size", () => {
  const [near] = getInfiniteCanvasOccluderWorldRects(camera, viewport, [MINIMAP]);
  const [far] = getInfiniteCanvasOccluderWorldRects({ ...camera, zoom: 0.25 }, viewport, [MINIMAP]);

  expect(far?.width).toBe(560);
  expect(far!.width).toBeGreaterThan(near!.width);
});

test("no occluders is no work and no rects", () => {
  expect(getInfiniteCanvasOccluderWorldRects(camera, viewport, [])).toEqual([]);
});

test("a degenerate zoom yields a finite rect rather than an infinite one", () => {
  const [world] = getInfiniteCanvasOccluderWorldRects({ ...camera, zoom: 0 }, viewport, [MINIMAP]);

  expect(Number.isFinite(world?.width)).toBe(true);
  expect(Number.isFinite(world?.height)).toBe(true);
});

test("the band overstates the corner by two orders of magnitude", () => {
  const asBand = viewport.width * MINIMAP.height;
  const asCorner = MINIMAP.width * MINIMAP.height;

  expect(asBand / asCorner).toBeCloseTo(10.3, 1);
});

test("framing ignores occluders, so a corner map does not shrink what the camera fills", () => {
  const withoutChrome = getInfiniteCanvasContentWorldRect(camera, viewport);
  const withBand = getInfiniteCanvasContentWorldRect(camera, viewport, {
    bottom: 168,
    left: 0,
    right: 0,
    top: 0,
  });

  expect(withoutChrome.height).toBe(900);
  expect(withBand.height).toBe(732);
});

test("placement steps around an occluder handed to it as an occupant", () => {
  const bounds = getInfiniteCanvasContentWorldRect(camera, viewport);
  const occluders = getInfiniteCanvasOccluderWorldRects(camera, viewport, [MINIMAP]);
  const preferred = { height: 80, width: 140, x: 564, y: 354 };
  const placed = getInfiniteCanvasVacantRect({
    bounds,
    gapPx: 24,
    occupied: occluders,
    preferred,
  });

  expect(placed).not.toEqual(preferred);
});

test("with no occluders the same placement keeps the spot it asked for", () => {
  const bounds = getInfiniteCanvasContentWorldRect(camera, viewport);
  const preferred = { height: 80, width: 140, x: 564, y: 354 };

  expect(getInfiniteCanvasVacantRect({ bounds, gapPx: 24, occupied: [], preferred })).toEqual(
    preferred,
  );
});
