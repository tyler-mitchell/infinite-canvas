import { d, std, tgpu } from "typegpu";
import { describe, expect, test } from "vite-plus/test";
import { clamp, eqDeltaScaled, EPS, norm, roundTo } from "./scalar";

describe("a declared f32 return rounds once, which is why every export is a tgpu.fn", () => {
  test("the result is the f32 the GPU would hold, not the f64 the CPU computed", () => {
    expect(norm(7.3, 0, 1)).toBe(Math.fround(7.3));
    expect(norm(7.3, 0, 1)).not.toBe(7.3);
  });

  test("an f32-exact value is unchanged, so the rounding is invisible where it does not matter", () => {
    [0, 1, 0.5, 0.25, -64, 1024].forEach((value) => expect(norm(value, 0, 1)).toBe(value));
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

describe("norm undoes std.mix", () => {
  test("maps the ends to zero and one", () => {
    expect(norm(20, 20, 80)).toBe(0);
    expect(norm(80, 20, 80)).toBe(1);
    expect(norm(50, 20, 80)).toBe(0.5);
  });

  test("round-trips through std.mix", () => {
    [0, 0.25, 0.5, 1, 1.5, -0.5].forEach((amount) => {
      const value = std.mix(20, 80, amount);
      expect(norm(value, 20, 80)).toBeCloseTo(amount, 6);
    });
  });

  test("returns zero rather than dividing by zero on an empty range", () => {
    expect(norm(7, 7, 7)).toBe(0);
    expect(norm(100, 7, 7)).toBe(0);
  });

  test("extrapolates outside the range", () => {
    expect(norm(110, 20, 80)).toBeCloseTo(1.5, 6);
    expect(norm(-10, 20, 80)).toBeCloseTo(-0.5, 6);
  });
});

describe("roundTo", () => {
  test("snaps to the nearest multiple of the step", () => {
    expect(roundTo(7, 5)).toBe(5);
    expect(roundTo(8, 5)).toBe(10);
    expect(roundTo(-7, 5)).toBe(-5);
  });

  test("a step of zero divides by zero, exactly as upstream does", () => {
    expect(() => roundTo(7.3, 0)).toThrow(/Finite Math Assumption/);
  });

  test("handles a fractional step", () => {
    expect(roundTo(0.26, 0.25)).toBeCloseTo(0.25, 6);
    expect(roundTo(0.4, 0.25)).toBeCloseTo(0.5, 6);
  });
});

describe("eqDeltaScaled scales its tolerance with magnitude", () => {
  test("accepts a small absolute difference near zero", () => {
    expect(eqDeltaScaled(0, 1e-9, EPS)).toBe(true);
    expect(eqDeltaScaled(0, 1e-3, EPS)).toBe(false);
  });

  test("accepts a proportionally small difference at a large magnitude", () => {
    expect(eqDeltaScaled(1e6, 1e6 + 0.5, EPS)).toBe(true);
    expect(eqDeltaScaled(1e6, 1e6 + 100, EPS)).toBe(false);
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
    const wgsl = tgpu.resolve([snapInside, eqDeltaScaled]);
    expect(wgsl).toContain("fn snapInside");
    expect(wgsl).toContain("fn eqDeltaScaled");
    expect(wgsl).toContain("clamp");
  });
});
