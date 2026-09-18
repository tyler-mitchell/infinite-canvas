import { d } from "typegpu";
import { describe, expect, test } from "vite-plus/test";
import {
  alignInInterval,
  clampIntervalWithin,
  clampToInterval,
  containsInterval,
  containsValue,
  gapBetweenIntervals,
  insetIntervalLength,
  insetIntervalStart,
  intersectionLength,
  intersectionStart,
  intersectsInterval,
  overlapsInterval,
  scaleIntervalAbout,
  unionLength,
  unionStart,
} from "./interval";
import { containsPoint, containsRect, intersectsRect, overlapsRect, Rect } from "./rect";

describe("intersectionStart and unionStart pick opposite ends", () => {
  test("the intersection begins at the later start, the union at the earlier", () => {
    expect(intersectionStart(10, 40)).toBe(40);
    expect(unionStart(10, 40)).toBe(10);
  });

  test("both are the same value when the starts agree", () => {
    expect(intersectionStart(25, 25)).toBe(25);
    expect(unionStart(25, 25)).toBe(25);
  });

  test("order of arguments does not matter", () => {
    expect(intersectionStart(40, 10)).toBe(intersectionStart(10, 40));
    expect(unionStart(40, 10)).toBe(unionStart(10, 40));
  });
});

describe("unionLength spans both intervals", () => {
  test("reaches from the earlier start to the later end", () => {
    expect(unionLength(0, 10, 90, 10)).toBe(100);
  });

  test("is the outer length when one contains the other", () => {
    expect(unionLength(0, 100, 20, 10)).toBe(100);
    expect(unionLength(20, 10, 0, 100)).toBe(100);
  });

  test("pairs with unionStart to give the covering interval", () => {
    const start = unionStart(30, -20);
    expect(start).toBe(-20);
    expect(start + unionLength(30, 10, -20, 5)).toBe(40);
  });
});

describe("insetIntervalStart moves the near edge inward", () => {
  test("adds the leading inset", () => {
    expect(insetIntervalStart(100, 10)).toBe(110);
  });

  test("a negative inset outsets instead", () => {
    expect(insetIntervalStart(100, -10)).toBe(90);
  });

  test("pairs with insetIntervalLength, which floors the extent at zero", () => {
    expect(insetIntervalStart(0, 60)).toBe(60);
    expect(insetIntervalLength(100, 60, 60)).toBe(0);
  });
});

describe("scaleIntervalAbout holds the origin still", () => {
  test("leaves a start already at the origin alone", () => {
    expect(scaleIntervalAbout(50, 50, 3)).toBe(50);
  });

  test("moves a start away from the origin by the factor", () => {
    expect(scaleIntervalAbout(60, 50, 2)).toBe(70);
    expect(scaleIntervalAbout(40, 50, 2)).toBe(30);
  });

  test("a factor of one changes nothing, and zero collapses to the origin", () => {
    expect(scaleIntervalAbout(60, 50, 1)).toBe(60);
    expect(scaleIntervalAbout(60, 50, 0)).toBe(50);
  });
});

describe("the edge rules, stated once each", () => {
  test("containsValue counts both ends", () => {
    expect(containsValue(0, 100, 0)).toBe(true);
    expect(containsValue(0, 100, 100)).toBe(true);
    expect(containsValue(0, 100, 100.5)).toBe(false);
  });

  test("intersectsInterval counts touching, overlapsInterval does not", () => {
    expect(intersectsInterval(0, 100, 100, 10)).toBe(true);
    expect(overlapsInterval(0, 100, 100, 10)).toBe(false);
    expect(intersectsInterval(0, 100, 99, 10)).toBe(true);
    expect(overlapsInterval(0, 100, 99, 10)).toBe(true);
  });

  test("containsInterval counts an equal interval", () => {
    expect(containsInterval(0, 100, 0, 100)).toBe(true);
    expect(containsInterval(0, 100, 0, 101)).toBe(false);
  });

  test("gapBetweenIntervals is positive apart and negative overlapping", () => {
    expect(gapBetweenIntervals(0, 100, 130, 10)).toBe(30);
    expect(gapBetweenIntervals(0, 100, 90, 100)).toBe(-10);
  });

  test("intersectionLength is negative when the intervals are apart", () => {
    expect(intersectionLength(0, 100, 130, 10)).toBe(-30);
    expect(intersectionLength(0, 100, 50, 100)).toBe(50);
  });

  test("insetIntervalLength floors at zero", () => {
    expect(insetIntervalLength(100, 60, 60)).toBe(0);
    expect(insetIntervalLength(100, 10, 20)).toBe(70);
  });

  test("clampIntervalWithin gives the minimum priority when the interval does not fit", () => {
    expect(clampIntervalWithin(400, 100, 10, 50)).toBe(10);
    expect(clampIntervalWithin(180, 100, 0, 200)).toBe(100);
  });

  test("clampToInterval lands on the nearer end", () => {
    expect(clampToInterval(-10, 30, 100)).toBe(30);
    expect(clampToInterval(500, 30, 100)).toBe(130);
  });

  test("clampToInterval gives the start priority when the length is negative", () => {
    expect(clampToInterval(500, 30, -100)).toBe(30);
    expect(clampToInterval(-500, 30, -100)).toBe(30);
  });

  test("alignInInterval places by fraction", () => {
    expect(alignInInterval(0, 200, 50, 0)).toBe(0);
    expect(alignInInterval(0, 200, 50, 0.5)).toBe(75);
    expect(alignInInterval(0, 200, 50, 1)).toBe(150);
  });
});

describe("the rectangle predicates are exactly two interval calls", () => {
  const rects = [
    Rect({ x: 0, y: 0, width: 100, height: 50 }),
    Rect({ x: 100, y: 0, width: 10, height: 50 }),
    Rect({ x: -20, y: 10, width: 400, height: 5 }),
    Rect({ x: 30, y: 60, width: 10, height: 10 }),
  ];

  test("containsPoint agrees with containsValue on both axes", () => {
    rects.forEach((rect) =>
      [d.vec2f(0, 0), d.vec2f(100, 50), d.vec2f(35, 62), d.vec2f(-5, 12)].forEach((point) =>
        expect(containsPoint(rect, point)).toBe(
          containsValue(rect.x, rect.width, point.x) && containsValue(rect.y, rect.height, point.y),
        ),
      ),
    );
  });

  test("containsRect, intersectsRect and overlapsRect each agree with their kernel", () => {
    rects.forEach((rect) =>
      rects.forEach((other) => {
        expect(containsRect(rect, other)).toBe(
          containsInterval(rect.x, rect.width, other.x, other.width) &&
            containsInterval(rect.y, rect.height, other.y, other.height),
        );
        expect(intersectsRect(rect, other)).toBe(
          intersectsInterval(rect.x, rect.width, other.x, other.width) &&
            intersectsInterval(rect.y, rect.height, other.y, other.height),
        );
        expect(overlapsRect(rect, other)).toBe(
          overlapsInterval(rect.x, rect.width, other.x, other.width) &&
            overlapsInterval(rect.y, rect.height, other.y, other.height),
        );
      }),
    );
  });
});
