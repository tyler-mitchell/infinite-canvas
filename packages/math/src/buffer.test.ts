import { describe, expect, test } from "vite-plus/test";
import {
  boundsOfRects,
  createRectBuffer,
  nearestIndices,
  readRect,
  RECT_STRIDE,
  writeRect,
} from "./buffer";
import { d } from "typegpu";
import { approxEqualsRect, distanceToRect, Rect, unionRects } from "./rect";

const exact: Rect[] = [
  { x: 0, y: 0, width: 100, height: 50 },
  { x: -40, y: 120, width: 30, height: 30 },
  { x: 250, y: -80, width: 10, height: 400 },
  { x: 60, y: 20, width: 120, height: 15 },
  { x: -5.5, y: 0.25, width: 7.5, height: 3.25 },
];

const arbitrary: Rect[] = [
  { x: 0.1, y: 0.2, width: 100.7, height: 50.3 },
  { x: -40.9, y: 120.1, width: 30.33, height: 30.77 },
  { x: 250.612, y: -80.4, width: 10.09, height: 400.001 },
  { x: 1e5 + 0.3, y: -1e5 - 0.7, width: 3.3, height: 9.9 },
];

const filled = (rects: readonly Rect[]): Float32Array => {
  const buffer = createRectBuffer(rects.length);
  rects.forEach((rect, index) => writeRect(buffer, index, rect));
  return buffer;
};

describe("createRectBuffer and writeRect", () => {
  test("lays four floats per rectangle in x, y, width, height order", () => {
    const buffer = createRectBuffer(2);
    expect(buffer.length).toBe(2 * RECT_STRIDE);
    writeRect(buffer, 1, { x: 1, y: 2, width: 3, height: 4 });
    expect(Array.from(buffer)).toEqual([0, 0, 0, 0, 1, 2, 3, 4]);
  });

  test("round-trips a rectangle whose values a float can hold exactly", () => {
    const buffer = createRectBuffer(1);
    const rect: Rect = { x: -5.5, y: 0.25, width: 7.5, height: 3.25 };
    writeRect(buffer, 0, rect);
    expect(readRect(buffer, 0)).toEqual(rect);
  });

  test("rounds a value a float cannot hold, which is the tier's only semantic difference", () => {
    const buffer = createRectBuffer(1);
    const rect: Rect = { x: 0.1, y: 0.2, width: 100.7, height: 50.3 };
    writeRect(buffer, 0, rect);
    expect(readRect(buffer, 0)).not.toEqual(rect);
    expect(readRect(buffer, 0)).toEqual({
      x: Math.fround(rect.x),
      y: Math.fround(rect.y),
      width: Math.fround(rect.width),
      height: Math.fround(rect.height),
    });
  });

  test("writes only its own slot", () => {
    const buffer = filled(exact);
    writeRect(buffer, 2, { x: 9, y: 9, width: 9, height: 9 });
    expect(readRect(buffer, 1)).toEqual(exact[1]);
    expect(readRect(buffer, 3)).toEqual(exact[3]);
  });
});

describe("boundsOfRects", () => {
  test("returns null for an empty range", () => {
    expect(boundsOfRects(createRectBuffer(4), 0)).toBe(null);
  });

  test("equals unionRects exactly when every value fits a float", () => {
    const buffer = filled(exact);
    [1, 2, 3, exact.length].forEach((count) =>
      expect(boundsOfRects(buffer, count)).toEqual(unionRects(exact.slice(0, count))),
    );
  });

  test("equals unionRects within the float tolerance for values that do not", () => {
    const buffer = filled(arbitrary);
    const fromBuffer = boundsOfRects(buffer, arbitrary.length)!;
    const fromObjects = unionRects(arbitrary)!;
    expect(fromBuffer).not.toEqual(fromObjects);
    expect(approxEqualsRect(Rect(fromBuffer), Rect(fromObjects), 1e-6)).toBe(true);
  });

  test("ignores rectangles past the count", () => {
    const buffer = filled(exact);
    expect(boundsOfRects(buffer, 1)).toEqual(exact[0]);
  });
});

describe("nearestIndices", () => {
  test("orders by the distance from the point to the rectangle, zero when inside", () => {
    const buffer = filled(exact);
    const point = d.vec2f(10, 10);
    const expected = exact
      .map((rect, index) => ({
        index,
        distance: distanceToRect(Rect(rect), point),
      }))
      .toSorted((left, right) => left.distance - right.distance || left.index - right.index)
      .map((entry) => entry.index);
    expect(nearestIndices(buffer, exact.length, point)).toEqual(expected);
  });

  test("drops anything past the maximum distance", () => {
    const buffer = filled(exact);
    const near = nearestIndices(buffer, exact.length, d.vec2f(10, 10), Infinity, 20);
    near.forEach((index) =>
      expect(distanceToRect(Rect(exact[index]!), d.vec2f(10, 10))).toBeLessThanOrEqual(20),
    );
    expect(near.length).toBeLessThan(exact.length);
  });

  test("returns at most the limit, keeping the closest", () => {
    const buffer = filled(exact);
    const all = nearestIndices(buffer, exact.length, d.vec2f(10, 10));
    expect(nearestIndices(buffer, exact.length, d.vec2f(10, 10), 2)).toEqual(all.slice(0, 2));
  });

  test("returns nothing when every rectangle is out of reach", () => {
    const buffer = filled(exact);
    expect(nearestIndices(buffer, exact.length, d.vec2f(1e6, 1e6), Infinity, 1)).toEqual([]);
  });
});
