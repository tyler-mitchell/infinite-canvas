import { expect, test } from "vite-plus/test";

import { DEFAULT_INFINITE_CANVAS_STACK_BANDS } from "./constants";
import { createInfiniteCanvasWindow } from "./factory";
import { getNextZIndex, getWindowStackValue, sortWindowsByStack } from "./stacking";

/**
 * Stack ordering — the arithmetic that decides which window is on top.
 *
 * `reducer.test.ts` exercises the window lifecycle through its actions, so open/close/minimize/
 * maximize/restore/togglePinned are genuinely covered. What none of it asserts is the *ordering*
 * those actions produce: no test referenced a stack value, and the `isPinned` / `zIndex` hits in
 * the suite are fixture values rather than claims about paint order.
 *
 * That is a bad thing to leave unasserted, because a stacking defect is invisible until two
 * things overlap — which is exactly how `scope="window"` portals shipped painting underneath
 * their own window and stayed that way from `0.1.0`. This is the same category of silence.
 */

const windowWith = (id: string, zIndex: number, isPinned: boolean) =>
  createInfiniteCanvasWindow({
    id,
    isPinned,
    kind: "note",
    rect: { height: 10, width: 10, x: 0, y: 0 },
    zIndex,
  });

test("pinning lifts a window by a whole band, not by a nudge", () => {
  // The band is what makes "pinned" mean *above everything unpinned* rather than "a bit higher".
  expect(getWindowStackValue({ isPinned: false, zIndex: 5 })).toBe(5);
  expect(getWindowStackValue({ isPinned: true, zIndex: 5 })).toBe(
    DEFAULT_INFINITE_CANVAS_STACK_BANDS.pinned + 5,
  );
});

test("the freshest unpinned window still loses to the stalest pinned one", () => {
  // The property the band exists for, stated as the comparison a user would notice: raising an
  // unpinned window as high as it can go must not put it over a pinned one.
  const stalePinned = getWindowStackValue({ isPinned: true, zIndex: 0 });
  const freshUnpinned = getWindowStackValue({ isPinned: false, zIndex: 999_999 });

  expect(freshUnpinned).toBeLessThan(stalePinned);
});

test("the band is a ceiling on how many windows can stack, and it is documented here", () => {
  // Not a defect at any plausible scale — the band is a million — but the boundary is real and
  // silent: an unpinned window whose zIndex reached the band would tie with a pinned one and
  // resolve by document order instead. Asserting it means the limit is a known quantity rather
  // than a surprise if the banding scheme is ever retuned.
  const { pinned } = DEFAULT_INFINITE_CANVAS_STACK_BANDS;

  expect(getWindowStackValue({ isPinned: false, zIndex: pinned })).toBe(
    getWindowStackValue({ isPinned: true, zIndex: 0 }),
  );
  expect(pinned).toBeGreaterThan(1_000);
});

test("custom bands are honoured rather than hardcoded", () => {
  expect(getWindowStackValue({ isPinned: true, zIndex: 2 }, { overlay: 900, pinned: 100 })).toBe(
    102,
  );
});

test("sorting is back-to-front, so the last painted window is on top", () => {
  const sorted = sortWindowsByStack([
    windowWith("pinned-low", 0, true),
    windowWith("unpinned-high", 50, false),
    windowWith("unpinned-low", 1, false),
  ]);

  // Ascending stack value: DOM order paints later elements over earlier ones.
  expect(sorted.map((window) => window.id)).toEqual([
    "unpinned-low",
    "unpinned-high",
    "pinned-low",
  ]);
});

test("sorting does not mutate the array it was given", () => {
  // It is handed `state.windows`, and sorting that in place would reorder canonical state as a
  // side effect of rendering.
  const windows = [windowWith("b", 2, false), windowWith("a", 1, false)];
  const before = windows.map((window) => window.id);

  sortWindowsByStack(windows);

  expect(windows.map((window) => window.id)).toEqual(before);
});

test("the next z-index is per band, so pinning does not inflate the unpinned stack", () => {
  // Each band counts independently. Without that, pinning one window would push every subsequent
  // unpinned window's z-index past a million and collapse the band distinction entirely.
  const windows = [
    windowWith("u0", 0, false),
    windowWith("u1", 7, false),
    windowWith("p0", 3, true),
  ];

  expect(getNextZIndex(windows, false)).toBe(8);
  expect(getNextZIndex(windows, true)).toBe(4);
});

test("the first window in an empty band starts at zero", () => {
  // `Math.max(-1, ...[])` is the guard: without the seed this is -Infinity and the first window
  // opens at -Infinity + 1.
  expect(getNextZIndex([], false)).toBe(0);
  expect(getNextZIndex([windowWith("p", 5, true)], false)).toBe(0);
});
