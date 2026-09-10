import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vite-plus/test";

import {
  ActivityGrid,
  activityLevel,
  toColumns,
  weeksThatFit,
  type ActivityDay,
} from "./activity-grid.tsx";

const CELL = 11;
const GAP = 4;
const WANTED = 26;
const PITCH = CELL + GAP;

/** What the returned week count actually occupies: n cells with n-1 gaps between them. */
const widthUsed = (weeks: number) => weeks * CELL + (weeks - 1) * GAP;

/** A run of consecutive days ending on the given date, which is the shape the component is given. */
const daysEnding = (count: number, end: Date): ActivityDay[] =>
  Array.from({ length: count }, (_, index) => {
    const date = new Date(end);
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - (count - 1 - index));
    return { date, count: index % 5 };
  });

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

test("at every width from too-narrow to oversized, the weeks it reports fit", () => {
  const widths = Array.from({ length: WANTED * PITCH + 21 }, (_, index) => 40 + index);

  for (const width of widths) {
    const weeks = weeksThatFit(width, CELL, GAP, WANTED);
    expect(weeks).toBeLessThanOrEqual(WANTED);
    expect(Number.isInteger(weeks)).toBe(true);
    if (weeks > 6) expect(widthUsed(weeks)).toBeLessThanOrEqual(width);
  }
});

test("it stops at six weeks and overflows rather than shrinking cells", () => {
  for (const width of [1, 10, 40, 80, widthUsed(6)]) {
    expect(weeksThatFit(width, CELL, GAP, WANTED)).toBeGreaterThanOrEqual(6);
  }
  expect(weeksThatFit(20, CELL, GAP, WANTED)).toBe(6);
  expect(weeksThatFit(20, 40, GAP, WANTED)).toBe(6);
});

test("counting bounds cleared lands every count where the ternary ladder did", () => {
  const ladder = (n: number) => (n === 0 ? 0 : n < 3 ? 1 : n < 6 ? 2 : n < 10 ? 3 : 4);
  const counts = Array.from({ length: 41 }, (_, index) => index);

  for (const count of counts) {
    expect(activityLevel(count)).toBe(ladder(count));
  }
});

test("minutes read are every top level on the commit defaults, and a ladder on their own", () => {
  const minutes = [0, 12, 45, 90, 240];
  expect(minutes.map((n) => activityLevel(n))).toEqual([0, 4, 4, 4, 4]);
  expect(minutes.map((n) => activityLevel(n, [1, 30, 60, 120]))).toEqual([0, 1, 2, 3, 4]);
});

/**
 * A level is an index into a scale of five, so a sixth bound has no colour to land on. The prop
 * takes any number of bounds and says nothing about four, so a consumer reaches this by reading
 * the documented surface and believing it.
 */
test("more bounds than the scale has colours still lands on a colour", () => {
  const bounds = [1, 2, 3, 4, 5, 6];

  expect(bounds.map((n) => activityLevel(n, bounds))).toEqual([1, 2, 3, 4, 4, 4]);
});

test("no cell is drawn with a class that is not a class", () => {
  const markup = renderToStaticMarkup(
    createElement(ActivityGrid, {
      days: [1, 3, 5, 7, 9].map((count, index) => ({ date: new Date(2026, 8, index + 1), count })),
      thresholds: [1, 2, 3, 4, 5, 6],
    }),
  );

  expect(markup).toContain("bg-pk-level-4");
  expect(markup).not.toContain("undefined");
});

test("every day lands on the row of its own weekday", () => {
  for (const end of [new Date(2026, 8, 9), new Date(2026, 0, 1), new Date(2025, 11, 31)]) {
    const columns = toColumns(daysEnding(371, end), 26);

    /* Read first: a grid of nothing satisfies the loop below without checking a single day. */
    expect(columns.filter(Boolean).length).toBeGreaterThan(170);

    for (const [index, day] of columns.entries()) {
      if (day) expect(index % 7).toBe(day.date.getDay());
    }
  }
});

test("padding is added ahead of the first day, and the most recent day survives", () => {
  const days = daysEnding(371, new Date(2026, 8, 9));
  const columns = toColumns(days, 26);
  const kept = columns.filter((day) => day !== null);
  const leading = columns.findIndex((day) => day !== null);

  expect(kept).toHaveLength(26 * 7);
  expect(columns).toHaveLength(leading + 26 * 7);
  expect(leading).toBe(kept[0]?.date.getDay());
  expect(kept.at(-1)?.date.toDateString()).toBe(days.at(-1)?.date.toDateString());
});

test("asking for no weeks shows no days, rather than all of them", () => {
  const days = daysEnding(371, new Date(2026, 8, 9));

  expect(toColumns(days, 0)).toEqual([]);
  expect(toColumns(days, -4)).toEqual([]);
});

test("a fractional week count is floored, not truncated by a slice", () => {
  const days = daysEnding(371, new Date(2026, 8, 9));
  const kept = toColumns(days, 3.9).filter((day) => day !== null);

  expect(kept).toHaveLength(3 * 7);
});

test("asking for more weeks than there are days keeps every day", () => {
  const days = daysEnding(10, new Date(2026, 8, 9));
  const kept = toColumns(days, 26).filter((day) => day !== null);
  expect(kept).toHaveLength(10);
});
