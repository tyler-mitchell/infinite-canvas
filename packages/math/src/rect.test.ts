import { d } from "typegpu";
import { describe, expect, test } from "vite-plus/test";
import {
  alignRectIn,
  approxEqualsRect,
  areaOfRect,
  aspectRatioOfRect,
  centerOfRect,
  clampPointToRect,
  clampRectWithin,
  containsPoint,
  containsRect,
  distanceToRect,
  gapBetweenRects,
  insetRect,
  insetRectBy,
  Insets,
  intersectionRect,
  intersectsRect,
  lerpRect,
  outsetRect,
  outsetRectBy,
  overlapsRect,
  Rect,
  rectBottom,
  rectRight,
  resizeRect,
  scaleRectAbout,
  translateRect,
  unionRect,
  unionRects,
  type ResizeHandle,
} from "./rect";
import { intervalEnd } from "./interval";

const rect = Rect({ x: 0, y: 0, width: 100, height: 50 });

describe("rectRight and rectBottom read the far edge through intervalEnd", () => {
  test("give the far edge on each axis", () => {
    expect(rectRight(rect)).toBe(100);
    expect(rectBottom(rect)).toBe(50);
  });

  test("carry the position, so they are not the extent", () => {
    const moved = Rect({ x: -30, y: 12, width: 100, height: 50 });
    expect(rectRight(moved)).toBe(70);
    expect(rectBottom(moved)).toBe(62);
  });

  test("agree with intervalEnd, which owns the rule", () => {
    const moved = Rect({ x: -30, y: 12, width: 100, height: 50 });
    expect(rectRight(moved)).toBe(intervalEnd(moved.x, moved.width));
    expect(rectBottom(moved)).toBe(intervalEnd(moved.y, moved.height));
  });
});

describe("unionRect", () => {
  test("covers both rectangles", () => {
    const left = Rect({ x: 0, y: 0, width: 10, height: 10 });
    const right = Rect({ x: 90, y: 40, width: 10, height: 10 });
    expect(unionRect(left, right)).toEqual(Rect({ x: 0, y: 0, width: 100, height: 50 }));
  });

  test("returns the outer rectangle when one contains the other", () => {
    const inner = Rect({ x: 20, y: 10, width: 10, height: 10 });
    expect(unionRect(rect, inner)).toEqual(rect);
    expect(unionRect(inner, rect)).toEqual(rect);
  });

  test("is the same either way round", () => {
    const other = Rect({ x: -40, y: 30, width: 20, height: 90 });
    expect(unionRect(rect, other)).toEqual(unionRect(other, rect));
  });

  test("agrees with unionRects over the same pair", () => {
    const other = Rect({ x: -40, y: 30, width: 20, height: 90 });
    expect(unionRect(rect, other)).toEqual(unionRects([rect, other]));
  });
});

describe("outsetRect grows where insetRect shrinks", () => {
  const insets = Insets({ top: 5, right: 10, bottom: 15, left: 20 });

  test("moves each edge outward by its own inset", () => {
    expect(outsetRect(rect, insets)).toEqual(Rect({ x: -20, y: -5, width: 130, height: 70 }));
  });

  test("undoes insetRect exactly", () => {
    expect(outsetRect(insetRect(rect, insets), insets)).toEqual(rect);
  });

  test("a zero inset changes nothing", () => {
    expect(outsetRect(rect, Insets({ top: 0, right: 0, bottom: 0, left: 0 }))).toEqual(rect);
  });

  test("outsetRectBy is the uniform case", () => {
    const uniform = Insets({ top: 7, right: 7, bottom: 7, left: 7 });
    expect(outsetRect(rect, uniform)).toEqual(outsetRectBy(rect, 7));
  });
});

describe("aspectRatioOfRect", () => {
  test("is width over height", () => {
    expect(aspectRatioOfRect(rect)).toBe(2);
    expect(aspectRatioOfRect(Rect({ x: 0, y: 0, width: 50, height: 100 }))).toBe(0.5);
    expect(aspectRatioOfRect(Rect({ x: 0, y: 0, width: 30, height: 30 }))).toBe(1);
  });

  test("ignores position", () => {
    expect(aspectRatioOfRect(Rect({ x: -400, y: 900, width: 100, height: 50 }))).toBe(2);
  });

  test("returns zero for a collapsed rectangle rather than a value f32 cannot hold", () => {
    expect(aspectRatioOfRect(Rect({ x: 0, y: 0, width: 100, height: 0 }))).toBe(0);
    expect(aspectRatioOfRect(Rect({ x: 0, y: 0, width: 0, height: 0 }))).toBe(0);
  });

  test("a zero width is an ordinary ratio of zero, not the collapsed case", () => {
    expect(aspectRatioOfRect(Rect({ x: 0, y: 0, width: 0, height: 50 }))).toBe(0);
  });
});
const at = (x: number, y: number, width: number, height: number) => Rect({ x, y, width, height });

describe("containsPoint", () => {
  test("counts the boundary", () => {
    expect(containsPoint(rect, d.vec2f(100, 50))).toBe(true);
    expect(containsPoint(rect, d.vec2f(104, 50))).toBe(false);
  });

  test("grows by an outset instead of a padding argument", () => {
    expect(containsPoint(outsetRectBy(rect, 5), d.vec2f(104, 50))).toBe(true);
  });
});

describe("containsRect", () => {
  test("counts a rectangle equal to the container", () => {
    expect(containsRect(rect, Rect(rect))).toBe(true);
  });

  test("rejects a rectangle that crosses any edge", () => {
    expect(containsRect(rect, at(10, 10, 100, 10))).toBe(false);
    expect(containsRect(rect, at(-1, 10, 10, 10))).toBe(false);
  });
});

describe("intersectsRect and overlapsRect", () => {
  const touching = at(100, 0, 10, 50);

  test("differ on edge contact: intersects counts it, overlaps needs area", () => {
    expect(intersectsRect(rect, touching)).toBe(true);
    expect(overlapsRect(rect, touching)).toBe(false);
  });

  test("agree once the rectangles share area", () => {
    expect(intersectsRect(rect, at(99, 0, 10, 50))).toBe(true);
    expect(overlapsRect(rect, at(99, 0, 10, 50))).toBe(true);
  });

  test("agree when the rectangles are apart", () => {
    expect(intersectsRect(rect, at(200, 0, 10, 50))).toBe(false);
    expect(overlapsRect(rect, at(200, 0, 10, 50))).toBe(false);
  });
});

describe("intersectionRect", () => {
  test("returns the shared area and reports that it overlaps", () => {
    const found = intersectionRect(rect, at(50, 25, 100, 100));
    expect(found.overlaps).toBe(true);
    expect(found.rect).toEqual(at(50, 25, 50, 25));
  });

  test("reports edge contact as overlapping with a zero extent", () => {
    const found = intersectionRect(rect, at(100, 0, 10, 50));
    expect(found.overlaps).toBe(true);
    expect(found.rect.width).toBe(0);
  });

  test("reports no overlap instead of returning null", () => {
    expect(intersectionRect(rect, at(200, 0, 10, 50)).overlaps).toBe(false);
  });
});

describe("unionRects", () => {
  test("returns null for an empty list", () => {
    expect(unionRects([])).toBe(null);
  });

  test("covers every rectangle", () => {
    const rects = [at(10, 10, 10, 10), at(-5, 40, 10, 10), at(0, 0, 4, 4)];
    const bounds = unionRects(rects)!;
    rects.forEach((item) => expect(containsRect(bounds, item)).toBe(true));
    expect(bounds).toEqual(at(-5, 0, 25, 50));
  });
});

describe("gapBetweenRects", () => {
  test("is positive when the rectangles are apart on that axis", () => {
    expect(gapBetweenRects(rect, at(130, 0, 10, 50)).x).toBe(30);
  });

  test("is the negated overlap when they share area", () => {
    const gap = gapBetweenRects(rect, at(90, 40, 100, 100));
    expect(gap.x).toBe(-10);
    expect(gap.y).toBe(-10);
  });
});

describe("insetRect and outsetRect", () => {
  test("inset moves the minimum edges in and shrinks the extents", () => {
    expect(insetRectBy(rect, 10)).toEqual(at(10, 10, 80, 30));
    expect(insetRect(rect, Insets({ top: 1, right: 2, bottom: 3, left: 4 }))).toEqual(
      at(4, 1, 94, 46),
    );
  });

  test("inset floors the extent at zero rather than producing a negative rectangle", () => {
    expect(insetRectBy(rect, 60)).toEqual(at(60, 60, 0, 0));
  });

  test("outset is the inverse of inset while nothing is floored", () => {
    expect(outsetRectBy(insetRectBy(rect, 10), 10)).toEqual(rect);
    expect(outsetRectBy(rect, 5)).toEqual(at(-5, -5, 110, 60));
  });
});

describe("translateRect and scaleRectAbout", () => {
  test("translate keeps the extents", () => {
    expect(translateRect(rect, d.vec2f(5, -5))).toEqual(at(5, -5, 100, 50));
  });

  test("scale about a point leaves that point where it was", () => {
    const origin = d.vec2f(25, 10);
    const scaled = scaleRectAbout(rect, origin, 3);
    const fixed = scaleRectAbout(at(origin.x, origin.y, 0, 0), origin, 3);
    expect(fixed).toEqual(at(origin.x, origin.y, 0, 0));
    expect((origin.x - scaled.x) / scaled.width).toBeCloseTo((origin.x - rect.x) / rect.width, 5);
    expect((origin.y - scaled.y) / scaled.height).toBeCloseTo((origin.y - rect.y) / rect.height, 5);
  });
});

describe("clampPointToRect, distanceToRect and clampRectWithin", () => {
  test("clamp a point onto the nearest edge of a rectangle away from the origin", () => {
    const offset = at(30, 60, 100, 50);
    expect(clampPointToRect(d.vec2f(-10, 500), offset)).toEqual(d.vec2f(30, 110));
    expect(clampPointToRect(d.vec2f(500, 0), offset)).toEqual(d.vec2f(130, 60));
  });

  test("distance is zero inside and the clamped distance outside", () => {
    expect(distanceToRect(rect, d.vec2f(50, 25))).toBe(0);
    expect(distanceToRect(rect, d.vec2f(103, 54))).toBe(5);
  });

  test("move a rectangle inside the bounds without resizing it", () => {
    expect(clampRectWithin(at(180, -20, 100, 50), at(0, 0, 200, 200))).toEqual(at(100, 0, 100, 50));
  });

  test("align a rectangle larger than the bounds to the minimum edge, from either side", () => {
    const bounds = at(10, 10, 50, 20);
    expect(clampRectWithin(rect, bounds)).toEqual(at(10, 10, 100, 50));
    expect(clampRectWithin(at(400, 400, 100, 50), bounds)).toEqual(at(10, 10, 100, 50));
  });
});

describe("alignRectIn", () => {
  test("places by fraction, so zero is the start, one half the centre and one the end", () => {
    const bounds = at(0, 0, 200, 100);
    const size = d.vec2f(50, 20);
    expect(alignRectIn(bounds, size, d.vec2f(0, 0))).toEqual(at(0, 0, 50, 20));
    expect(alignRectIn(bounds, size, d.vec2f(0.5, 0.5))).toEqual(at(75, 40, 50, 20));
    expect(alignRectIn(bounds, size, d.vec2f(1, 1))).toEqual(at(150, 80, 50, 20));
  });
});

describe("approxEqualsRect", () => {
  test("accepts a difference under the epsilon and rejects one over it", () => {
    expect(approxEqualsRect(rect, Rect({ ...rect, x: 1e-9 }), 1e-6)).toBe(true);
    expect(approxEqualsRect(rect, Rect({ ...rect, x: 0.5 }), 1)).toBe(true);
  });

  test("compares every field", () => {
    (["x", "y", "width", "height"] as const).forEach((field) =>
      expect(approxEqualsRect(rect, Rect({ ...rect, [field]: rect[field] + 0.5 }), 1e-6)).toBe(
        false,
      ),
    );
  });
});

describe("lerpRect", () => {
  test("returns each endpoint exactly", () => {
    const from = at(0.2, 1.1, 2.3, 0.7);
    const to = at(0.9, 0.3, 0.9, 0.3);
    expect(lerpRect(from, to, 0, 0)).toEqual(from);
    expect(lerpRect(from, to, 1, 1)).toEqual(to);
  });

  test("moves position and size at separate rates", () => {
    expect(lerpRect(at(0, 0, 0, 0), at(100, 100, 100, 100), 1, 0)).toEqual(at(100, 100, 0, 0));
  });
});

describe("resizeRect", () => {
  const base = at(20, 40, 300, 200);
  const minSize = d.vec2f(60, 30);

  test("grows from the handle's own edge and keeps the opposite edge fixed", () => {
    expect(resizeRect({ rect: base, handle: "east", delta: d.vec2f(30, 0), minSize })).toEqual(
      at(20, 40, 330, 200),
    );
    expect(resizeRect({ rect: base, handle: "west", delta: d.vec2f(-30, 0), minSize })).toEqual(
      at(-10, 40, 330, 200),
    );
  });

  test("stops at the minimum and the maximum size", () => {
    expect(resizeRect({ rect: base, handle: "east", delta: d.vec2f(-500, 0), minSize }).width).toBe(
      60,
    );
    expect(
      resizeRect({
        rect: base,
        handle: "south-east",
        delta: d.vec2f(500, 500),
        minSize,
        maxSize: d.vec2f(320, 210),
      }),
    ).toEqual(at(20, 40, 320, 210));
  });

  test("lets the minimum win when the limits cross, as CSS sizing requires", () => {
    expect(
      resizeRect({
        rect: base,
        handle: "east",
        delta: d.vec2f(0, 0),
        minSize,
        maxSize: d.vec2f(10, 5),
      }),
    ).toEqual(at(20, 40, 60, 30));
  });

  test("keeps the aspect ratio on every handle", () => {
    const handles: readonly ResizeHandle[] = [
      "north",
      "south",
      "east",
      "west",
      "north-east",
      "north-west",
      "south-east",
      "south-west",
    ];
    handles.forEach((handle) => {
      const resized = resizeRect({
        rect: base,
        handle,
        delta: d.vec2f(37, -23),
        minSize,
        aspectRatio: 2,
      });
      expect(resized.width / resized.height).toBeCloseTo(2, 4);
    });
  });

  test("keeps a zero or negative aspect ratio from poisoning the result with NaN", () => {
    [0, -2].forEach((aspectRatio) => {
      const resized = resizeRect({
        rect: base,
        handle: "south-east",
        delta: d.vec2f(37, -23),
        minSize,
        aspectRatio,
      });
      expect(Number.isFinite(resized.width)).toBe(true);
      expect(Number.isFinite(resized.height)).toBe(true);
    });
  });
});

describe("centerOfRect, areaOfRect", () => {
  test("report the centre and the area", () => {
    expect(centerOfRect(rect)).toEqual(d.vec2f(50, 25));
    expect(areaOfRect(rect)).toBe(5000);
  });
});
