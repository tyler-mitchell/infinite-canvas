import { d, std, tgpu } from "typegpu";
import { describe, expect, test } from "vite-plus/test";

const Rect = d.struct({ x: d.f32, y: d.f32, width: d.f32, height: d.f32 });
const Paired = d.struct({ position: d.vec2f, size: d.vec2f });

describe("a rectangle schema that keeps the established field names", () => {
  test("packs into the same sixteen bytes as the paired-vector form", () => {
    expect(d.sizeOf(Rect)).toBe(d.sizeOf(Paired));
    expect(d.sizeOf(Rect)).toBe(16);
    expect(d.sizeOf(d.arrayOf(Rect, 8))).toBe(d.sizeOf(d.arrayOf(Paired, 8)));
  });

  test("keeps x, y, width and height, so no call site has to change", () => {
    const rect = Rect({ x: 10, y: 20, width: 100, height: 50 });
    expect(rect.x).toBe(10);
    expect(rect.width).toBe(100);
  });

  test("still rounds to f32, so it carries the shader's value", () => {
    expect(Rect({ x: 0.1, y: 0, width: 0, height: 0 }).x).toBe(Math.fround(0.1));
  });
});

describe("what a dual-target predicate can return", () => {
  const containsPointBool = tgpu.fn(
    [Rect, d.vec2f],
    d.bool,
  )((rect, point) => {
    "use gpu";
    return (
      point.x >= rect.x &&
      point.x <= rect.x + rect.width &&
      point.y >= rect.y &&
      point.y <= rect.y + rect.height
    );
  });

  test("returns a real boolean, so the API needs no u32 encoding", () => {
    const rect = Rect({ x: 0, y: 0, width: 100, height: 50 });
    expect(containsPointBool(rect, d.vec2f(50, 25))).toBe(true);
    expect(containsPointBool(rect, d.vec2f(150, 25))).toBe(false);
    expect(tgpu.resolve([containsPointBool])).toContain("fn containsPointBool");
  });

  test("boundary points count, matching the object tier's edge rule", () => {
    const rect = Rect({ x: 0, y: 0, width: 100, height: 50 });
    expect(containsPointBool(rect, d.vec2f(100, 50))).toBe(true);
  });
});

describe("vector maths over a scalar-field rectangle", () => {
  const centerOfRect = tgpu.fn(
    [Rect],
    d.vec2f,
  )((rect) => {
    "use gpu";
    return d.vec2f(rect.x + rect.width / 2, rect.y + rect.height / 2);
  });

  const distanceToRect = tgpu.fn(
    [Rect, d.vec2f],
    d.f32,
  )((rect, point) => {
    "use gpu";
    const nearest = d.vec2f(
      std.clamp(point.x, rect.x, rect.x + rect.width),
      std.clamp(point.y, rect.y, rect.y + rect.height),
    );
    return std.distance(point, nearest);
  });

  test("builds a vector from the scalar fields with no allocation cost on the GPU", () => {
    const rect = Rect({ x: 0, y: 0, width: 100, height: 50 });
    expect(centerOfRect(rect)).toEqual(d.vec2f(50, 25));
    expect(tgpu.resolve([centerOfRect])).toContain("fn centerOfRect");
  });

  test("composes std operations, and is zero inside the rectangle", () => {
    const rect = Rect({ x: 0, y: 0, width: 100, height: 50 });
    expect(distanceToRect(rect, d.vec2f(50, 25))).toBe(0);
    expect(distanceToRect(rect, d.vec2f(103, 29))).toBe(3);
    expect(tgpu.resolve([distanceToRect])).toContain("fn distanceToRect");
  });
});
