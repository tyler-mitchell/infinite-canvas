import { describe, expect, test } from "vite-plus/test";
import { intersectsRect, Rect } from "./rect";
import { buildRectIndex } from "./rect-index";

const at = (x: number, y: number, width: number, height: number) => Rect({ x, y, width, height });

// The oracle is the rectangle predicate applied to every item. It is obviously right, and the tree
// must return exactly what it returns.
const byScan = (rects: readonly Rect[], query: Rect) =>
  rects.flatMap((rect, index) => (intersectsRect(rect, query) ? [index] : []));

const spread = (count: number, seed: number) =>
  Array.from({ length: count }, (_, index) => {
    const x = Math.sin(index * 12.9898 + seed) * 5000;
    const y = Math.cos(index * 78.233 + seed) * 5000;
    return at(x, y, 10 + (index % 40), 10 + (index % 25));
  });

describe("buildRectIndex answers the same query as a linear scan", () => {
  test("agrees on a hand-written case, including a rectangle touching the query edge", () => {
    const rects = [at(0, 0, 10, 10), at(100, 100, 10, 10), at(20, 0, 10, 10)];
    const query = at(0, 0, 20, 10);
    expect(buildRectIndex(rects).search(query)).toEqual(byScan(rects, query));
    expect(buildRectIndex(rects).search(query)).toEqual([0, 2]);
  });

  test("agrees across sizes that cross the node boundary and force extra levels", () => {
    [1, 2, 15, 16, 17, 32, 257, 1000].forEach((count) => {
      const rects = spread(count, count);
      const index = buildRectIndex(rects);
      expect(index.count).toBe(count);
      [at(-6000, -6000, 12000, 12000), at(0, 0, 500, 500), at(-100, -100, 50, 50)].forEach(
        (query) => expect(index.search(query)).toEqual(byScan(rects, query)),
      );
    });
  });

  test("agrees over many random queries against a thousand rectangles", () => {
    const rects = spread(1000, 7);
    const index = buildRectIndex(rects);
    Array.from({ length: 60 }, (_, step) => {
      const x = Math.sin(step * 3.1) * 5200;
      const y = Math.cos(step * 1.7) * 5200;
      return at(x, y, 40 + (step % 900), 40 + (step % 700));
    }).forEach((query) => expect(index.search(query)).toEqual(byScan(rects, query)));
  });

  test("finds everything when the query covers the whole extent", () => {
    const rects = spread(300, 3);
    const all = buildRectIndex(rects).search(at(-1e5, -1e5, 2e5, 2e5));
    expect(all).toEqual(Array.from({ length: 300 }, (_, index) => index));
  });

  test("finds nothing when the query is far away, without scanning every leaf", () => {
    const rects = spread(300, 3);
    expect(buildRectIndex(rects).search(at(1e6, 1e6, 10, 10))).toEqual([]);
  });
});

describe("the empty and single cases", () => {
  test("an empty index answers nothing rather than throwing", () => {
    const index = buildRectIndex([]);
    expect(index.count).toBe(0);
    expect(index.search(at(-1e5, -1e5, 2e5, 2e5))).toEqual([]);
  });

  test("a single rectangle is found by a query that touches it and missed by one that does not", () => {
    const index = buildRectIndex([at(50, 50, 10, 10)]);
    expect(index.search(at(60, 60, 5, 5))).toEqual([0]);
    expect(index.search(at(61, 61, 5, 5))).toEqual([]);
  });
});
