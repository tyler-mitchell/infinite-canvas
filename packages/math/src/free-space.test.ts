import { describe, expect, test } from "vite-plus/test";
import {
  containsRect,
  overlapsRect,
  pruneContainedRects,
  Rect,
  subtractRect,
  type Pieces,
} from "./rect";

const rect = Rect({ x: 0, y: 0, width: 100, height: 100 });
const at = (x: number, y: number, width: number, height: number) => Rect({ x, y, width, height });

const taken = (pieces: Pieces) => pieces.items.slice(0, pieces.count);

const probes = (step: number, size: number): Rect[] =>
  Array.from({ length: (100 / step) * (100 / step) }, (_, index) =>
    at((index % (100 / step)) * step, Math.floor(index / (100 / step)) * step, size, size),
  ).filter((probe) => containsRect(rect, probe));

const others: Rect[] = [
  at(40, 40, 20, 20),
  at(-10, -10, 40, 40),
  at(0, 30, 100, 10),
  at(70, 20, 50, 50),
];

describe("subtractRect", () => {
  test("returns the rectangle whole when the two do not overlap", () => {
    const pieces = subtractRect(rect, at(200, 0, 10, 10));
    expect(pieces.count).toBe(1);
    expect(pieces.items[0]).toEqual(rect);
  });

  test("treats edge contact as no overlap, so a touching neighbour takes nothing away", () => {
    const touching: Rect[] = [
      at(100, 0, 10, 100),
      at(100, 30, 10, 10),
      at(-10, 30, 10, 10),
      at(30, -10, 10, 10),
      at(30, 100, 10, 10),
    ];
    touching.forEach((other) => {
      const pieces = subtractRect(rect, other);
      expect(pieces.count).toBe(1);
      expect(pieces.items[0]).toEqual(rect);
    });
  });

  test("returns nothing when the other rectangle covers it", () => {
    expect(subtractRect(rect, at(-10, -10, 200, 200)).count).toBe(0);
  });

  test("keeps each piece maximal by spanning the whole opposite extent", () => {
    expect(taken(subtractRect(rect, at(40, 40, 20, 20)))).toEqual([
      at(0, 0, 100, 40),
      at(0, 60, 100, 40),
      at(0, 0, 40, 100),
      at(60, 0, 40, 100),
    ]);
  });

  test("returns two pieces for a corner bite, not three", () => {
    expect(taken(subtractRect(rect, at(-10, -10, 40, 40)))).toEqual([
      at(0, 30, 100, 70),
      at(30, 0, 70, 100),
    ]);
  });

  test("never returns a piece that leaves the rectangle or meets the other rectangle", () => {
    others.forEach((other) =>
      taken(subtractRect(rect, other)).forEach((piece) => {
        expect(containsRect(rect, piece)).toBe(true);
        expect(overlapsRect(piece, other)).toBe(false);
        expect(piece.width).toBeGreaterThan(0);
        expect(piece.height).toBeGreaterThan(0);
      }),
    );
  });

  test("leaves every free probe inside one single piece, which is what maximality buys", () => {
    others.forEach((other) => {
      const pieces = taken(subtractRect(rect, other));
      probes(5, 10)
        .filter((probe) => !overlapsRect(probe, other))
        .forEach((probe) => expect(pieces.some((piece) => containsRect(piece, probe))).toBe(true));
    });
  });
});

describe("pruneContainedRects", () => {
  test("drops a rectangle another one already covers", () => {
    const big = at(0, 0, 100, 100);
    const small = at(10, 10, 10, 10);
    expect(pruneContainedRects([big, small])).toEqual([big]);
    expect(pruneContainedRects([small, big])).toEqual([big]);
  });

  test("keeps exactly one of two identical rectangles", () => {
    expect(pruneContainedRects([rect, Rect(rect)])).toEqual([rect]);
  });

  test("keeps rectangles that only overlap, since neither covers the other", () => {
    const a = at(0, 0, 100, 40);
    const b = at(0, 0, 40, 100);
    expect(pruneContainedRects([a, b])).toEqual([a, b]);
  });

  test("leaves no survivor covered by another survivor, whatever the input order", () => {
    const rects = [
      at(0, 0, 100, 40),
      at(10, 5, 20, 20),
      at(0, 0, 40, 100),
      at(0, 0, 100, 40),
      at(5, 5, 5, 5),
    ];
    [rects, rects.toReversed()].forEach((order) => {
      const kept = pruneContainedRects(order);
      expect(kept).toHaveLength(2);
      kept.forEach((survivor, index) =>
        kept.forEach((other, otherIndex) => {
          if (index !== otherIndex) expect(containsRect(other, survivor)).toBe(false);
        }),
      );
    });
  });
});
