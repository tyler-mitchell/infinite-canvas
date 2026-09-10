import { expect, test } from "vite-plus/test";

import { breakdownLabel, breakdownShares, type BreakdownPart } from "./breakdown.tsx";

const part = (name: string, share: number): BreakdownPart => ({ name, share, color: "#000" });
const widths = (parts: readonly BreakdownPart[]) =>
  breakdownShares(parts).map((share) => `${share * 100}%`);

test("shares are the fraction each part takes of the whole", () => {
  expect(breakdownShares([part("a", 1), part("b", 3)])).toEqual([0.25, 0.75]);
});

test("shares need not add up, because the total is whatever was given", () => {
  expect(breakdownShares([part("a", 84), part("b", 9), part("c", 7)])).toEqual([0.84, 0.09, 0.07]);
});

test("a share that is not a number counts as nothing, and does not spoil the rest", () => {
  const shares = breakdownShares([part("a", Number.NaN), part("b", 3), part("c", 1)]);

  expect(shares[0]).toBe(0);
  expect(shares[1]).toBe(0.75);
  expect(shares[2]).toBe(0.25);
});

test("a negative share counts as nothing rather than drawing backwards", () => {
  const shares = breakdownShares([part("a", -5), part("b", 10)]);

  expect(shares[0]).toBe(0);
  expect(shares[1]).toBe(1);
});

test("every width is a percentage a browser will accept", () => {
  const cases: readonly (readonly BreakdownPart[])[] = [
    [],
    [part("a", 0)],
    [part("a", 0), part("b", 0)],
    [part("a", Number.NaN)],
    [part("a", Number.POSITIVE_INFINITY), part("b", 1)],
    [part("a", -1), part("b", -2)],
  ];

  for (const parts of cases) {
    for (const width of widths(parts)) {
      expect(width).not.toContain("NaN");
      expect(width).not.toContain("Infinity");
      expect(width.startsWith("-")).toBe(false);
    }
  }
});

test("nothing to show draws nothing, rather than dividing by a zero total", () => {
  expect(breakdownShares([])).toEqual([]);
  expect(breakdownShares([part("a", 0), part("b", 0)])).toEqual([0, 0]);
});

test("the label reads the split, so hiding the legend costs a reader nothing", () => {
  expect(breakdownLabel([part("TypeScript", 84), part("WGSL", 9), part("CSS", 7)])).toBe(
    "TypeScript 84%, WGSL 9%, CSS 7%",
  );
});

test("the label says so when there is nothing to show, rather than reading empty", () => {
  expect(breakdownLabel([])).toBe("nothing to show");
});

test("the label never carries a NaN, an Infinity or a negative", () => {
  const cases: readonly (readonly BreakdownPart[])[] = [
    [part("a", Number.NaN)],
    [part("a", Number.POSITIVE_INFINITY), part("b", 1)],
    [part("a", -5), part("b", 10)],
    [part("a", 0), part("b", 0)],
  ];

  for (const parts of cases) {
    const label = breakdownLabel(parts);

    expect(label).not.toContain("NaN");
    expect(label).not.toContain("Infinity");
    expect(label).not.toContain("-");
    expect(label).not.toContain("undefined");
  }
});

test("a part that rounds away is still named, because the bar is all a reader has", () => {
  expect(breakdownLabel([part("a", 999), part("tiny", 1)])).toBe("a 100%, tiny 0%");
});

test("the legend never rounds to a negative percentage", () => {
  const rounded = breakdownShares([part("a", -5), part("b", 10)]).map((share) =>
    Math.round(share * 100),
  );

  expect(rounded).toEqual([0, 100]);
});
