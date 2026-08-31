import { expect, test } from "vite-plus/test";

import { getSearchTerms, matchesSearchTerms } from "./text-search";

const matches = (haystack: string, query: string) =>
  matchesSearchTerms(haystack.toLowerCase(), getSearchTerms(query));

test("an empty query yields no terms, which every caller reads as matching everything", () => {
  expect(getSearchTerms("")).toStrictEqual([]);
  expect(getSearchTerms("   ")).toStrictEqual([]);
});

test("a second word narrows the list rather than widening it", () => {
  expect(matches("quarterly notes", "quarterly")).toBe(true);
  expect(matches("quarterly notes", "quarterly notes")).toBe(true);
  expect(matches("quarterly notes", "quarterly invoices")).toBe(false);
});

test("terms need not be adjacent or in the typed order", () => {
  expect(matches("quarterly notes for review", "review quarterly")).toBe(true);
  expect(matches("quarterly notes for review", "quarterly review")).toBe(true);
});

test("matching is by substring, not by subsequence", () => {
  expect(matches("nudge left", "undo")).toBe(false);
  expect(matches("dock up", "undo")).toBe(false);
  expect(matches("focus down", "undo")).toBe(false);
  expect(matches("undo", "undo")).toBe(true);
});

test("case and surrounding whitespace are not part of the query", () => {
  expect(matches("Quarterly Notes", "  QUARTERLY   notes  ")).toBe(true);
});
