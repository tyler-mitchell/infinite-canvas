import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vite-plus/test";

import {
  ActivityGrid,
  activityLevel,
  cursorAfter,
  toColumns,
  weeksThatFit,
  type ActivityDay,
} from "./activity-grid.tsx";

const CELL = 11;
const GAP = 4;
const WANTED = 26;
const PITCH = CELL + GAP;
const DAYS = 7;

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
 * A scale of no bounds is not a scale. Filtering against it put every day on the lowest level, so
 * the plot drew as though nothing had happened while its summary still announced the real total.
 * The same disagreement between the drawing and the label the receipt's barcode had.
 */
test("a scale with no bounds in it falls back to the defaults", () => {
  const counts = [0, 2, 5, 8, 40];

  expect(counts.map((n) => activityLevel(n, []))).toEqual(counts.map((n) => activityLevel(n)));
  /* Not merely non-zero: the fallback is the documented scale, one level per bound. */
  expect(counts.map((n) => activityLevel(n, []))).toEqual([0, 1, 2, 3, 4]);
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

/**
 * A series long enough to fill the window opens on a Sunday, so it needs no pad at all. The pad is
 * what a short series gets, and it costs a column, which is why the window is counted back from
 * the last day rather than taken as whole weeks.
 */
test("a full series opens on a Sunday and the most recent day survives", () => {
  const days = daysEnding(371, new Date(2026, 8, 9));
  const columns = toColumns(days, 26);
  const kept = columns.filter((day) => day !== null);

  expect(kept[0]?.date.getDay()).toBe(0);
  expect(columns).toHaveLength(kept.length);
  expect(columns.length).toBeLessThanOrEqual(26 * DAYS);
  expect(columns.length).toBeGreaterThan(25 * DAYS);
  expect(kept.at(-1)?.date.toDateString()).toBe(days.at(-1)?.date.toDateString());
});

test("a series too short to fill the window is padded to its own weekday row", () => {
  const days = daysEnding(10, new Date(2026, 8, 9));
  const columns = toColumns(days, 26);
  const kept = columns.filter((day) => day !== null);

  expect(kept).toHaveLength(10);
  expect(columns.findIndex((day) => day !== null)).toBe(kept[0]?.date.getDay());
  for (const [index, day] of columns.entries()) {
    if (day) expect(index % DAYS).toBe(day.date.getDay());
  }
});

/**
 * The defect this pins was a seam rather than a function. `weeksThatFit` measured room for n whole
 * weeks and `toColumns` then padded the front, which asks for an n+1th column. Each was right on
 * its own. Measured at 320: the plot box was 204 and the grid drew 217 across, so the last cells
 * sat outside the card.
 */
test("the plot never draws a column more than it was measured room for", () => {
  for (let offset = 0; offset < DAYS; offset++) {
    const days = daysEnding(371, new Date(2026, 8, 9 - offset));

    for (let weeks = 1; weeks <= WANTED; weeks++) {
      expect(toColumns(days, weeks).length).toBeLessThanOrEqual(weeks * DAYS);
    }
  }
});

test("what the plot draws fits the width the week count was worked out from", () => {
  const days = daysEnding(371, new Date(2026, 8, 9));

  for (let width = 40; width <= WANTED * PITCH + 20; width += 3) {
    const weeks = weeksThatFit(width, CELL, GAP, WANTED);
    const drawn = Math.ceil(toColumns(days, weeks).length / DAYS);

    expect(drawn).toBeLessThanOrEqual(weeks);
    if (weeks > 6) expect(widthUsed(drawn)).toBeLessThanOrEqual(width);
  }
});

test("asking for no weeks shows no days, rather than all of them", () => {
  const days = daysEnding(371, new Date(2026, 8, 9));

  expect(toColumns(days, 0)).toEqual([]);
  expect(toColumns(days, -4)).toEqual([]);
});

test("a fractional week count is floored, not truncated by a slice", () => {
  const days = daysEnding(371, new Date(2026, 8, 9));

  expect(toColumns(days, 3.9)).toEqual(toColumns(days, 3));
  expect(Math.ceil(toColumns(days, 3.9).length / DAYS)).toBe(3);
});

test("asking for more weeks than there are days keeps every day", () => {
  const days = daysEnding(10, new Date(2026, 8, 9));
  const kept = toColumns(days, 26).filter((day) => day !== null);
  expect(kept).toHaveLength(10);
});

/**
 * The arrows were the one part of this component nothing read. They live in a handler, and a
 * handler needs a mounted component and an event, which this suite cannot make — so the step is a
 * function now and the handler calls it, the way every other reading in this kit is written.
 *
 * The floor is the part worth having: the first column of a short series is padding, and a cursor
 * resting there names no day. It was walking onto that padding until it was given a floor.
 */
test("an arrow lands on a day, and never on the padding before the first one", () => {
  /* Twenty-eight cells, the first three of them pad, so the days run from three to twenty-seven. */
  const [firstDay, cells] = [3, 28];

  /* Nothing reached yet starts at the last day, so the first left arrow is a week back from it. */
  expect(cursorAfter(undefined, -7, firstDay, cells)).toBe(20);
  expect(cursorAfter(10, 1, firstDay, cells)).toBe(11);
  expect(cursorAfter(10, -7, firstDay, cells)).toBe(3);
  /* Both ends: onto the pad, and past the last day. */
  expect(cursorAfter(4, -7, firstDay, cells)).toBe(firstDay);
  expect(cursorAfter(firstDay, -1, firstDay, cells)).toBe(firstDay);
  expect(cursorAfter(27, 7, firstDay, cells)).toBe(27);
  expect(cursorAfter(27, 1, firstDay, cells)).toBe(27);
});
