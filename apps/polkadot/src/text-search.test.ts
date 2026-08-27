import { expect, test } from "vite-plus/test";

import { getSearchTerms, matchesSearchTerms } from "./text-search";

/**
 * One rule, because there are two search boxes and they are the same gesture.
 *
 * The palette and the library rail each had this written out: split on whitespace, lowercase,
 * require every term as a substring. Identical, in two files, with nothing holding them together —
 * so the first change to either would have made them disagree, discoverable only by typing the same
 * thing into both and noticing.
 */

const matches = (haystack: string, query: string) =>
  matchesSearchTerms(haystack.toLowerCase(), getSearchTerms(query));

test("an empty query yields no terms, which every caller reads as matching everything", () => {
  expect(getSearchTerms("")).toStrictEqual([]);
  expect(getSearchTerms("   ")).toStrictEqual([]);
});

test("a second word narrows the list rather than widening it", () => {
  // `every`, not `some`. This is the behaviour a search box is expected to have and the one it
  // would lose first if the rule were re-implemented from memory.
  expect(matches("quarterly notes", "quarterly")).toBe(true);
  expect(matches("quarterly notes", "quarterly notes")).toBe(true);
  expect(matches("quarterly notes", "quarterly invoices")).toBe(false);
});

test("terms need not be adjacent or in the typed order", () => {
  // What a bare `includes` of the raw query cannot do, and the reason the query is split at all.
  expect(matches("quarterly notes for review", "review quarterly")).toBe(true);
  expect(matches("quarterly notes for review", "quarterly review")).toBe(true);
});

test("matching is by substring, not by subsequence", () => {
  /*
   * The failure this rule exists to prevent, verbatim from the palette. `cmdk`'s default scorer
   * matches subsequences, so "undo" surfaced "Nudge Left", "Dock Up" and "Focus Down" — every label
   * containing u, n, d, o in that order.
   */
  expect(matches("nudge left", "undo")).toBe(false);
  expect(matches("dock up", "undo")).toBe(false);
  expect(matches("focus down", "undo")).toBe(false);
  expect(matches("undo", "undo")).toBe(true);
});

test("case and surrounding whitespace are not part of the query", () => {
  expect(matches("Quarterly Notes", "  QUARTERLY   notes  ")).toBe(true);
});
