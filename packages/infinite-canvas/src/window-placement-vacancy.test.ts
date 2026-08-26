import { expect, test } from "vite-plus/test";

import { getInfiniteCanvasVacantRect } from "./window-placement";
import type { InfiniteCanvasRect } from "./types";

/**
 * Placing a window where there is room.
 *
 * The behaviour a cascade cannot have: a cascade counts windows and offsets by the count, so it
 * never learns where anything is. Opening into a region the user has already filled overlaps no
 * matter how much canvas is free beside it, and a step that wraps piles the seventh window onto the
 * first. These assert the two properties that distinguish looking from counting — a clear preferred
 * spot is left exactly alone, and an occupied one moves to the *nearest* free spot rather than a
 * fixed offset.
 */

const BOUNDS: InfiniteCanvasRect = { height: 800, width: 1200, x: 0, y: 0 };
const SIZE = { height: 200, width: 300 };
const at = (x: number, y: number): InfiniteCanvasRect => ({ ...SIZE, x, y });

test("an empty region leaves the preferred rect exactly where policy put it", () => {
  // The consumer owns *where a window wants to be*; this must not second-guess it when it is free.
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
  /*
   * The property that makes this respect the policy that chose `preferred`. A scan that returned
   * the first clear cell in row order would land at the top-left corner of `bounds` — far from
   * where the consumer asked for — and still pass "overlaps nothing".
   */
  const preferred = at(600, 400);
  const placed = getInfiniteCanvasVacantRect({
    bounds: BOUNDS,
    occupied: [at(600, 400)],
    preferred,
  });
  const distance = Math.hypot(placed.x - preferred.x, placed.y - preferred.y);
  const corner = Math.hypot(BOUNDS.x - preferred.x, BOUNDS.y - preferred.y);

  expect(distance).toBeLessThan(corner);
  // One grid step away at most, since the ring is stepped by the rect's own size.
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

  // Whichever axis it moved along, it cleared the occupant by at least the gap.
  expect(Math.max(horizontalGap, verticalGap)).toBeGreaterThanOrEqual(24);
});

test("a region with exactly one spot returns it rather than placing the window out of view", () => {
  /*
   * Staying inside `bounds` is not negotiable: a window put somewhere out of view to avoid an
   * overlap is the "did it even open?" failure, which is worse than any overlap.
   */
  const tight: InfiniteCanvasRect = { height: 200, width: 300, x: 0, y: 0 };
  const preferred = at(0, 0);

  expect(getInfiniteCanvasVacantRect({ bounds: tight, occupied: [at(0, 0)], preferred })).toEqual(
    preferred,
  );
});

test("with nothing clear it takes the least-covered spot, not the preferred one", () => {
  /*
   * The refinement driving it produced. "No room" is not a reason to drop the window on whatever is
   * in the middle: at 123% zoom the visible region held six cells and the third opening landed with
   * 56% of itself behind an existing window while a corner sat half free.
   *
   * Here the preferred spot is buried under a large occupant and one cell is only clipped by a
   * sliver, so the sliver must win.
   */
  const bounds: InfiniteCanvasRect = { height: 500, width: 660, x: 0, y: 0 };
  const preferred = at(0, 0);
  // Covers the preferred cell completely and only clips the row beneath it.
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

  // Nothing here is clear, so the assertion is comparative rather than absolute: whatever it chose
  // has to be less buried than the spot policy asked for.
  expect(placed).not.toEqual(preferred);
  expect(covered(placed)).toBeLessThan(covered(preferred));
});

test("occupants outside the preferred spot do not push it around", () => {
  // Looking, not counting: a canvas with windows elsewhere must not move a placement that is clear.
  const preferred = at(600, 400);

  expect(
    getInfiniteCanvasVacantRect({
      bounds: BOUNDS,
      occupied: [at(0, 0), at(900, 0), at(0, 600)],
      preferred,
    }),
  ).toEqual(preferred);
});
