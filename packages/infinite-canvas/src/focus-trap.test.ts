import { expect, test } from "vite-plus/test";

import { getInfiniteCanvasTabTrapAction } from "./focus-trap";

/**
 * Focus containment (FR-9), at the decision rather than the DOM.
 *
 * A window body is a focus region the way an OS window is: Tab cycles what is inside it and stops
 * at its edges. This is the last structural accessibility piece, and it had no test — because
 * this package's test environment has no DOM, so anything reaching for `querySelectorAll` or
 * `.focus()` was unreachable. The rule is now a pure function of four values and the traversal
 * stays where it is.
 *
 * The property worth protecting hardest is the *negative* one. Only the edges are intercepted; a
 * Tab in the middle of a form is left entirely to the browser, which already handles shadow
 * roots, custom tab order, and content that changed since the query. Intercepting every Tab to
 * reimplement the platform's traversal is how focus managers become the bug they were written to
 * fix, and `release` is what stops this one doing that.
 */

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
  // Shift+Tab from the LAST control moves backwards inside the region, so it must be released.
  // A trap that fired on either modifier at either edge would pin focus to the two ends and make
  // the middle of a form unreachable by keyboard.
  expect(getInfiniteCanvasTabTrapAction({ shiftKey: true, target: LAST }, EDGES)).toBe("release");
  expect(getInfiniteCanvasTabTrapAction({ shiftKey: false, target: FIRST }, EDGES)).toBe("release");
});

test("a body with nothing focusable keeps focus on itself", () => {
  // The whole body is one stop, so either direction wraps to itself rather than escaping into the
  // document — otherwise Tab from an empty window silently lands on the page behind the canvas.
  expect(getInfiniteCanvasTabTrapAction({ shiftKey: false, target: null }, null)).toBe(
    "focus-root",
  );
  expect(getInfiniteCanvasTabTrapAction({ shiftKey: true, target: null }, null)).toBe("focus-root");
});

test("a single focusable control is both edges at once", () => {
  // With one control, first === last, so both directions are edge cases and neither escapes.
  //
  // The two actions keep their distinct *names* here — forward reports `focus-first`, backward
  // reports `focus-last` — and both resolve to the same element, because both edges are it. The
  // first draft of this test expected `focus-first` for both and was asserting the name where the
  // property that matters is that neither is `release`.
  const only = { first: FIRST, last: FIRST };

  expect(getInfiniteCanvasTabTrapAction({ shiftKey: false, target: FIRST }, only)).toBe(
    "focus-first",
  );
  expect(getInfiniteCanvasTabTrapAction({ shiftKey: true, target: FIRST }, only)).toBe(
    "focus-last",
  );
});

test("an unrecognised target is released rather than trapped", () => {
  // Focus arriving from somewhere the query did not see — a shadow root, or content added since —
  // must not be captured on a guess.
  expect(getInfiniteCanvasTabTrapAction({ shiftKey: false, target: null }, EDGES)).toBe("release");
});
