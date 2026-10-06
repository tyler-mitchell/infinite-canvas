import { expect, test } from "vite-plus/test";

import {
  getInfiniteCanvasAlignedRects,
  getInfiniteCanvasDistributedRects,
  getInfiniteCanvasSwappedRects,
} from "./window-arrange";
import type { InfiniteCanvasRect } from "./types";

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

  expect(getInfiniteCanvasAlignedRects(one, "left")).toBe(one);
  expect(getInfiniteCanvasAlignedRects([], "left")).toStrictEqual([]);
});

test("distribute evens the gaps between the outermost two", () => {
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
  const arranged = getInfiniteCanvasDistributedRects(
    [rect(0, 0, 10, 10), rect(40, 0, 50, 10), rect(90, 0, 10, 10)],
    "horizontal",
  );

  expect(arranged.map((entry) => entry.x)).toStrictEqual([0, 25, 90]);

  const gapOne = (arranged[1]?.x ?? 0) - ((arranged[0]?.x ?? 0) + 10);
  const gapTwo = (arranged[2]?.x ?? 0) - ((arranged[1]?.x ?? 0) + 50);

  expect(gapOne).toBeCloseTo(gapTwo);
});

test("distribute returns rects in the caller's order, not sorted order", () => {
  const arranged = getInfiniteCanvasDistributedRects(
    [rect(90, 0, 10, 10), rect(0, 0, 10, 10), rect(20, 0, 10, 10)],
    "horizontal",
  );

  expect(arranged.map((entry) => entry.x)).toStrictEqual([90, 0, 45]);
});

test("distribute degrades to even overlap rather than refusing when rects do not fit", () => {
  const arranged = getInfiniteCanvasDistributedRects(
    [rect(0, 0, 60, 10), rect(10, 0, 60, 10), rect(40, 0, 60, 10)],
    "horizontal",
  );

  expect(arranged[0]?.x).toBe(0);
  expect(arranged[2]?.x).toBe(40);
  expect(sizesOf(arranged)).toStrictEqual(["60x10", "60x10", "60x10"]);
});

test("distributing fewer than three rects is the identity", () => {
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

test("two windows exchange centres, and both keep their own size", () => {
  const swapped = getInfiniteCanvasSwappedRects([
    { height: 100, width: 200, x: 0, y: 0 },
    { height: 300, width: 400, x: 1_000, y: 500 },
  ]);

  expect(swapped[0]).toEqual({ height: 100, width: 200, x: 1_100, y: 600 });
  expect(swapped[1]).toEqual({ height: 300, width: 400, x: -100, y: -100 });
});

test("exchanging centres reduces to exchanging origins when the sizes match", () => {
  const a = { height: 100, width: 200, x: 0, y: 0 };
  const b = { height: 100, width: 200, x: 700, y: 300 };
  const swapped = getInfiniteCanvasSwappedRects([a, b]);

  expect(swapped[0]).toEqual({ ...a, x: b.x, y: b.y });
  expect(swapped[1]).toEqual({ ...b, x: a.x, y: a.y });
});

test("swapping is its own inverse", () => {
  const rects = [
    { height: 100, width: 200, x: 12, y: 34 },
    { height: 250, width: 90, x: -400, y: 800 },
  ];

  expect(getInfiniteCanvasSwappedRects(getInfiniteCanvasSwappedRects(rects))).toEqual(rects);
});

test("a swap needs exactly two rects, not at least two", () => {
  const three = [
    { height: 10, width: 10, x: 0, y: 0 },
    { height: 10, width: 10, x: 50, y: 0 },
    { height: 10, width: 10, x: 100, y: 0 },
  ];
  const one = [three[0]!];

  expect(getInfiniteCanvasSwappedRects(three)).toBe(three);
  expect(getInfiniteCanvasSwappedRects(one)).toBe(one);
  expect(getInfiniteCanvasSwappedRects([])).toHaveLength(0);
});
