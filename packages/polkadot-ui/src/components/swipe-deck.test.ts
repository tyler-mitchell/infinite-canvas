import { expect, test } from "vite-plus/test";

import { settledAs, stampOpacity, swipeOutcome } from "./swipe-deck.tsx";

const COMMIT = 90;

test("a card released short of the commit distance returns to its rest", () => {
  for (const offset of [0, 1, -1, 45, -45, COMMIT - 1, -(COMMIT - 1)]) {
    expect(swipeOutcome(offset)).toBe("return");
  }
});

test("the commit distance itself commits, in either direction", () => {
  expect(swipeOutcome(COMMIT)).toBe("pin");
  expect(swipeOutcome(-COMMIT)).toBe("skip");
});

test("right pins and left skips, however far past the distance", () => {
  expect(swipeOutcome(400)).toBe("pin");
  expect(swipeOutcome(-400)).toBe("skip");
});

test("a deck with its own commit distance decides by that distance", () => {
  expect(swipeOutcome(40, 30)).toBe("pin");
  expect(swipeOutcome(40, 120)).toBe("return");
});

test("both stamps are clear while the card rests", () => {
  expect(stampOpacity(0)).toEqual({ pin: 0, skip: 0 });
});

test("only the stamp on the side being dragged towards shows", () => {
  expect(stampOpacity(45)).toEqual({ pin: 0.5, skip: 0 });
  expect(stampOpacity(-45)).toEqual({ pin: 0, skip: 0.5 });
});

test("a stamp is full at the commit distance and never more", () => {
  expect(stampOpacity(COMMIT).pin).toBe(1);
  expect(stampOpacity(400).pin).toBe(1);
  expect(stampOpacity(-400).skip).toBe(1);
});

test("a stamp reaches full exactly where the card starts committing", () => {
  const short = COMMIT - 1;

  expect(swipeOutcome(short)).toBe("return");
  expect(stampOpacity(short).pin).toBeLessThan(1);
  expect(swipeOutcome(COMMIT)).toBe("pin");
  expect(stampOpacity(COMMIT).pin).toBe(1);
});

test("a settled card says what happened to it and what is now on top", () => {
  expect(settledAs("pin", "Point and Line to Plane", "tldraw's arrow binding")).toBe(
    "pinned Point and Line to Plane. next tldraw's arrow binding",
  );
  expect(settledAs("skip", "Point and Line to Plane", "inbox clear")).toBe(
    "skipped Point and Line to Plane. next inbox clear",
  );
});

/**
 * This line is never seen, so every mark the component puts in it is spoken. The kit sets a middle
 * dot between figures for the eye, and it was in here too: depending on the reader's punctuation
 * level that is silence or the words "middle dot", and neither is what the sentence means.
 *
 * The marks in a title are the consumer's and are not this rule's business — both titles below are
 * plain, so what is left is the component's own punctuation.
 */
test("the marks this line adds of its own are ones a reader hears correctly", () => {
  const said = settledAs("pin", "a title", "another title");

  expect(said).not.toMatch(/[·•—|/]/);
  expect(said).toContain(". next ");
});

/**
 * A title with a comma in it is why the halves are split by a full stop: one of the demo cards is
 * "Snap against predicted rest, not the pointer", and joining on a comma put three in one sentence
 * with nothing to say which one divided the two halves.
 */
test("a title with its own comma still reads as two halves", () => {
  const said = settledAs("pin", "Snap against predicted rest, not the pointer", "next thing");

  expect(said.split(". ")).toEqual([
    "pinned Snap against predicted rest, not the pointer",
    "next next thing",
  ]);
});
