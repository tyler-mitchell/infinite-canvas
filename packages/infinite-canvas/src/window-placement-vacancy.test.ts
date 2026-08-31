import { expect, test } from "vite-plus/test";

import { getInfiniteCanvasVacantRect } from "./window-placement";
import type { InfiniteCanvasRect } from "./types";

const BOUNDS: InfiniteCanvasRect = { height: 800, width: 1200, x: 0, y: 0 };
const SIZE = { height: 200, width: 300 };
const at = (x: number, y: number): InfiniteCanvasRect => ({ ...SIZE, x, y });

test("an empty region leaves the preferred rect exactly where policy put it", () => {
  const preferred = at(450, 300);

  expect(getInfiniteCanvasVacantRect({ bounds: BOUNDS, occupied: [], preferred })).toEqual(
    preferred,
  );
});

test("an occupied preferred spot moves, and the result overlaps nothing", () => {
  const preferred = at(450, 300);
  const occupied = [at(450, 300)];
  const placed = getInfiniteCanvasVacantRect({ bounds: BOUNDS, occupied, preferred });

  expect(placed).not.toEqual(preferred);

  for (const taken of occupied) {
    const clears =
      placed.x + placed.width <= taken.x ||
      taken.x + taken.width <= placed.x ||
      placed.y + placed.height <= taken.y ||
      taken.y + taken.height <= placed.y;

    expect(clears).toBe(true);
  }
});

test("it takes the nearest free spot, not the first one it happens to try", () => {
  const preferred = at(600, 400);
  const placed = getInfiniteCanvasVacantRect({
    bounds: BOUNDS,
    occupied: [at(600, 400)],
    preferred,
  });
  const distance = Math.hypot(placed.x - preferred.x, placed.y - preferred.y);
  const corner = Math.hypot(BOUNDS.x - preferred.x, BOUNDS.y - preferred.y);

  expect(distance).toBeLessThan(corner);
  expect(distance).toBeLessThanOrEqual(Math.hypot(SIZE.width, SIZE.height) + 0.001);
});

test("a gap is honoured, so windows do not land edge to edge", () => {
  const preferred = at(0, 0);
  const placed = getInfiniteCanvasVacantRect({
    bounds: BOUNDS,
    gapPx: 24,
    occupied: [at(0, 0)],
    preferred,
  });
  const horizontalGap = Math.abs(placed.x - preferred.x) - SIZE.width;
  const verticalGap = Math.abs(placed.y - preferred.y) - SIZE.height;

  expect(Math.max(horizontalGap, verticalGap)).toBeGreaterThanOrEqual(24);
});

test("a region with exactly one spot returns it rather than placing the window out of view", () => {
  const tight: InfiniteCanvasRect = { height: 200, width: 300, x: 0, y: 0 };
  const preferred = at(0, 0);

  expect(getInfiniteCanvasVacantRect({ bounds: tight, occupied: [at(0, 0)], preferred })).toEqual(
    preferred,
  );
});

test("with nothing clear it takes the least-covered spot, not the preferred one", () => {
  const bounds: InfiniteCanvasRect = { height: 500, width: 660, x: 0, y: 0 };
  const preferred = at(0, 0);
  const occupied = [{ height: 260, width: 660, x: 0, y: 0 }];
  const placed = getInfiniteCanvasVacantRect({ bounds, occupied, preferred });
  const covered = (rect: InfiniteCanvasRect) =>
    occupied.reduce((total, taken) => {
      const width =
        Math.min(rect.x + rect.width, taken.x + taken.width) - Math.max(rect.x, taken.x);
      const height =
        Math.min(rect.y + rect.height, taken.y + taken.height) - Math.max(rect.y, taken.y);

      return total + (width > 0 && height > 0 ? width * height : 0);
    }, 0);

  expect(placed).not.toEqual(preferred);
  expect(covered(placed)).toBeLessThan(covered(preferred));
});

test("a preferred spot outside the bounds is pulled inside them", () => {
  const placed = getInfiniteCanvasVacantRect({
    bounds: BOUNDS,
    occupied: [],
    preferred: at(4000, 3000),
  });

  expect(placed.x + placed.width).toBeLessThanOrEqual(BOUNDS.x + BOUNDS.width);
  expect(placed.y + placed.height).toBeLessThanOrEqual(BOUNDS.y + BOUNDS.height);
  expect(placed.x).toBeGreaterThanOrEqual(BOUNDS.x);
  expect(placed.y).toBeGreaterThanOrEqual(BOUNDS.y);
});

test("a preferred spot hanging over one edge is pulled back by exactly the overhang", () => {
  const placed = getInfiniteCanvasVacantRect({
    bounds: BOUNDS,
    occupied: [],
    preferred: at(BOUNDS.width - SIZE.width + 100, 300),
  });

  expect(placed).toEqual(at(BOUNDS.width - SIZE.width, 300));
});

test("a rect larger than the bounds keeps its origin in view rather than centring", () => {
  const placed = getInfiniteCanvasVacantRect({
    bounds: { height: 100, width: 200, x: 50, y: 60 },
    occupied: [],
    preferred: at(4000, 3000),
  });

  expect(placed).toEqual({ ...SIZE, x: 50, y: 60 });
});

test("occupants outside the preferred spot do not push it around", () => {
  const preferred = at(600, 400);

  expect(
    getInfiniteCanvasVacantRect({
      bounds: BOUNDS,
      occupied: [at(0, 0), at(900, 0), at(0, 600)],
      preferred,
    }),
  ).toEqual(preferred);
});
