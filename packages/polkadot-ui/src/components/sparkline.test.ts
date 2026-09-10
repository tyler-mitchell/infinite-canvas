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
  for (const values of [[], [0], [0, 0], [-5, -5], [1e9, 1e9 + 1], [-3, 0, 3]]) {
    expect(finite(sparklinePoints(values))).toBe(true);
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
