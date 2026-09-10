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

test("a sign is printed rather than rolled", () => {
  const cells = tickerCells("-42");

  expect(cells[0]).toMatchObject({ character: "-", digit: null });
  expect(cells.filter((cell) => cell.digit !== null).map((cell) => cell.digit)).toEqual([4, 2]);
});
