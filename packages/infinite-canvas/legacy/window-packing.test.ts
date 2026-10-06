import { expect, test } from "vite-plus/test";

import { getInfiniteCanvasPackedRects } from "./window-packing";
import type { InfiniteCanvasRect } from "./types";

/** Mixed heights in no order, so the sort has something to do. */
const rects: readonly InfiniteCanvasRect[] = [
  { height: 100, width: 200, x: 0, y: 0 },
  { height: 300, width: 200, x: 40, y: 10 },
  { height: 100, width: 200, x: 80, y: 20 },
  { height: 200, width: 200, x: 120, y: 30 },
  { height: 300, width: 200, x: 160, y: 40 },
  { height: 200, width: 200, x: 200, y: 50 },
];

function overlappingPairs(packed: readonly InfiniteCanvasRect[]) {
  return packed.flatMap((left, index) =>
    packed
      .slice(index + 1)
      .filter(
        (right) =>
          left.x < right.x + right.width &&
          right.x < left.x + left.width &&
          left.y < right.y + right.height &&
          right.y < left.y + left.height,
      ),
  ).length;
}

test("packing never overlaps, which is the whole point of it", () => {
  // A strip two rects wide forces rows, which is where an overlap would appear.
  expect(overlappingPairs(getInfiniteCanvasPackedRects(rects, { stripWidth: 420 }))).toBe(0);
  expect(
    overlappingPairs(getInfiniteCanvasPackedRects(rects, { gapPx: 16, stripWidth: 420 })),
  ).toBe(0);
});

test("rows are levels, and they arrive tallest first", () => {
  const packed = getInfiniteCanvasPackedRects(rects, { stripWidth: 420 });
  const levels = [...new Set(packed.map((rect) => rect.y))].sort((left, right) => left - right);
  const tallestPerLevel = levels.map((y) =>
    Math.max(...packed.filter((rect) => rect.y === y).map((rect) => rect.height)),
  );

  // Two 200-wide rects per 420 strip, so six rects make three rows.
  expect(levels).toHaveLength(3);
  // Decreasing height: each row is no taller than the one above it.
  expect(tallestPerLevel).toEqual([...tallestPerLevel].sort((left, right) => right - left));
});

test("packing moves rects and never resizes them", () => {
  const packed = getInfiniteCanvasPackedRects(rects, { stripWidth: 420 });

  expect(packed.map((rect) => `${rect.width}x${rect.height}`)).toEqual(
    rects.map((rect) => `${rect.width}x${rect.height}`),
  );
});

test("a gap separates neighbours on a row without overlapping them", () => {
  const [first, second] = getInfiniteCanvasPackedRects(
    [
      { height: 100, width: 200, x: 0, y: 0 },
      { height: 100, width: 200, x: 0, y: 0 },
    ],
    { gapPx: 24, stripWidth: 500 },
  );

  expect(second?.x).toBe((first?.x ?? 0) + 200 + 24);
});

test("too few rects to arrange returns the same array, so a caller can tell nothing changed", () => {
  const one = rects.slice(0, 1);

  expect(getInfiniteCanvasPackedRects(one)).toBe(one);
  expect(getInfiniteCanvasPackedRects([])).toHaveLength(0);
});

test("the strip width decides how many fit on a row", () => {
  const wide = getInfiniteCanvasPackedRects(rects, { stripWidth: 1200 });
  const narrow = getInfiniteCanvasPackedRects(rects, { stripWidth: 200 });

  // Six 200-wide rects: 1200 holds all six on one row, 200 holds one each.
  expect(new Set(wide.map((rect) => rect.y)).size).toBe(1);
  expect(new Set(narrow.map((rect) => rect.y)).size).toBe(rects.length);
});
