import { expect, test } from "vite-plus/test";

import { getInfiniteCanvasContentWorldRect, getInfiniteCanvasOccluderWorldRects } from "./geometry";
import { getInfiniteCanvasVacantRect } from "./window-placement";
import type { InfiniteCanvasCamera, InfiniteCanvasViewport } from "./types";

/**
 * Chrome that sits inside the content area, in the shape an inset cannot describe.
 *
 * One number per edge is a *band*. A 140×80 map in the bottom-right corner has to be declared as a
 * 1440-wide strip across the bottom, or not at all — and the incubator wrote that trade down three
 * separate times before this existed, the last of them as a measurement: 168 of 900 pixels, 19% of
 * the viewport, written off to describe a map covering 1%.
 *
 * The split is by question, not by chrome. Framing reads insets alone, because a corner should not
 * shrink the rect the camera fills. Placement reads both, because "is this spot covered" is a
 * different question from "where should I aim".
 */

const camera: InfiniteCanvasCamera = { center: { x: 0, y: 0 }, zoom: 1 };
const viewport: InfiniteCanvasViewport = { height: 900, width: 1440 };

/** The incubator's minimap: a corner, not a band. */
const MINIMAP = { height: 80, width: 140, x: 1284, y: 804 };

test("a screen-space occluder lands where the camera is looking", () => {
  const [world] = getInfiniteCanvasOccluderWorldRects(camera, viewport, [MINIMAP]);

  // At zoom 1 with the camera at the origin, the viewport's centre is world (0, 0) — so the
  // bottom-right corner is (+720, +450) and the map's top-left sits 156 and 96 short of it.
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

/**
 * The measurement that justifies the whole thing, as arithmetic.
 *
 * Declaring the map as a band writes off every pixel of canvas across the viewport's full width;
 * declaring it as what it is writes off the map.
 */
test("the band overstates the corner by two orders of magnitude", () => {
  const asBand = viewport.width * MINIMAP.height;
  const asCorner = MINIMAP.width * MINIMAP.height;

  expect(asBand / asCorner).toBeCloseTo(10.3, 1);
});

test("framing ignores occluders, so a corner map does not shrink what the camera fills", () => {
  // The rule stated as a test: `getInfiniteCanvasContentWorldRect` takes insets and nothing else.
  // If a corner ever started shrinking the frame, fitting content would leave a margin as wide as
  // the map — the overstatement this replaced, reintroduced one layer down.
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
  // A window whose preferred spot is exactly where the map is drawn.
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
  // The control. Without it the test above passes for any reason at all, including a search that
  // never returns what it was given.
  const bounds = getInfiniteCanvasContentWorldRect(camera, viewport);
  const preferred = { height: 80, width: 140, x: 564, y: 354 };

  expect(getInfiniteCanvasVacantRect({ bounds, gapPx: 24, occupied: [], preferred })).toEqual(
    preferred,
  );
});
