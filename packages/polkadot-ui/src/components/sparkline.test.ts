import { expect, test } from "vite-plus/test";

import { sparklineHead, sparklineLabel, sparklinePoints } from "./sparkline.tsx";

const WIDTH = 300;
const finite = (points: readonly (readonly [number, number])[]) =>
  points.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y));

test("an empty series draws nothing rather than an infinity", () => {
  expect(sparklinePoints([])).toEqual([]);
});

test("a single reading draws flat across the full width", () => {
  const points = sparklinePoints([42]);

  expect(points).toHaveLength(2);
  expect(points[0]![0]).toBe(0);
  expect(points[1]![0]).toBe(WIDTH);
  expect(points[0]![1]).toBe(points[1]![1]);
});

test("a flat series is drawn level, not divided by a zero span", () => {
  const points = sparklinePoints([7, 7, 7, 7]);

  expect(finite(points)).toBe(true);
  expect(new Set(points.map(([, y]) => y)).size).toBe(1);
});

test("the first point sits at the left edge and the last at the right", () => {
  const points = sparklinePoints([1, 5, 2, 9]);

  expect(points[0]![0]).toBe(0);
  expect(points.at(-1)![0]).toBe(WIDTH);
});

test("the highest reading is drawn above the lowest", () => {
  const [low, , high] = sparklinePoints([0, 5, 10]);

  expect(high![1]).toBeLessThan(low![1]);
});

test("every point is finite for series that would break naive arithmetic", () => {
  const drawn = [[], [0], [0, 0], [-5, -5], [1e9, 1e9 + 1], [-3, 0, 3]].map((values) =>
    sparklinePoints(values),
  );

  /* Read first: a plot of no points is finite the way an empty room is quiet. */
  expect(drawn.flat().length).toBeGreaterThan(9);

  for (const points of drawn) {
    expect(finite(points)).toBe(true);
  }
});

test("a series with no readings marks no head, because a head is a reading", () => {
  expect(sparklineHead([])).toBe("none");
  expect(sparklineHead([], "8.2ms")).toBe("none");
});

test("a caption takes the dot's place, and otherwise the dot stays", () => {
  expect(sparklineHead([1, 2])).toBe("dot");
  expect(sparklineHead([1, 2], "8.2ms")).toBe("badge");
});

test("the fallback name never says undefined", () => {
  expect(sparklineLabel([])).toBe("no readings");
  expect(sparklineLabel([12])).toBe("one reading, 12");
  expect(sparklineLabel([1, 2, 3])).toBe("3 readings, latest 3");
  expect(sparklineLabel([]).includes("undefined")).toBe(false);
});

/**
 * The same trade the bars make. A latest is worth naming because a dot or a badge marks it; a
 * trace drawn with no head marks nothing, and naming one there points at a reading the line runs
 * through like every other.
 */
test("a trace drawn with no head counts its readings and names none", () => {
  expect(sparklineLabel([1, 2, 3], "none")).toBe("3 readings");
  expect(sparklineLabel([1, 2, 3], "dot")).toBe("3 readings, latest 3");
  expect(sparklineLabel([1, 2, 3], "badge")).toBe("3 readings, latest 3");
  /* One reading is the whole series, marked or not. */
  expect(sparklineLabel([12], "none")).toBe("one reading, 12");
  expect(sparklineLabel([], "none")).toBe("no readings");
});

/**
 * The bars filter a reading that is not a number out of their ceiling and give it the floor; the
 * breakdown counts its share as nothing. This did neither, and the arithmetic spread the fault:
 * `NaN` in the extent makes the span `NaN`, which is falsy, so `|| 1` hid it and every other point
 * in the series came back `NaN`. One unusable reading took the whole trace with it.
 */
test("a reading that is not a number keeps its own place and no other", () => {
  const broken = sparklinePoints([1, Number.NaN, 3]);
  const whole = sparklinePoints([1, 3]);

  expect(finite(broken)).toBe(true);
  /* Read first: three readings draw three points, so the middle one is still in there. */
  expect(broken).toHaveLength(3);
  /* The readings around it are drawn where they would be without it. */
  expect(broken[0]![1]).toBe(whole[0]![1]);
  expect(broken[2]![1]).toBe(whole[1]![1]);
  /* And the unusable one sits at the low, which is where the bars put one. */
  expect(broken[1]![1]).toBe(broken[0]![1]);
});

test("a series of nothing but unusable readings is still drawn level", () => {
  const points = sparklinePoints([Number.NaN, Number.POSITIVE_INFINITY, Number.NaN]);

  expect(finite(points)).toBe(true);
  expect(new Set(points.map(([, y]) => y)).size).toBe(1);
});
