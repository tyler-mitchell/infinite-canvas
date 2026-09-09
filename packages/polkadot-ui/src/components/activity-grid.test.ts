import { expect, test } from "vite-plus/test";

import { toColumns, weeksThatFit, type ActivityDay } from "./activity-grid.tsx";

/*
 * These pin the sizing rule itself. The component reaches it through a ResizeObserver, which needs
 * a laid-out document; the rule is a pure function of width and needs nothing.
 */

const CELL = 11;
const GAP = 4;
const WANTED = 26;
const PITCH = CELL + GAP;

/** What the returned week count actually occupies: n cells with n-1 gaps between them. */
const widthUsed = (weeks: number) => weeks * CELL + (weeks - 1) * GAP;

test("a full-width plot shows every week asked for", () => {
  expect(weeksThatFit(widthUsed(WANTED), CELL, GAP, WANTED)).toBe(WANTED);
  expect(weeksThatFit(4000, CELL, GAP, WANTED)).toBe(WANTED);
});

test("before the first measurement it shows every week, not six", () => {
  expect(weeksThatFit(0, CELL, GAP, WANTED)).toBe(WANTED);
  expect(weeksThatFit(-1, CELL, GAP, WANTED)).toBe(WANTED);
});

test("a narrower plot drops weeks", () => {
  const wide = weeksThatFit(WANTED * PITCH, CELL, GAP, WANTED);
  const narrow = weeksThatFit(12 * PITCH, CELL, GAP, WANTED);
  expect(narrow).toBeLessThan(wide);
  expect(narrow).toBe(12);
});

test("the weeks it reports always fit the width it was given", () => {
  // Every width from too-narrow to wider than asked for, so no case is cherry-picked.
  for (let width = 40; width <= WANTED * PITCH + 60; width += 1) {
    const weeks = weeksThatFit(width, CELL, GAP, WANTED);
    expect(weeks).toBeLessThanOrEqual(WANTED);
    expect(Number.isInteger(weeks)).toBe(true);
    // Six is a floor it is allowed to overflow; above that it must genuinely fit.
    if (weeks > 6) expect(widthUsed(weeks)).toBeLessThanOrEqual(width);
  }
});

test("it stops at six weeks rather than shrinking cells", () => {
  // The cell size is an input and never a result, so a plot too narrow for six weeks overflows.
  for (const width of [1, 10, 40, 80, widthUsed(6)]) {
    expect(weeksThatFit(width, CELL, GAP, WANTED)).toBeGreaterThanOrEqual(6);
  }
  expect(weeksThatFit(20, CELL, GAP, WANTED)).toBe(6);
  expect(weeksThatFit(20, 40, GAP, WANTED)).toBe(6);
});

/** A run of consecutive days ending today, which is the shape the component is given. */
const daysEnding = (count: number, end: Date): ActivityDay[] =>
  Array.from({ length: count }, (_, i) => {
    const date = new Date(end);
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - (count - 1 - i));
    return { date, count: i % 5 };
  });

test("every day lands on its own weekday row", () => {
  // Rows are weekdays, so an entry's position modulo seven has to be its own getDay().
  for (const end of [new Date(2026, 8, 9), new Date(2026, 0, 1), new Date(2025, 11, 31)]) {
    const columns = toColumns(daysEnding(371, end), 26);
    for (const [index, day] of columns.entries()) {
      if (day) expect(index % 7).toBe(day.date.getDay());
    }
  }
});

test("padding is added ahead of the first day, and no day is dropped", () => {
  const days = daysEnding(371, new Date(2026, 8, 9));
  const columns = toColumns(days, 26);
  const kept = columns.filter((day) => day !== null);
  const leading = columns.findIndex((day) => day !== null);

  expect(kept).toHaveLength(26 * 7);
  expect(columns).toHaveLength(leading + 26 * 7);
  expect(leading).toBe(kept[0]?.date.getDay());
  // The trailing day survives: it is the one the readout reports as most recent.
  expect(kept.at(-1)?.date.toDateString()).toBe(days.at(-1)?.date.toDateString());
});

test("asking for more weeks than there are days keeps every day", () => {
  const days = daysEnding(10, new Date(2026, 8, 9));
  const kept = toColumns(days, 26).filter((day) => day !== null);
  expect(kept).toHaveLength(10);
});
