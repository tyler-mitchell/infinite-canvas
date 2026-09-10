import { expect, test } from "vite-plus/test";

import { barCeiling, barShare } from "./bars.tsx";

const MIN = 0.08;
const heightOf = (value: number, ceiling: number) =>
  `${(barShare(value, ceiling, MIN) * 100).toFixed(1)}%`;

test("the ceiling is the largest value when none is given", () => {
  expect(barCeiling([3, 9, 4])).toBe(9);
});

test("an explicit ceiling is used, so two charts can share one", () => {
  expect(barCeiling([3, 9, 4], 20)).toBe(20);
  expect(barCeiling([1], 20)).toBe(20);
});

test("a ceiling of zero or less is refused, because dividing by it has no meaning", () => {
  expect(barCeiling([3, 9], 0)).toBe(9);
  expect(barCeiling([3, 9], -5)).toBe(9);
  expect(barCeiling([3, 9], Number.NaN)).toBe(9);
});

test("the ceiling is never zero, even with nothing to draw", () => {
  expect(barCeiling([])).toBe(1);
  expect(barCeiling([0, 0, 0])).toBe(1);
  expect(barCeiling([Number.NaN, Number.NaN])).toBe(1);
});

test("a bar is a share of the ceiling", () => {
  expect(barShare(5, 10, MIN)).toBe(0.5);
  expect(barShare(10, 10, MIN)).toBe(1);
});

test("an empty bucket is still a mark, and an overflowing one is capped", () => {
  expect(barShare(0, 10, MIN)).toBe(MIN);
  expect(barShare(-4, 10, MIN)).toBe(MIN);
  expect(barShare(40, 10, MIN)).toBe(1);
});

test("no input produces a height of NaN", () => {
  const ceiling = barCeiling([0, 0], 0);

  expect(heightOf(0, ceiling)).toBe("8.0%");
  expect(heightOf(Number.NaN, ceiling)).toBe("8.0%");
  expect(heightOf(Number.POSITIVE_INFINITY, ceiling)).toBe("8.0%");
});

test("every height is a finite percentage across inputs that break naive division", () => {
  const cases: readonly (readonly [readonly number[], number | undefined])[] = [
    [[], undefined],
    [[0], 0],
    [[0, 0], 0],
    [[Number.NaN, 1], undefined],
    [[1, 2], -1],
    [[Number.POSITIVE_INFINITY], undefined],
  ];

  for (const [values, max] of cases) {
    const ceiling = barCeiling(values, max);
    expect(Number.isFinite(ceiling)).toBe(true);

    for (const value of values) {
      const share = barShare(value, ceiling, MIN);
      expect(Number.isFinite(share)).toBe(true);
      expect(share).toBeGreaterThanOrEqual(0);
      expect(share).toBeLessThanOrEqual(1);
    }
  }
});

test("a floor outside zero to one is brought back into range", () => {
  expect(barShare(0, 10, 5)).toBe(1);
  expect(barShare(0, 10, -1)).toBe(0);
  expect(barShare(0, 10, Number.NaN)).toBe(0);
});
