import { d, std, tgpu } from "typegpu";
import { describe, expect, test } from "vite-plus/test";
import { approxEquals, clamp, EPSILON, inverseLerp, mod, roundTo } from "./scalar";

describe("a declared f32 return rounds once, which is why every export is a tgpu.fn", () => {
  test("the result is the f32 the GPU would hold, not the f64 the CPU computed", () => {
    expect(roundTo(7.3, 0)).toBe(Math.fround(7.3));
    expect(roundTo(7.3, 0)).not.toBe(7.3);
  });

  test("an f32-exact value is unchanged, so the rounding is invisible where it does not matter", () => {
    [0, 1, 0.5, 0.25, -64, 1024].forEach((value) => expect(roundTo(value, 0)).toBe(value));
  });
});

describe("clamp owns the rule that the minimum wins", () => {
  test("holds a value inside the bounds", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(50, 0, 10)).toBe(10);
  });

  test("gives the minimum priority when the bounds cross, where std.clamp does not", () => {
    expect(std.clamp(5, 10, 0)).toBe(0);
    expect(clamp(5, 10, 0)).toBe(10);
  });

  test("agrees with std.clamp whenever the bounds are ordered", () => {
    [-50, -1, 0, 3, 7.5, 10, 99].forEach((value) =>
      expect(clamp(value, 0, 10)).toBe(std.clamp(value, 0, 10)),
    );
  });
});

describe("inverseLerp undoes std.mix", () => {
  test("maps the ends to zero and one", () => {
    expect(inverseLerp(20, 20, 80)).toBe(0);
    expect(inverseLerp(80, 20, 80)).toBe(1);
    expect(inverseLerp(50, 20, 80)).toBe(0.5);
  });

  test("round-trips through std.mix", () => {
    [0, 0.25, 0.5, 1, 1.5, -0.5].forEach((amount) => {
      const value = std.mix(20, 80, amount);
      expect(inverseLerp(value, 20, 80)).toBeCloseTo(amount, 6);
    });
  });

  test("returns zero rather than dividing by zero on an empty range", () => {
    expect(inverseLerp(7, 7, 7)).toBe(0);
    expect(inverseLerp(100, 7, 7)).toBe(0);
  });

  test("extrapolates outside the range", () => {
    expect(inverseLerp(110, 20, 80)).toBeCloseTo(1.5, 6);
    expect(inverseLerp(-10, 20, 80)).toBeCloseTo(-0.5, 6);
  });
});

describe("roundTo", () => {
  test("snaps to the nearest multiple of the step", () => {
    expect(roundTo(7, 5)).toBe(5);
    expect(roundTo(8, 5)).toBe(10);
    expect(roundTo(-7, 5)).toBe(-5);
  });

  test("leaves the value alone when the step is zero or negative", () => {
    expect(roundTo(7.3, 0)).toBe(Math.fround(7.3));
    expect(roundTo(7.3, -5)).toBe(Math.fround(7.3));
  });

  test("guards the division with a branch, because WGSL select would evaluate both sides", () => {
    expect(Number.isFinite(roundTo(7.3, 0))).toBe(true);
  });

  test("handles a fractional step", () => {
    expect(roundTo(0.26, 0.25)).toBeCloseTo(0.25, 6);
    expect(roundTo(0.4, 0.25)).toBeCloseTo(0.5, 6);
  });
});

describe("mod wraps positive, which std.mod does not", () => {
  test("keeps a negative value inside the range", () => {
    expect(std.mod(-5, 4)).toBe(-1);
    expect(mod(-5, 4)).toBe(3);
    expect(mod(-1, 4)).toBe(3);
  });

  test("agrees with std.mod for values already positive", () => {
    [0, 3, 7, 12.5].forEach((value) => expect(mod(value, 4)).toBeCloseTo(std.mod(value, 4), 6));
  });

  test("wraps a full turn back to zero", () => {
    expect(mod(2 * Math.PI, 2 * Math.PI)).toBeCloseTo(0, 6);
    expect(mod(-Math.PI, 2 * Math.PI)).toBeCloseTo(Math.PI, 6);
  });
});

describe("approxEquals scales its tolerance with magnitude", () => {
  test("accepts a small absolute difference near zero", () => {
    expect(approxEquals(0, 1e-9, EPSILON)).toBe(true);
    expect(approxEquals(0, 1e-3, EPSILON)).toBe(false);
  });

  test("accepts a proportionally small difference at a large magnitude", () => {
    expect(approxEquals(1e6, 1e6 + 0.5, EPSILON)).toBe(true);
    expect(approxEquals(1e6, 1e6 + 100, EPSILON)).toBe(false);
  });
});

describe("the scalar rules resolve to WGSL", () => {
  test("a kernel that composes them appears in the output", () => {
    const snapInside = tgpu.fn(
      [d.f32, d.f32, d.f32, d.f32],
      d.f32,
    )((value, low, high, step) => {
      "use gpu";
      return clamp(roundTo(value, step), low, high);
    });
    const wgsl = tgpu.resolve([snapInside, approxEquals]);
    expect(wgsl).toContain("fn snapInside");
    expect(wgsl).toContain("fn approxEquals");
    expect(wgsl).toContain("clamp");
  });
});
