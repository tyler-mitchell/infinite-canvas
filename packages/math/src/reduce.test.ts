import { describe, expect, test } from "vite-plus/test";
import { maxOf, minOf } from "./reduce";

describe("minOf and maxOf exist because the spread form has an argument limit", () => {
  test("survive a list long enough to make Math.max throw", () => {
    const long = Array.from({ length: 200_000 }, (_, index) => Math.sin(index) * 1000);
    expect(() => Math.max(...long)).toThrow();
    expect(maxOf(long)).toBe(long.reduce((best, value) => Math.max(best, value), -Infinity));
    expect(minOf(long)).toBe(long.reduce((best, value) => Math.min(best, value), Infinity));
  });

  test("agree with the spread form on a list short enough to use it", () => {
    const values = [3, -7, 0, 12.5, -0.5];
    expect(minOf(values)).toBe(Math.min(...values));
    expect(maxOf(values)).toBe(Math.max(...values));
  });

  test("return the identity for an empty list, which is CPU-only and out of f32 range", () => {
    expect(minOf([])).toBe(Number.POSITIVE_INFINITY);
    expect(maxOf([])).toBe(Number.NEGATIVE_INFINITY);
  });

  test("handle a single value and repeated values", () => {
    expect(minOf([42])).toBe(42);
    expect(maxOf([42])).toBe(42);
    expect(minOf([5, 5, 5])).toBe(5);
  });
});
