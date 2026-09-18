import { expect, test } from "vite-plus/test";

import { DEFAULT_INFINITE_CANVAS_STACK_BANDS } from "./constants";
import { createInfiniteCanvasWindow } from "./factory";
import {
  getNextVisibleWindowId,
  getNextZIndex,
  getWindowStackValue,
  sortWindowsByStack,
} from "./stacking";

const windowWith = (id: string, zIndex: number, isPinned: boolean) =>
  createInfiniteCanvasWindow({
    id,
    isPinned,
    kind: "note",
    rect: { height: 10, width: 10, x: 0, y: 0 },
    zIndex,
  });

test("large stacks do not exceed the function argument limit", () => {
  const template = windowWith("template", 0, false);
  const windows = Array.from({ length: 150_000 }, (_, zIndex) => ({
    ...template,
    id: `window-${zIndex}`,
    zIndex,
  }));
  expect(getNextZIndex(windows, false)).toBe(150_000);
  expect(getNextZIndex(windows, true)).toBe(0);
});

test("the next visible window respects stack bands and skips minimized windows", () => {
  const hidden = { ...windowWith("hidden", 50, true), mode: "minimized" as const };
  const windows = [hidden, windowWith("pinned", 0, true), windowWith("floating", 10, false)];
  expect(getNextVisibleWindowId(windows)).toBe("pinned");
  expect(getNextVisibleWindowId([hidden])).toBeNull();
  expect(getNextVisibleWindowId([])).toBeNull();
  expect(windows.map((window) => window.id)).toEqual(["hidden", "pinned", "floating"]);
});

test("equal stack values retain the last visible window", () => {
  expect(
    getNextVisibleWindowId([windowWith("first", 3, false), windowWith("last", 3, false)]),
  ).toBe("last");
});

test("pinning lifts a window by a whole band, not by a nudge", () => {
  expect(getWindowStackValue({ isPinned: false, zIndex: 5 })).toBe(5);
  expect(getWindowStackValue({ isPinned: true, zIndex: 5 })).toBe(
    DEFAULT_INFINITE_CANVAS_STACK_BANDS.pinned + 5,
  );
});

test("the freshest unpinned window still loses to the stalest pinned one", () => {
  const stalePinned = getWindowStackValue({ isPinned: true, zIndex: 0 });
  const freshUnpinned = getWindowStackValue({ isPinned: false, zIndex: 999_999 });

  expect(freshUnpinned).toBeLessThan(stalePinned);
});

test("the band is a ceiling on how many windows can stack, and it is documented here", () => {
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

  expect(sorted.map((window) => window.id)).toEqual([
    "unpinned-low",
    "unpinned-high",
    "pinned-low",
  ]);
});

test("sorting does not mutate the array it was given", () => {
  const windows = [windowWith("b", 2, false), windowWith("a", 1, false)];
  const before = windows.map((window) => window.id);

  sortWindowsByStack(windows);

  expect(windows.map((window) => window.id)).toEqual(before);
});

test("the next z-index is per band, so pinning does not inflate the unpinned stack", () => {
  const windows = [
    windowWith("u0", 0, false),
    windowWith("u1", 7, false),
    windowWith("p0", 3, true),
  ];

  expect(getNextZIndex(windows, false)).toBe(8);
  expect(getNextZIndex(windows, true)).toBe(4);
});

test("the first window in an empty band starts at zero", () => {
  expect(getNextZIndex([], false)).toBe(0);
  expect(getNextZIndex([windowWith("p", 5, true)], false)).toBe(0);
});
