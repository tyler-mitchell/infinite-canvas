import { expect, test } from "vite-plus/test";
import { getAdjacentRect } from "./placement";

test("adjacent windows stack on the selected side", () => {
  const anchor = { x: 500, y: 80, width: 880, height: 2400 };
  const placement = {
    anchor,
    size: { width: 360, height: 480 },
    side: "left" as const,
    stack: true,
    gap: 24,
    bounds: { x: 0, y: 0, width: 1900, height: 1100 },
  };
  const first = getAdjacentRect({ ...placement, occupied: [anchor] });
  expect(first).toEqual({ x: 116, y: 80, width: 360, height: 480 });
  const second = getAdjacentRect({ ...placement, occupied: [anchor, first] });
  expect(second).toEqual({ x: 116, y: 584, width: 360, height: 480 });
  const third = getAdjacentRect({ ...placement, side: "right", occupied: [anchor, first, second] });
  expect(third).toEqual({ x: 1404, y: 80, width: 360, height: 480 });
  expect(getAdjacentRect({ ...placement, occupied: [anchor, second, third] })).toEqual(first);
});

test("adjacent placement uses the visible vertical area when the anchor starts above it", () => {
  const anchor = { x: 500, y: 80, width: 880, height: 2400 };
  expect(getAdjacentRect({
    anchor,
    size: { width: 360, height: 480 },
    side: "right",
    stack: true,
    gap: 24,
    bounds: { x: 0, y: 600, width: 1900, height: 800 },
    occupied: [anchor],
  })).toEqual({ x: 1404, y: 600, width: 360, height: 480 });
});
