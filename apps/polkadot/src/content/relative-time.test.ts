import { expect, test } from "vite-plus/test";

import { formatRelativeTime } from "./relative-time";

/**
 * Pinned to a fixed instant, which is the whole reason `now` is an argument.
 *
 * The wording is `Intl`'s and follows the locale, so these assert the unit that was chosen rather
 * than an exact sentence: picking the wrong unit is the failure this can have, and it is the one a
 * reader would notice.
 */

const NOW = Date.parse("2026-08-28T12:00:00.000Z");

test("the largest unit that still counts at least one is the one used", () => {
  expect(formatRelativeTime({ iso: "2026-08-25T12:00:00.000Z", now: NOW })).toContain("day");
  expect(formatRelativeTime({ iso: "2026-08-28T09:00:00.000Z", now: NOW })).toContain("hour");
  expect(formatRelativeTime({ iso: "2026-08-28T11:58:00.000Z", now: NOW })).toContain("minute");
});

test("a span shorter than a minute reads as now rather than as zero minutes", () => {
  expect(formatRelativeTime({ iso: "2026-08-28T11:59:40.000Z", now: NOW })).toBe("now");
});

test("three days ago counts three, so the number is not lost with the unit", () => {
  expect(formatRelativeTime({ iso: "2026-08-25T12:00:00.000Z", now: NOW })).toBe("3 days ago");
});

/** A row whose timestamp never arrived should render nothing, not `Invalid Date`. */
test("an unparseable instant formats to nothing", () => {
  expect(formatRelativeTime({ iso: "not a date", now: NOW })).toBe("");
});
