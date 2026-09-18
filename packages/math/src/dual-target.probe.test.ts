import { d, std, tgpu } from "typegpu";
import { describe, expect, test } from "vite-plus/test";

const Rect = d.struct({ position: d.vec2f, size: d.vec2f });
const Pieces = d.struct({ items: d.arrayOf(Rect, 4), count: d.u32 });

const containsPoint = tgpu.fn(
  [Rect, d.vec2f],
  d.u32,
)((rect, point) => {
  "use gpu";
  const inside =
    point.x >= rect.position.x &&
    point.x <= rect.position.x + rect.size.x &&
    point.y >= rect.position.y &&
    point.y <= rect.position.y + rect.size.y;
  return std.select(d.u32(0), d.u32(1), inside);
});

const overlapsRect = tgpu.fn(
  [Rect, Rect],
  d.u32,
)((rect, other) => {
  "use gpu";
  const shares =
    rect.position.x < other.position.x + other.size.x &&
    rect.position.x + rect.size.x > other.position.x &&
    rect.position.y < other.position.y + other.size.y &&
    rect.position.y + rect.size.y > other.position.y;
  return std.select(d.u32(0), d.u32(1), shares);
});

const boundsOfRange = tgpu.fn(
  [d.u32],
  d.vec2f,
)((count) => {
  "use gpu";
  let widest = d.f32(0);
  for (let index = d.u32(0); index < count; index++) {
    widest = std.max(widest, d.f32(index));
  }
  return d.vec2f(widest, d.f32(count));
});

describe("operations whose output shape is statically known", () => {
  test("a rectangle predicate resolves to WGSL and runs on the CPU", () => {
    const rect = Rect({ position: d.vec2f(0, 0), size: d.vec2f(100, 50) });
    expect(containsPoint(rect, d.vec2f(50, 25))).toBe(1);
    expect(containsPoint(rect, d.vec2f(150, 25))).toBe(0);
    expect(tgpu.resolve([containsPoint])).toContain("fn containsPoint");
  });

  test("edge-exclusive overlap resolves too, and keeps its edge rule", () => {
    const rect = Rect({ position: d.vec2f(0, 0), size: d.vec2f(100, 50) });
    const touching = Rect({ position: d.vec2f(100, 0), size: d.vec2f(10, 50) });
    expect(overlapsRect(rect, touching)).toBe(0);
    expect(tgpu.resolve([overlapsRect])).toContain("fn overlapsRect");
  });

  test("a runtime-bounded loop resolves, so reductions over a range are dual-target", () => {
    expect(boundsOfRange(4)).toEqual(d.vec2f(3, 4));
    const wgsl = tgpu.resolve([boundsOfRange]);
    expect(wgsl).toContain("fn boundsOfRange");
    expect(wgsl).toContain("for");
  });
});

describe("a variable-length result, reshaped to a fixed capacity plus a count", () => {
  const subtractRect = tgpu.fn(
    [Rect, Rect],
    Pieces,
  )((rect, other) => {
    "use gpu";
    const pieces = d.arrayOf(Rect, 4)();
    let count = d.u32(0);
    const right = rect.position.x + rect.size.x;
    const bottom = rect.position.y + rect.size.y;
    const otherRight = other.position.x + other.size.x;
    const otherBottom = other.position.y + other.size.y;
    if (overlapsRect(rect, other) === d.u32(0)) {
      pieces[0] = Rect(rect);
      return Pieces({ items: pieces, count: d.u32(1) });
    }
    if (other.position.y > rect.position.y) {
      pieces[count] = Rect({
        position: rect.position,
        size: d.vec2f(rect.size.x, other.position.y - rect.position.y),
      });
      count++;
    }
    if (otherBottom < bottom) {
      pieces[count] = Rect({
        position: d.vec2f(rect.position.x, otherBottom),
        size: d.vec2f(rect.size.x, bottom - otherBottom),
      });
      count++;
    }
    if (other.position.x > rect.position.x) {
      pieces[count] = Rect({
        position: rect.position,
        size: d.vec2f(other.position.x - rect.position.x, rect.size.y),
      });
      count++;
    }
    if (otherRight < right) {
      pieces[count] = Rect({
        position: d.vec2f(otherRight, rect.position.y),
        size: d.vec2f(right - otherRight, rect.size.y),
      });
      count++;
    }
    return Pieces({ items: pieces, count });
  });

  test("resolves to WGSL", () => {
    expect(tgpu.resolve([subtractRect])).toContain("fn subtractRect");
  });

  test("runs on the CPU with the same maximal-rectangle answer as the object tier", () => {
    const rect = Rect({ position: d.vec2f(0, 0), size: d.vec2f(100, 100) });
    const hole = Rect({ position: d.vec2f(40, 40), size: d.vec2f(20, 20) });
    const result = subtractRect(rect, hole);
    expect(result.count).toBe(4);
    expect(result.items[0]!.size).toEqual(d.vec2f(100, 40));
    expect(result.items[1]!.position).toEqual(d.vec2f(0, 60));
    expect(result.items[2]!.size).toEqual(d.vec2f(40, 100));
    expect(result.items[3]!.position).toEqual(d.vec2f(60, 0));
  });

  test("returns the whole rectangle when the two do not overlap", () => {
    const rect = Rect({ position: d.vec2f(0, 0), size: d.vec2f(100, 100) });
    const apart = Rect({ position: d.vec2f(200, 0), size: d.vec2f(10, 10) });
    const result = subtractRect(rect, apart);
    expect(result.count).toBe(1);
    expect(result.items[0]).toEqual(rect);
  });
});
