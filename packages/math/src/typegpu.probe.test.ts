import { d, std, tgpu } from "typegpu";
import { describe, expect, test } from "vite-plus/test";

describe("what a d vector stores on the CPU", () => {
  test("rounds to f32, so the CPU holds the same value the shader will", () => {
    const vector = d.vec2f(0.1, 100.7);
    expect(vector.x).toBe(Math.fround(0.1));
    expect(vector.x).not.toBe(0.1);
    expect(vector.y).toBe(Math.fround(100.7));
  });

  test("survives a round trip through a buffer-shaped typed array unchanged", () => {
    const bytes = new Float32Array(2);
    const vector = d.vec2f(0.1, 100.7);
    bytes[0] = vector.x;
    bytes[1] = vector.y;
    expect(bytes[0]).toBe(vector.x);
    expect(bytes[1]).toBe(vector.y);
  });
});

describe("what std does on the CPU", () => {
  test("computes in f32, which is what the shader will compute", () => {
    const sum = std.add(d.vec2f(0.1, 0.2), d.vec2f(0.2, 0.1));
    expect(sum.x).toBe(Math.fround(Math.fround(0.1) + Math.fround(0.2)));
    expect(sum.x).not.toBe(0.1 + 0.2);
  });

  test("a plain double-precision equivalent disagrees, which is the trap this avoids", () => {
    const widths = [0.1, 100.7, 30.33, 250.612];
    const asDoubles = widths.reduce((total, width) => total + width, 0);
    const asFloats = widths.reduce(
      (total, width) => std.add(d.vec2f(total, 0), d.vec2f(width, 0)).x,
      0,
    );
    expect(asFloats).not.toBe(asDoubles);
    expect(asFloats).toBeCloseTo(asDoubles, 3);
  });

  test("agrees with the arithmetic it replaces, within f32", () => {
    expect(std.dot(d.vec2f(3, 4), d.vec2f(5, 6))).toBe(3 * 5 + 4 * 6);
    expect(std.length(d.vec2f(3, 4))).toBe(Math.hypot(3, 4));
    expect(std.distance(d.vec2f(1, 2), d.vec2f(4, 6))).toBe(Math.hypot(3, 4));
    expect(std.clamp(5, 0, 3)).toBe(3);
    expect(std.mix(2, 10, 0.25)).toBe(4);
  });
});

describe("resolving a use gpu function to WGSL without a device", () => {
  const lengthSquared = tgpu.fn(
    [d.vec2f],
    d.f32,
  )((v) => {
    "use gpu";
    return std.dot(v, v);
  });

  test("produces WGSL text headlessly, so the GPU side is testable in this suite", () => {
    const wgsl = tgpu.resolve([lengthSquared]);
    expect(wgsl).toContain("fn lengthSquared");
    expect(wgsl).toContain("vec2f");
    expect(wgsl).toContain("dot(");
  });

  test("the same function still runs on the CPU", () => {
    expect(lengthSquared(d.vec2f(3, 4))).toBe(25);
  });
});

describe("a rectangle as a GPU-shaped value", () => {
  const Rect = d.struct({ position: d.vec2f, size: d.vec2f });

  test("is constructible and readable on the CPU", () => {
    const rect = Rect({ position: d.vec2f(10, 20), size: d.vec2f(100, 50) });
    expect(rect.position.x).toBe(10);
    expect(rect.size.y).toBe(50);
  });

  test("occupies four floats with no padding, matching the stride already chosen", () => {
    expect(d.sizeOf(Rect)).toBe(16);
    expect(d.alignmentOf(Rect)).toBe(8);
    expect(d.sizeOf(d.arrayOf(Rect, 4))).toBe(64);
  });

  test("a use gpu function over it resolves to WGSL and runs on the CPU", () => {
    const area = tgpu.fn(
      [Rect],
      d.f32,
    )((rect) => {
      "use gpu";
      return rect.size.x * rect.size.y;
    });
    expect(area(Rect({ position: d.vec2f(0, 0), size: d.vec2f(4, 5) }))).toBe(20);
    expect(tgpu.resolve([area])).toContain("fn area");
  });
});
