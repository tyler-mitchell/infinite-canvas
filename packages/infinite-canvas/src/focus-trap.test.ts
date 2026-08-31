import { expect, test } from "vite-plus/test";

import { getInfiniteCanvasTabTrapAction } from "./focus-trap";

const FIRST = { id: "first" } as unknown as EventTarget;
const LAST = { id: "last" } as unknown as EventTarget;
const MIDDLE = { id: "middle" } as unknown as EventTarget;
const EDGES = { first: FIRST, last: LAST };

test("Tab in the middle is released to the browser", () => {
  expect(getInfiniteCanvasTabTrapAction({ shiftKey: false, target: MIDDLE }, EDGES)).toBe(
    "release",
  );
  expect(getInfiniteCanvasTabTrapAction({ shiftKey: true, target: MIDDLE }, EDGES)).toBe("release");
});

test("Tab off the last control wraps to the first", () => {
  expect(getInfiniteCanvasTabTrapAction({ shiftKey: false, target: LAST }, EDGES)).toBe(
    "focus-first",
  );
});

test("Shift+Tab off the first control wraps to the last", () => {
  expect(getInfiniteCanvasTabTrapAction({ shiftKey: true, target: FIRST }, EDGES)).toBe(
    "focus-last",
  );
});

test("the trap is directional at each edge, not sticky", () => {
  expect(getInfiniteCanvasTabTrapAction({ shiftKey: true, target: LAST }, EDGES)).toBe("release");
  expect(getInfiniteCanvasTabTrapAction({ shiftKey: false, target: FIRST }, EDGES)).toBe("release");
});

test("a body with nothing focusable keeps focus on itself", () => {
  expect(getInfiniteCanvasTabTrapAction({ shiftKey: false, target: null }, null)).toBe(
    "focus-root",
  );
  expect(getInfiniteCanvasTabTrapAction({ shiftKey: true, target: null }, null)).toBe("focus-root");
});

test("a single focusable control is both edges at once", () => {
  const only = { first: FIRST, last: FIRST };

  expect(getInfiniteCanvasTabTrapAction({ shiftKey: false, target: FIRST }, only)).toBe(
    "focus-first",
  );
  expect(getInfiniteCanvasTabTrapAction({ shiftKey: true, target: FIRST }, only)).toBe(
    "focus-last",
  );
});

test("an unrecognised target is released rather than trapped", () => {
  expect(getInfiniteCanvasTabTrapAction({ shiftKey: false, target: null }, EDGES)).toBe("release");
});
