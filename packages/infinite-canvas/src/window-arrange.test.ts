import { expect, test } from "vite-plus/test";

import { getInfiniteCanvasAlignedRects, getInfiniteCanvasDistributedRects } from "./window-arrange";
import type { InfiniteCanvasRect } from "./types";

/**
 * The arrange verbs' geometry.
 *
 * These shipped reasoned-through and unwatched, and they are pure functions over rects — which
 * makes them exactly the kind of claim that belongs in a test file rather than in a browser.
 * The properties asserted here are the ones the module's own documentation promises, because a
 * documented promise nothing checks is how this project has been bitten before.
 */

const rect = (x: number, y: number, width: number, height: number): InfiniteCanvasRect => ({
  height,
  width,
  x,
  y,
});

const sizesOf = (rects: readonly InfiniteCanvasRect[]) =>
  rects.map((entry) => `${entry.width}x${entry.height}`);

test("align left brings every rect to the leftmost edge, not to the viewport", () => {
  const arranged = getInfiniteCanvasAlignedRects(
    [rect(100, 0, 50, 50), rect(300, 100, 80, 40)],
    "left",
  );

  expect(arranged.map((entry) => entry.x)).toStrictEqual([100, 100]);
});

test("align right shares the rightmost edge, accounting for differing widths", () => {
  // The bounds' right edge is 300 + 80 = 380. A 50-wide rect must land at 330 to share it —
  // aligning origins instead would leave the two right edges 30px apart.
  const arranged = getInfiniteCanvasAlignedRects(
    [rect(100, 0, 50, 50), rect(300, 100, 80, 40)],
    "right",
  );

  expect(arranged.map((entry) => entry.x + entry.width)).toStrictEqual([380, 380]);
});

test("align top and bottom move only y", () => {
  const input = [rect(10, 20, 50, 50), rect(70, 200, 50, 90)];

  expect(getInfiniteCanvasAlignedRects(input, "top").map((entry) => entry.y)).toStrictEqual([
    20, 20,
  ]);
  expect(getInfiniteCanvasAlignedRects(input, "top").map((entry) => entry.x)).toStrictEqual([
    10, 70,
  ]);
  expect(
    getInfiniteCanvasAlignedRects(input, "bottom").map((entry) => entry.y + entry.height),
  ).toStrictEqual([290, 290]);
});

test("horizontal-center puts every rect on one vertical centreline", () => {
  const arranged = getInfiniteCanvasAlignedRects(
    [rect(0, 0, 100, 10), rect(0, 50, 40, 10)],
    "horizontal-center",
  );
  const centres = arranged.map((entry) => entry.x + entry.width / 2);

  expect(centres[0]).toBeCloseTo(centres[1] as number);
});

test("aligning never resizes — which is why no minSize clamping is needed", () => {
  const input = [rect(0, 0, 50, 20), rect(400, 400, 130, 90)];

  for (const alignment of [
    "bottom",
    "horizontal-center",
    "left",
    "right",
    "top",
    "vertical-center",
  ] as const) {
    expect(sizesOf(getInfiniteCanvasAlignedRects(input, alignment))).toStrictEqual(sizesOf(input));
  }
});

test("aligning fewer than two rects is the identity, and returns the same reference", () => {
  const one = [rect(0, 0, 10, 10)];

  // Reference equality matters: `isInfiniteCanvasCommandEnabled` uses `arranged !== rects` to
  // decide whether the command is available, exactly as the reducers signal "nothing changed".
  expect(getInfiniteCanvasAlignedRects(one, "left")).toBe(one);
  expect(getInfiniteCanvasAlignedRects([], "left")).toStrictEqual([]);
});

test("distribute evens the gaps between the outermost two", () => {
  // Widths 10/10/10 spanning 0..100. Free space is 100 - 30 = 70 across 2 gaps = 35 each.
  // So origins land at 0, 45, 90.
  const arranged = getInfiniteCanvasDistributedRects(
    [rect(0, 0, 10, 10), rect(20, 0, 10, 10), rect(90, 0, 10, 10)],
    "horizontal",
  );

  expect(arranged.map((entry) => entry.x)).toStrictEqual([0, 45, 90]);
});

test("distribute holds the outermost two still", () => {
  const input = [rect(0, 0, 10, 10), rect(20, 0, 10, 10), rect(90, 0, 10, 10)];
  const arranged = getInfiniteCanvasDistributedRects(input, "horizontal");

  expect(arranged[0]?.x).toBe(0);
  expect(arranged[2]?.x).toBe(90);
});

test("distribute evens GAPS, not centres, when sizes differ", () => {
  // Widths 10/50/10 spanning 0..100. Occupied 70, free 30, gap 15 each.
  // Origins: 0, then 0+10+15 = 25, then 25+50+15 = 90.
  const arranged = getInfiniteCanvasDistributedRects(
    [rect(0, 0, 10, 10), rect(40, 0, 50, 10), rect(90, 0, 10, 10)],
    "horizontal",
  );

  expect(arranged.map((entry) => entry.x)).toStrictEqual([0, 25, 90]);

  // The gaps are equal; the centres are not. Equal centres would put the wide rect at 45.
  const gapOne = (arranged[1]?.x ?? 0) - ((arranged[0]?.x ?? 0) + 10);
  const gapTwo = (arranged[2]?.x ?? 0) - ((arranged[1]?.x ?? 0) + 50);

  expect(gapOne).toBeCloseTo(gapTwo);
});

test("distribute returns rects in the caller's order, not sorted order", () => {
  // The computation must sort along the axis; the result must not. A caller pairing rects with
  // window ids by index would otherwise assign every window the wrong rect — silently.
  const arranged = getInfiniteCanvasDistributedRects(
    [rect(90, 0, 10, 10), rect(0, 0, 10, 10), rect(20, 0, 10, 10)],
    "horizontal",
  );

  // Input order is right, left, middle → output must be the same three positions in that order.
  expect(arranged.map((entry) => entry.x)).toStrictEqual([90, 0, 45]);
});

test("distribute degrades to even overlap rather than refusing when rects do not fit", () => {
  // Widths 60/60/60 spanning 0..100 cannot fit. Free space is negative, so the gap is negative
  // and they overlap evenly. Nothing is resized to make room — that is the documented trade.
  const arranged = getInfiniteCanvasDistributedRects(
    [rect(0, 0, 60, 10), rect(10, 0, 60, 10), rect(40, 0, 60, 10)],
    "horizontal",
  );

  expect(arranged[0]?.x).toBe(0);
  expect(arranged[2]?.x).toBe(40);
  expect(sizesOf(arranged)).toStrictEqual(["60x10", "60x10", "60x10"]);
});

test("distributing fewer than three rects is the identity", () => {
  // With two, both are outermost and there is nothing between them to respace.
  const two = [rect(0, 0, 10, 10), rect(90, 0, 10, 10)];

  expect(getInfiniteCanvasDistributedRects(two, "horizontal")).toBe(two);
});

test("vertical distribution works on the other axis and leaves x alone", () => {
  const arranged = getInfiniteCanvasDistributedRects(
    [rect(5, 0, 10, 10), rect(5, 20, 10, 10), rect(5, 90, 10, 10)],
    "vertical",
  );

  expect(arranged.map((entry) => entry.y)).toStrictEqual([0, 45, 90]);
  expect(arranged.map((entry) => entry.x)).toStrictEqual([5, 5, 5]);
});
