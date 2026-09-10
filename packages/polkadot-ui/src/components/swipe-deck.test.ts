import { expect, test } from "vite-plus/test";

import { stampOpacity, swipeOutcome } from "./swipe-deck.tsx";

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
