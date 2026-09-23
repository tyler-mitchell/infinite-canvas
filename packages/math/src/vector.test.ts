import { d, std, tgpu } from "typegpu";
import { describe, expect, test } from "vite-plus/test";
import { cross2, magSq2, normalize2, perpendicularCCW } from "./vector";

describe("cross2, which std.cross cannot do because it is three-dimensional", () => {
  test("std.cross rejects a pair of two-dimensional vectors", () => {
    expect(() =>
      (std.cross as unknown as (a: d.v2f, b: d.v2f) => number)(d.vec2f(1, 2), d.vec2f(3, 4)),
    ).toThrow();
  });

  test("is positive when the turn from a to b is counter-clockwise", () => {
    expect(cross2(d.vec2f(1, 0), d.vec2f(0, 1))).toBe(1);
    expect(cross2(d.vec2f(0, 1), d.vec2f(1, 0))).toBe(-1);
  });

  test("is zero for parallel vectors, whichever way they point", () => {
    expect(cross2(d.vec2f(3, 6), d.vec2f(1, 2))).toBe(0);
    expect(cross2(d.vec2f(3, 6), d.vec2f(-1, -2))).toBe(0);
  });

  test("satisfies the Lagrange identity against the dot product", () => {
    const a = d.vec2f(3, -4);
    const b = d.vec2f(-5, 12);
    const squared = std.dot(a, a) * std.dot(b, b);
    expect(cross2(a, b) ** 2 + std.dot(a, b) ** 2).toBeCloseTo(squared, 3);
  });
});

describe("magSq2", () => {
  test("is the squared length, so it never takes a root", () => {
    expect(magSq2(d.vec2f(3, 4))).toBe(25);
    expect(magSq2(d.vec2f(0, 0))).toBe(0);
  });
});

describe("perpendicularCCW", () => {
  test("turns a quarter-circle counter-clockwise", () => {
    const east = perpendicularCCW(d.vec2f(1, 0));
    expect(east.x === 0).toBe(true);
    expect(east.y).toBe(1);
    expect(perpendicularCCW(d.vec2f(0, 1))).toEqual(d.vec2f(-1, 0));
  });

  test("negating a zero component yields a signed zero, which compares equal but is not identical", () => {
    const east = perpendicularCCW(d.vec2f(1, 0));
    expect(east.x === 0).toBe(true);
    expect(Object.is(east.x, -0)).toBe(true);
  });

  test("keeps the length and leaves no component of the original", () => {
    const vector = d.vec2f(3, -4);
    const turned = perpendicularCCW(vector);
    expect(std.length(turned)).toBeCloseTo(5, 5);
    expect(std.dot(vector, turned)).toBe(0);
  });

  test("four turns return the original", () => {
    const vector = d.vec2f(7, -2);
    expect(
      perpendicularCCW(perpendicularCCW(perpendicularCCW(perpendicularCCW(vector)))),
    ).toEqual(vector);
  });
});

describe("normalize2, which std.normalize cannot do because zero throws", () => {
  test("gives unit length and keeps the direction", () => {
    const unit = normalize2(d.vec2f(3, 4));
    expect(std.length(unit)).toBeCloseTo(1, 5);
    expect(unit.x).toBeCloseTo(0.6, 5);
    expect(unit.y).toBeCloseTo(0.8, 5);
  });

  test("returns the vector unchanged below EPS, where std.normalize throws", () => {
    expect(() => std.normalize(d.vec2f(0, 0))).toThrow(/Finite Math Assumption/);
    expect(normalize2(d.vec2f(0, 0))).toEqual(d.vec2f(0, 0));
  });

  test("agrees with std.normalize everywhere else", () => {
    [d.vec2f(1, 0), d.vec2f(-5, 12), d.vec2f(0.1, -0.2)].forEach((vector) => {
      const mine = normalize2(vector);
      const theirs = std.normalize(vector);
      expect(mine.x).toBeCloseTo(theirs.x, 6);
      expect(mine.y).toBeCloseTo(theirs.y, 6);
    });
  });
});

describe("the vector functions resolve to WGSL", () => {
  test("each one is a named function in the output", () => {
    const wgsl = tgpu.resolve([cross2, perpendicularCCW, normalize2]);
    expect(wgsl).toContain("fn cross2");
    expect(wgsl).toContain("fn perpendicularCCW");
    expect(wgsl).toContain("fn normalize2");
  });
});
