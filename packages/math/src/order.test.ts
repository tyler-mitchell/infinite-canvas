import { d, std } from "typegpu";
import { describe, expect, test } from "vite-plus/test";
import { createRectBuffer, writeRect } from "./buffer";
import { hilbertIndex, hilbertOrder, HILBERT_RESOLUTION } from "./order";
import type { Rect } from "./rect";

const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  std.distance(d.vec2f(a.x, a.y), d.vec2f(b.x, b.y));

describe("hilbertIndex", () => {
  test("is a bijection over a small square, so no two cells share an index", () => {
    const side = 32;
    const step = (HILBERT_RESOLUTION + 1) / side;
    const seen = new Set<number>();
    for (let y = 0; y < side; y++)
      for (let x = 0; x < side; x++) seen.add(hilbertIndex(x * step, y * step));
    expect(seen.size).toBe(side * side);
  });

  test("keeps neighbours on the curve adjacent on the plane, which is why the index packs well", () => {
    const side = 16;
    const step = (HILBERT_RESOLUTION + 1) / side;
    const cells = Array.from({ length: side * side }, (_, index) => ({
      x: index % side,
      y: Math.floor(index / side),
    }))
      .map((cell) => ({ cell, key: hilbertIndex(cell.x * step, cell.y * step) }))
      .toSorted((left, right) => left.key - right.key);
    cells.slice(1).forEach(({ cell }, index) => {
      const previous = cells[index]!.cell;
      expect(Math.abs(cell.x - previous.x) + Math.abs(cell.y - previous.y)).toBe(1);
    });
  });

  test("starts at the origin and stays within an unsigned 32-bit range", () => {
    expect(hilbertIndex(0, 0)).toBe(0);
    [
      [0, 0],
      [1, 0],
      [HILBERT_RESOLUTION, 0],
      [0, HILBERT_RESOLUTION],
      [HILBERT_RESOLUTION, HILBERT_RESOLUTION],
    ].forEach(([x, y]) => {
      const value = hilbertIndex(x!, y!);
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(0xffffffff);
    });
  });
});

describe("hilbertOrder", () => {
  const buffered = (rects: readonly Rect[]) => {
    const buffer = createRectBuffer(rects.length);
    rects.forEach((rect, index) => writeRect(buffer, index, rect));
    return buffer;
  };

  test("returns an empty permutation for an empty range", () => {
    expect(Array.from(hilbertOrder(createRectBuffer(0), 0))).toEqual([]);
  });

  test("returns a permutation of every index exactly once", () => {
    const rects = Array.from({ length: 64 }, (_, index) => ({
      x: (index % 8) * 37 - 100,
      y: Math.floor(index / 8) * 23,
      width: 10,
      height: 10,
    }));
    const order = Array.from(hilbertOrder(buffered(rects), rects.length));
    expect(order.toSorted((left, right) => left - right)).toEqual(rects.map((_, index) => index));
  });

  test("puts spatial neighbours near each other, beating the input order", () => {
    const rects = Array.from({ length: 256 }, (_, index) => ({
      x: ((index * 61) % 16) * 40,
      y: ((index * 23) % 16) * 40,
      width: 20,
      height: 20,
    }));
    const centre = (rect: Rect) => ({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 });
    const walk = (sequence: readonly number[]) =>
      sequence
        .slice(1)
        .reduce(
          (total, index, step) =>
            total + distance(centre(rects[index]!), centre(rects[sequence[step]!]!)),
          0,
        );
    const ordered = Array.from(hilbertOrder(buffered(rects), rects.length));
    expect(walk(ordered)).toBeLessThan(walk(rects.map((_, index) => index)) / 2);
  });

  test("is stable for rectangles that share a centre", () => {
    const rects = Array.from({ length: 5 }, () => ({ x: 0, y: 0, width: 10, height: 10 }));
    expect(Array.from(hilbertOrder(buffered(rects), rects.length))).toEqual([0, 1, 2, 3, 4]);
  });

  test("does not divide by zero when every centre is the same point", () => {
    const rects = [
      { x: 5, y: 5, width: 2, height: 2 },
      { x: 5, y: 5, width: 2, height: 2 },
    ];
    expect(Array.from(hilbertOrder(buffered(rects), rects.length))).toEqual([0, 1]);
  });
});
