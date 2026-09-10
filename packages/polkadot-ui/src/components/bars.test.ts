import { expect, test } from "vite-plus/test";

import { barCeiling, barsLabel, barShare } from "./bars.tsx";

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

test("a real value keeps its own height, however far under the ceiling it sits", () => {
  /* The eight weekly figures of the smaller package, under the ceiling of the larger. */
  const shares = [210, 260, 180, 340, 300, 420, 380, 510].map((value) =>
    Number((barShare(value, 4182, MIN) * 100).toFixed(1)),
  );

  expect(shares).toEqual([5, 6.2, 4.3, 8.1, 7.2, 10, 9.1, 12.2]);
  /* Four of them used to meet the floor and draw alike while differing by two thirds. */
  expect(new Set(shares).size).toBe(8);
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

test("an unnamed chart still says what it holds, in the sparkline's words", () => {
  expect(barsLabel([1420, 1880, 4182])).toBe("3 readings, latest 4182");
  expect(barsLabel([42])).toBe("one reading, 42");
  expect(barsLabel([])).toBe("no readings");
});

/**
 * The name says `latest` because a bar is painted to mark it. A level meter marks none, and a name
 * that still pointed at the last reading would tell a reader the plot distinguishes a value it
 * draws exactly like the other fifteen.
 */
test("a chart that marks no bar counts its readings and names none", () => {
  expect(barsLabel([1420, 1880, 4182], "none")).toBe("3 readings");
  expect(barsLabel([1420, 1880, 4182], "last")).toBe("3 readings, latest 4182");
  /* One reading is the whole series, marked or not, so it is still worth saying. */
  expect(barsLabel([42], "none")).toBe("one reading, 42");
  expect(barsLabel([], "none")).toBe("no readings");
});

test("the label never reads undefined, however odd the series", () => {
  const cases: readonly (readonly number[])[] = [
    [],
    [Number.NaN],
    [Number.POSITIVE_INFINITY, 1],
    [0, 0],
    [-5, 10],
  ];

  for (const values of cases) {
    expect(barsLabel(values)).not.toContain("undefined");
  }
});
