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

/**
 * Cutting to the strip before repeating rather than after. Repeating first built eight copies of
 * the order and kept a strip's worth, so a long one allocated eight times its length for nothing,
 * and past about sixty seven million characters the repeat is longer than a string may be.
 *
 * The two orders differ only where it cannot show: an order longer than the strip has its first
 * forty eight taken either way, and a shorter one is unchanged by the cut.
 */
test("cutting before repeating draws the same strip it drew after", () => {
  const after = (value: string) =>
    Array.from(value.trim().repeat(8).slice(0, 48), (character) =>
      character.codePointAt(0)! % 2 === 0 ? 3 : 1.5,
    );

  for (const order of [
    "A",
    "A1",
    "RES-2048",
    "ABCDEFGH",
    "x".repeat(47),
    "y".repeat(48),
    "z".repeat(500),
    " padded ",
    "",
  ]) {
    expect(barcodeBars(order)).toEqual(after(order));
  }
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
