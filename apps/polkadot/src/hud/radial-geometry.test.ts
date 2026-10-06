import { expect, test } from "vite-plus/test";

import { clampToViewport, getSpoke, ITEM_SIZE, RADIUS, WHEEL_SIZE } from "./radial-geometry";

const CENTRE = { x: 400, y: 300 };
const VIEWPORT = { height: 900, width: 1440 };

test("the first spoke is at twelve o'clock", () => {
  expect(getSpoke(0, 6)).toStrictEqual({ x: 0, y: -RADIUS });
});

test("six spokes are evenly spaced around the full circle", () => {
  const spokes = Array.from({ length: 6 }, (_unused, index) => getSpoke(index, 6));
  const angles = spokes.map((spoke) => Math.round((Math.atan2(spoke.y, spoke.x) * 180) / Math.PI));

  expect(angles).toStrictEqual([-90, -30, 30, 90, 150, -150]);
});

test("every spoke sits at the radius, whatever the count", () => {
  for (const count of [1, 2, 3, 4, 5, 6, 8, 12]) {
    for (let index = 0; index < count; index++) {
      const spoke = getSpoke(index, count);

      expect(Math.hypot(spoke.x, spoke.y)).toBeCloseTo(RADIUS, 0);
    }
  }
});

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

test("a viewport smaller than the wheel centres it rather than inverting", () => {
  const tiny = { height: 80, width: 100 };
  const inset = WHEEL_SIZE / 2 + 8;

  expect(clampToViewport({ x: 90, y: 70 }, tiny)).toStrictEqual({ x: inset, y: inset });
  expect(clampToViewport({ x: 0, y: 0 }, tiny)).toStrictEqual({ x: inset, y: inset });
});
