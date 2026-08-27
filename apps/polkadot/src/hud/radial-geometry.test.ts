import { expect, test } from "vite-plus/test";

import { clampToViewport, getSpoke, ITEM_SIZE, RADIUS, WHEEL_SIZE } from "./radial-geometry";

/**
 * The wheel's shape, checked as arithmetic because it cannot be checked as a picture.
 *
 * Opening the ring is driven by `requestAnimationFrame`, and rAF does not run in the verification
 * browser — measured, with all six items sitting at `0,0` on a menu whose buttons were present and
 * clickable. So a screenshot cannot confirm the ring ever fans out. These are the parts that hold
 * regardless of whether a frame is ever painted.
 */

const CENTRE = { x: 400, y: 300 };
const VIEWPORT = { height: 900, width: 1440 };

test("the first spoke is at twelve o'clock", () => {
  expect(getSpoke(0, 6)).toStrictEqual({ x: 0, y: -RADIUS });
});

test("six spokes are evenly spaced around the full circle", () => {
  const spokes = Array.from({ length: 6 }, (_unused, index) => getSpoke(index, 6));
  const angles = spokes.map((spoke) => Math.round((Math.atan2(spoke.y, spoke.x) * 180) / Math.PI));

  // -90 is twelve o'clock; each step is a sixth of a turn, wrapping past 180 into negatives.
  expect(angles).toStrictEqual([-90, -30, 30, 90, 150, -150]);
});

test("every spoke sits at the radius, whatever the count", () => {
  for (const count of [1, 2, 3, 4, 5, 6, 8, 12]) {
    for (let index = 0; index < count; index++) {
      const spoke = getSpoke(index, count);

      // Rounded to whole pixels, so the distance is the radius give or take that rounding.
      expect(Math.hypot(spoke.x, spoke.y)).toBeCloseTo(RADIUS, 0);
    }
  }
});

/**
 * The reason `WHEEL_SIZE` is not just `RADIUS * 2`.
 *
 * The goo is drawn into an SVG the size of the group, so a spoke whose own box escaped that group
 * would have its silhouette clipped — the first version of this menu sized the group to the press
 * point and the liquid did not appear at all.
 */
test("a spoke's whole box fits inside the wheel it is drawn into", () => {
  const half = WHEEL_SIZE / 2;

  for (let index = 0; index < 6; index++) {
    const spoke = getSpoke(index, 6);

    expect(Math.abs(spoke.x) + ITEM_SIZE / 2).toBeLessThanOrEqual(half);
    expect(Math.abs(spoke.y) + ITEM_SIZE / 2).toBeLessThanOrEqual(half);
  }
});

test("a press with room around it opens the wheel exactly where it was pressed", () => {
  expect(clampToViewport(CENTRE, VIEWPORT)).toStrictEqual(CENTRE);
});

/**
 * The defect this clamp was added for.
 *
 * Measured before the fix: a press 20px from the bottom-right of an 812×998 viewport put all six
 * spokes off-screen. This asserts the outcome rather than the arithmetic — every spoke's box inside
 * the viewport — so a future change to the inset is judged by whether the verbs are reachable.
 */
test("a press in any corner still puts all six spokes on screen", () => {
  const viewport = { height: 998, width: 812 };
  const corners = [
    { x: 2, y: 2 },
    { x: viewport.width - 20, y: viewport.height - 20 },
    { x: 2, y: viewport.height - 2 },
    { x: viewport.width - 2, y: 2 },
  ];
  const offscreen = corners.flatMap((corner) => {
    const centre = clampToViewport(corner, viewport);

    return Array.from({ length: 6 }, (_unused, index) => getSpoke(index, 6))
      .map((spoke) => ({
        left: centre.x + spoke.x - ITEM_SIZE / 2,
        top: centre.y + spoke.y - ITEM_SIZE / 2,
      }))
      .filter(
        (box) =>
          box.left < 0 ||
          box.top < 0 ||
          box.left + ITEM_SIZE > viewport.width ||
          box.top + ITEM_SIZE > viewport.height,
      )
      .map((box) => `${JSON.stringify(corner)} → ${JSON.stringify(box)}`);
  });

  expect(offscreen).toStrictEqual([]);
});

/**
 * A viewport narrower than the wheel has no position that satisfies both bounds, and the clamp must
 * still answer. Without the inner `max` the bounds cross and the lower one wins, which would place
 * the wheel further outside than the press already was.
 */
test("a viewport smaller than the wheel centres it rather than inverting", () => {
  const tiny = { height: 80, width: 100 };
  const inset = WHEEL_SIZE / 2 + 8;

  expect(clampToViewport({ x: 90, y: 70 }, tiny)).toStrictEqual({ x: inset, y: inset });
  expect(clampToViewport({ x: 0, y: 0 }, tiny)).toStrictEqual({ x: inset, y: inset });
});
