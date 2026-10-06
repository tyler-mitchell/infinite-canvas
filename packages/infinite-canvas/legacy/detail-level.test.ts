import { expect, test } from "vite-plus/test";

import {
  DEFAULT_INFINITE_CANVAS_DETAIL_POLICY,
  getInfiniteCanvasWindowDetailLevel,
} from "./detail-level";

const rect = (width: number, height: number) => ({ height, width, x: 0, y: 0 });
const { fullAbovePx, summaryBelowPx } = DEFAULT_INFINITE_CANVAS_DETAIL_POLICY;

test("a window larger than the demote threshold renders in full", () => {
  expect(getInfiniteCanvasWindowDetailLevel(rect(400, 400), 1)).toBe("full");
});

test("a window smaller than the demote threshold drops to its summary", () => {
  expect(getInfiniteCanvasWindowDetailLevel(rect(400, 400), 0.25)).toBe("summary");
});

test("the threshold is on screen size, not zoom", () => {
  const zoom = 0.2;

  expect(getInfiniteCanvasWindowDetailLevel(rect(200, 200), zoom)).toBe("summary");
  expect(getInfiniteCanvasWindowDetailLevel(rect(2000, 2000), zoom)).toBe("full");
});

test("the smaller axis decides, so a wide sliver still demotes", () => {
  expect(getInfiniteCanvasWindowDetailLevel(rect(4000, 100), 1)).toBe("summary");
});

test("a short card is stranded in summary by its height, not demoted by it", () => {
  const card = rect(360, 128);

  expect(getInfiniteCanvasWindowDetailLevel(card, 1, "full")).toBe("full");
  expect(getInfiniteCanvasWindowDetailLevel(card, 0.5, "full")).toBe("summary");
  expect(getInfiniteCanvasWindowDetailLevel(card, 1, "summary")).toBe("summary");

  const tallEnough = rect(360, 200);

  expect(getInfiniteCanvasWindowDetailLevel(tallEnough, 0.5, "full")).toBe("summary");
  expect(getInfiniteCanvasWindowDetailLevel(tallEnough, 1, "summary")).toBe("full");
});

test("a full window holds until it crosses the demote threshold", () => {
  const justAbove = summaryBelowPx + 1;
  const justBelow = summaryBelowPx - 1;

  expect(getInfiniteCanvasWindowDetailLevel(rect(justAbove, justAbove), 1, "full")).toBe("full");
  expect(getInfiniteCanvasWindowDetailLevel(rect(justBelow, justBelow), 1, "full")).toBe("summary");
});

test("a summary window does NOT restore at the demote threshold — the band holds it", () => {
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
  expect(fullAbovePx).toBeGreaterThan(summaryBelowPx);
});

test("a cold start with no previous level renders in full", () => {
  expect(getInfiniteCanvasWindowDetailLevel(rect(400, 400), 1)).toBe("full");
});

test("a misconfigured band degrades to no hysteresis rather than to flicker", () => {
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
  const stressWindow = rect(300, 210);

  expect(getInfiniteCanvasWindowDetailLevel(stressWindow, 1, "summary")).toBe("full");
  expect(getInfiniteCanvasWindowDetailLevel(stressWindow, 1, "full")).toBe("full");
});

test("a window still demotes when it is genuinely too small to read", () => {
  const stressWindow = rect(300, 210);

  expect(getInfiniteCanvasWindowDetailLevel(stressWindow, 0.4, "full")).toBe("summary");
  expect(getInfiniteCanvasWindowDetailLevel(stressWindow, 0.65, "summary")).toBe("summary");
  expect(getInfiniteCanvasWindowDetailLevel(stressWindow, 0.65, "full")).toBe("full");
});
