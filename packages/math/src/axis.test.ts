import { d } from "typegpu";
import { describe, expect, test } from "vite-plus/test";
import { axes, placeOnAxis, sizeOnAxis, type Axis } from "./axis";

const rect = { x: 10, y: 20, width: 100, height: 40 };

describe("Size stays a plain f64 pair rather than becoming a d.vec2f", () => {
  test("an unbounded maximum is Infinity, which f32 cannot hold", () => {
    expect(() => d.vec2f(Infinity, 100)).toThrow(/Finite Math Assumption/);
    expect(sizeOnAxis({ axis: "horizontal", main: Infinity, cross: 100 })).toEqual({
      width: Infinity,
      height: 100,
    });
  });
});

describe("axes", () => {
  test("pairs each main field with its own position field and the opposite cross field", () => {
    (["horizontal", "vertical"] as const).forEach((axis) => {
      const fields = axes[axis];
      expect(fields.main).not.toBe(fields.cross);
      expect(fields.mainPosition).not.toBe(fields.crossPosition);
      expect(axes[fields.crossAxis].main).toBe(fields.cross);
      expect(axes[fields.crossAxis].mainPosition).toBe(fields.crossPosition);
    });
  });

  test("reads a rectangle's main extent without a cast", () => {
    expect(rect[axes.horizontal.main]).toBe(100);
    expect(rect[axes.vertical.main]).toBe(40);
    expect(rect[axes.horizontal.mainPosition]).toBe(10);
    expect(rect[axes.vertical.mainPosition]).toBe(20);
  });
});

describe("sizeOnAxis", () => {
  test("puts the main extent on the axis's own dimension", () => {
    expect(sizeOnAxis({ axis: "horizontal", main: 3, cross: 7 })).toEqual({ width: 3, height: 7 });
    expect(sizeOnAxis({ axis: "vertical", main: 3, cross: 7 })).toEqual({ width: 7, height: 3 });
  });
});

describe("placeOnAxis", () => {
  test("writes only the axis fields and keeps the cross fields", () => {
    const cases: readonly Axis[] = ["horizontal", "vertical"];
    cases.forEach((axis) => {
      const placed = placeOnAxis({ axis, rect, position: 5, extent: 50 });
      expect(placed[axes[axis].mainPosition]).toBe(5);
      expect(placed[axes[axis].main]).toBe(50);
      expect(placed[axes[axis].crossPosition]).toBe(rect[axes[axis].crossPosition]);
      expect(placed[axes[axis].cross]).toBe(rect[axes[axis].cross]);
    });
  });
});
