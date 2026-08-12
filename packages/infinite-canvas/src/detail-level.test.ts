import { expect, test } from "vite-plus/test";

import {
  DEFAULT_INFINITE_CANVAS_DETAIL_POLICY,
  getInfiniteCanvasWindowDetailLevel,
} from "./detail-level";

/**
 * Semantic LOD's thresholds and hysteresis band.
 *
 * The browser harness reports this check as `skip` — "not machine-checkable from here" — because
 * it thresholds on rendered screen size and asserting it there would mean driving the camera.
 * That is true of the *rendered* behaviour and false of the decision, which is a pure function
 * of a rect and a zoom. So the part that actually encodes the policy is tested here, where it
 * needs no camera, no DOM, and no browser at all.
 */

const rect = (width: number, height: number) => ({ height, width, x: 0, y: 0 });
const { fullAbovePx, summaryBelowPx } = DEFAULT_INFINITE_CANVAS_DETAIL_POLICY;

test("a window larger than the demote threshold renders in full", () => {
  expect(getInfiniteCanvasWindowDetailLevel(rect(400, 400), 1)).toBe("full");
});

test("a window smaller than the demote threshold drops to its summary", () => {
  // 400 world units at 0.25 zoom is 100 screen px, under the 180 floor.
  expect(getInfiniteCanvasWindowDetailLevel(rect(400, 400), 0.25)).toBe("summary");
});

test("the threshold is on screen size, not zoom", () => {
  // The whole design claim: at one zoom, a small window demotes and a large one does not.
  // Thresholding on zoom would give both the same answer, which is the bug this prevents.
  const zoom = 0.2;

  expect(getInfiniteCanvasWindowDetailLevel(rect(200, 200), zoom)).toBe("summary");
  expect(getInfiniteCanvasWindowDetailLevel(rect(2000, 2000), zoom)).toBe("full");
});

test("the smaller axis decides, so a wide sliver still demotes", () => {
  // 4000 x 100 at zoom 1 is 4000 px wide and 100 px tall. Taking the larger axis would keep a
  // sliver at full detail; nothing readable fits in 100 px of height.
  expect(getInfiniteCanvasWindowDetailLevel(rect(4000, 100), 1)).toBe("summary");
});

test("a full window holds until it crosses the demote threshold", () => {
  const justAbove = summaryBelowPx + 1;
  const justBelow = summaryBelowPx - 1;

  expect(getInfiniteCanvasWindowDetailLevel(rect(justAbove, justAbove), 1, "full")).toBe("full");
  expect(getInfiniteCanvasWindowDetailLevel(rect(justBelow, justBelow), 1, "full")).toBe("summary");
});

test("a summary window does NOT restore at the demote threshold — the band holds it", () => {
  // The heart of the hysteresis. Between the two thresholds, a summary window stays a summary.
  // Without this it would flip back the instant it crossed 180 again, and since zoom is
  // continuous, a window parked near the boundary would strobe between body and summary.
  const inBand = (summaryBelowPx + fullAbovePx) / 2;

  expect(inBand).toBeGreaterThan(summaryBelowPx);
  expect(inBand).toBeLessThan(fullAbovePx);
  expect(getInfiniteCanvasWindowDetailLevel(rect(inBand, inBand), 1, "summary")).toBe("summary");
});

test("a summary window restores once it clears the upper threshold", () => {
  const justAbove = fullAbovePx + 1;

  expect(getInfiniteCanvasWindowDetailLevel(rect(justAbove, justAbove), 1, "summary")).toBe("full");
});

test("the band is genuinely wide — the two thresholds are not the same number", () => {
  // A band of zero is no band, and the flicker would return silently. Guarding the constant
  // rather than trusting it, because the defaults are the only thing most consumers will use.
  expect(fullAbovePx).toBeGreaterThan(summaryBelowPx);
});

test("a cold start with no previous level renders in full", () => {
  // A window that has never been drawn should be drawn. Defaulting to "summary" would flash a
  // placeholder on first paint for every window large enough not to need one.
  expect(getInfiniteCanvasWindowDetailLevel(rect(400, 400), 1)).toBe("full");
});

test("a misconfigured band degrades to no hysteresis rather than to flicker", () => {
  // If a consumer sets fullAbovePx at or below summaryBelowPx the two rules would contradict:
  // the same size would read as "restore" going up and "demote" going down, and the window
  // would oscillate. Taking the max of the two collapses it to a single threshold instead.
  const policy = { fullAbovePx: 100, summaryBelowPx: 200 };
  const between = rect(150, 150);

  expect(getInfiniteCanvasWindowDetailLevel(between, 1, "summary", policy)).toBe("summary");
  expect(getInfiniteCanvasWindowDetailLevel(between, 1, "full", policy)).toBe("summary");
});

test("a custom policy is respected on both edges", () => {
  const policy = { fullAbovePx: 60, summaryBelowPx: 40 };

  expect(getInfiniteCanvasWindowDetailLevel(rect(30, 30), 1, "full", policy)).toBe("summary");
  expect(getInfiniteCanvasWindowDetailLevel(rect(50, 50), 1, "summary", policy)).toBe("summary");
  expect(getInfiniteCanvasWindowDetailLevel(rect(70, 70), 1, "summary", policy)).toBe("full");
});

test("the default band never strands a window at 100% zoom", () => {
  // The regression that shipped: `/stress` draws 300×210 windows, `extent` takes the smaller
  // axis, and the old defaults (demote 180 / restore 240) put 210 inside the band. Zooming out
  // demoted them and returning to 100% left them as summary cards until 114% zoom. The same
  // window at the same zoom rendered different content depending on camera history.
  //
  // Every unit test passed, because they all asked "does the band work" with numbers chosen to
  // exercise the band rather than numbers any window actually has. This one asks the question
  // the product asks: at 100% zoom, is a real window full detail regardless of where it has been?
  const stressWindow = rect(300, 210);

  expect(getInfiniteCanvasWindowDetailLevel(stressWindow, 1, "summary")).toBe("full");
  expect(getInfiniteCanvasWindowDetailLevel(stressWindow, 1, "full")).toBe("full");
});

test("a window still demotes when it is genuinely too small to read", () => {
  // The fix must not buy zoom-1 correctness by disabling the lane. The same window far out is
  // still a summary, and the band still has a dead zone — just one that sits where a window is
  // actually illegible rather than across the default zoom.
  const stressWindow = rect(300, 210);

  expect(getInfiniteCanvasWindowDetailLevel(stressWindow, 0.4, "full")).toBe("summary");
  expect(getInfiniteCanvasWindowDetailLevel(stressWindow, 0.65, "summary")).toBe("summary");
  expect(getInfiniteCanvasWindowDetailLevel(stressWindow, 0.65, "full")).toBe("full");
});
