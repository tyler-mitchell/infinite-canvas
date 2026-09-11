import { expect, test } from "vite-plus/test";

import { barcodeBars } from "./receipt.tsx";

const WIDE = 3;
const HAIRLINE = 1.5;

test("an order fills the strip, whatever its length", () => {
  expect(barcodeBars("A1")).toHaveLength(16);
  expect(barcodeBars("ABCDEF")).toHaveLength(48);
  /* Long enough to be cut rather than repeated: the strip is a fixed count, not a multiple. */
  expect(barcodeBars("A".repeat(200))).toHaveLength(48);
});

test("a character's parity picks its width", () => {
  /* "B" is 66 and "A" is 65, so the pair is one of each and the code is not a single width. */
  expect(barcodeBars("AB").slice(0, 2)).toEqual([HAIRLINE, WIDE]);
});

/**
 * The bars and the label have to agree. Untrimmed, an order of spaces drew a full strip of equal
 * bars while the label beside it said "no order" — the eye and the ear told different stories.
 */
test("an order of nothing, or of nothing but spaces, prints nothing", () => {
  expect(barcodeBars("")).toEqual([]);
  expect(barcodeBars("   ")).toEqual([]);
  expect(barcodeBars("\t\n ")).toEqual([]);
});

/** The prop says the same order always prints the same code; untrimmed these two disagreed. */
test("the same order prints the same code however it was typed", () => {
  expect(barcodeBars(" A1 ")).toEqual(barcodeBars("A1"));
  expect(barcodeBars("\tA1\n")).toEqual(barcodeBars("A1"));
});
