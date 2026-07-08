import { expect, test } from "vite-plus/test";

import {
  createInfiniteCanvasVisibilityState,
  getInfiniteCanvasVisibilitySummary,
  getWindowFrustumVisibility,
  isWindowFramed,
  retainWindowFrustumVisibility,
  setWindowFrustumVisibility,
  setWindowsFrustumVisibility,
} from "./visibility";

test("window frustum visibility updates immutably when the framed state changes", () => {
  const initial = createInfiniteCanvasVisibilityState();
  const visible = setWindowFrustumVisibility(initial, "alpha", true, 100);
  const unchanged = setWindowFrustumVisibility(visible, "alpha", true, 200);
  const hidden = setWindowFrustumVisibility(visible, "alpha", false, 300);

  expect(visible).not.toBe(initial);
  expect(visible.revision).toBe(1);
  expect(getWindowFrustumVisibility(visible, "alpha")).toEqual({
    isFramed: true,
    updatedAt: 100,
  });
  expect(unchanged).toBe(visible);
  expect(hidden.revision).toBe(2);
  expect(getWindowFrustumVisibility(hidden, "alpha")).toEqual({
    isFramed: false,
    updatedAt: 300,
  });
});

test("unknown window frustum visibility uses a visible fallback", () => {
  const state = createInfiniteCanvasVisibilityState();

  expect(isWindowFramed(state, "missing")).toBe(true);
  expect(isWindowFramed(state, "missing", false)).toBe(false);
});

test("window frustum visibility batches state changes", () => {
  const initial = createInfiniteCanvasVisibilityState();
  const updated = setWindowsFrustumVisibility(
    initial,
    [
      { isFramed: true, windowId: "alpha" },
      { isFramed: false, windowId: "bravo" },
    ],
    100,
  );
  const unchanged = setWindowsFrustumVisibility(
    updated,
    [
      { isFramed: true, windowId: "alpha" },
      { isFramed: false, windowId: "bravo" },
    ],
    200,
  );

  expect(updated.revision).toBe(1);
  expect(unchanged).toBe(updated);
  expect(getInfiniteCanvasVisibilitySummary(updated)).toEqual({
    hidden: 1,
    tracked: 2,
    visible: 1,
  });
});

test("window frustum visibility retains only the windows that still have scene probes", () => {
  const state = setWindowFrustumVisibility(
    setWindowFrustumVisibility(createInfiniteCanvasVisibilityState(), "alpha", true, 100),
    "bravo",
    false,
    200,
  );
  // The argument is the set to keep, not the set to drop.
  const pruned = retainWindowFrustumVisibility(state, ["alpha"]);

  expect(pruned.revision).toBe(3);
  expect(getWindowFrustumVisibility(pruned, "alpha")).toEqual({
    isFramed: true,
    updatedAt: 100,
  });
  expect(getWindowFrustumVisibility(pruned, "bravo")).toBeNull();
  expect(getInfiniteCanvasVisibilitySummary(pruned)).toEqual({
    hidden: 0,
    tracked: 1,
    visible: 1,
  });
});
