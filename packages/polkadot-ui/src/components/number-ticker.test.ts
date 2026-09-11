import { expect, test } from "vite-plus/test";

import { tickerCells, tickerText } from "./number-ticker.tsx";

const keys = (text: string) => tickerCells(text).map((cell) => cell.key);
const delays = (text: string) =>
  tickerCells(text)
    .filter((cell) => cell.digit !== null)
    .map((cell) => cell.delay);

test("a value prints its digits, and a negative keeps its sign", () => {
  expect(tickerText(4182)).toBe("4182");
  expect(tickerText(-42)).toBe("-42");
  expect(tickerText(7.9)).toBe("7");
});

test("padding is counted in digits, not in printed characters", () => {
  expect(tickerText(1000, 7)).toBe("0001000");
  expect(tickerText(1000, 7, true)).toBe("0,001,000");
  expect(tickerText(42, 4, true)).toBe("0,042");
});

/**
 * `padStart` throws a `RangeError` for a length it cannot build, and this one took the page with it:
 * the value, the roll and the stagger were each guarded against an endless reading and the width was
 * not. A large finite width threw just the same, so the guard clamps rather than only checking.
 */
test("a width the runtime could not build is clamped, not thrown", () => {
  for (const pad of [Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NaN, 1e9, -5]) {
    expect(() => tickerText(42, pad)).not.toThrow();
  }
  /* Endless and not-a-number mean no padding; a huge one means the most places allowed. */
  expect(tickerText(42, Number.POSITIVE_INFINITY)).toBe("42");
  expect(tickerText(42, Number.NaN)).toBe("42");
  expect(tickerText(42, -5)).toBe("42");
  expect(tickerText(42, 1e9)).toHaveLength(64);
});

test("a width a consumer could plausibly ask for is honoured exactly", () => {
  expect(tickerText(42, 5)).toBe("00042");
  /* The ceiling itself, so it is a clamp and not an off-by-one. */
  expect(tickerText(42, 64)).toHaveLength(64);
  expect(tickerText(42, 3.7)).toBe("042");
});

test("grouping puts a separator every three digits from the units place", () => {
  expect(tickerText(999, 0, true)).toBe("999");
  expect(tickerText(1000, 0, true)).toBe("1,000");
  expect(tickerText(1234567, 0, true)).toBe("1,234,567");
  expect(tickerText(-1234, 0, true)).toBe("-1,234");
});

test("a digit slot keeps its key when the number gains a place", () => {
  const before = keys("999");
  const after = keys("1000");

  expect(before).toEqual(["d2", "d1", "d0"]);
  expect(after.slice(1)).toEqual(before);
});

test("a separator appearing does not move any digit off its slot", () => {
  expect(keys("1,000")).toEqual(["d3", "s3,", "d2", "d1", "d0"]);
  expect(keys("999").every((key) => keys("1,000").includes(key))).toBe(true);
});

test("the units digit leads and each place to its left follows by one step", () => {
  expect(delays("4182")).toEqual([120, 80, 40, 0]);
});

test("a separator costs no step of the cascade", () => {
  expect(delays("1,000")).toEqual(delays("1000"));
  expect(delays("1,234,567")).toEqual([240, 200, 160, 120, 80, 40, 0]);
});

/**
 * A reading that is not a number has to leave the slots alone. Printed as it arrives, `NaN` and
 * `Infinity` are letters, and letters are not digits: they take the separator's key, which is its
 * place value and the character itself. Both words repeat a letter at the same place, so two cells
 * would claim one key and React would draw one of them.
 */
test("a reading that is not a number still prints digits", () => {
  expect(tickerText(Number.NaN)).toBe("0");
  expect(tickerText(Number.POSITIVE_INFINITY)).toBe("0");
  expect(tickerText(Number.NEGATIVE_INFINITY)).toBe("0");
  expect(tickerText(Number.NaN, 4, true)).toBe("0,000");
});

test("no two cells of a value claim the same key", () => {
  for (const text of ["4182", "1,234,567", "-1,234", tickerText(Number.NaN)]) {
    expect(new Set(keys(text)).size).toBe(keys(text).length);
  }
});

test("a sign is printed rather than rolled", () => {
  const cells = tickerCells("-42");

  expect(cells[0]).toMatchObject({ character: "-", digit: null });
  expect(cells.filter((cell) => cell.digit !== null).map((cell) => cell.digit)).toEqual([4, 2]);
});
