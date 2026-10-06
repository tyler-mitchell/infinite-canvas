import { d, tgpu } from "typegpu";
import { describe, expect, test } from "vite-plus/test";
import { Rect } from "./rect";
import {
  composeTransforms,
  identityTransform,
  invertTransform,
  rotationTransform,
  scalingTransform,
  Transform,
  transformDeterminant,
  transformDirection,
  transformPoint,
  transformRect,
  translationTransform,
} from "./transform";

const affine = (
  xAxis: readonly [number, number],
  yAxis: readonly [number, number],
  origin: readonly [number, number],
) =>
  Transform({
    xAxis: d.vec2f(...xAxis),
    yAxis: d.vec2f(...yAxis),
    origin: d.vec2f(...origin),
  });

const scaleAndShift = affine([2, 0], [0, 3], [10, -5]);
const quarterTurn = affine([0, 1], [-1, 0], [0, 0]);
const half = Math.SQRT1_2;
const eighthTurn = affine([half, half], [-half, half], [0, 0]);
const mirrored = affine([-1, 0], [0, -1], [0, 0]);
const collapsed = affine([0, 0], [0, 0], [5, 5]);
const skewed = affine([2, 1], [-1, 3], [10, -5]);
const point = d.vec2f(7, -4);
const rect = Rect({ x: 1, y: 2, width: 4, height: 6 });

describe("identityTransform", () => {
  test("leaves a point where it is", () => {
    expect(transformPoint(identityTransform(), point)).toEqual(point);
  });

  test("has a determinant of one", () => {
    expect(transformDeterminant(identityTransform())).toBe(1);
  });
});

describe("composeTransforms", () => {
  test("applies the inner transform first, then the outer one", () => {
    const together = transformPoint(composeTransforms(scaleAndShift, quarterTurn), point);
    const stepped = transformPoint(scaleAndShift, transformPoint(quarterTurn, point));
    expect(together.x).toBeCloseTo(stepped.x, 3);
    expect(together.y).toBeCloseTo(stepped.y, 3);
  });

  test("is not commutative, so the argument order carries meaning", () => {
    const forward = transformPoint(composeTransforms(scaleAndShift, quarterTurn), point);
    const backward = transformPoint(composeTransforms(quarterTurn, scaleAndShift), point);
    expect(forward.x).not.toBeCloseTo(backward.x, 3);
  });

  test("carries the inner translation through the outer scale", () => {
    const composed = composeTransforms(
      scalingTransform(d.vec2f(2, 2)),
      translationTransform(d.vec2f(3, 4)),
    );
    expect(transformPoint(composed, d.vec2f(0, 0))).toEqual(d.vec2f(6, 8));
  });

  test("leaves a transform alone when composed with the identity", () => {
    expect(composeTransforms(scaleAndShift, identityTransform())).toEqual(scaleAndShift);
    expect(composeTransforms(identityTransform(), scaleAndShift)).toEqual(scaleAndShift);
  });
});

describe("translationTransform, scalingTransform and rotationTransform", () => {
  test("translate moves a point by the vector", () => {
    expect(transformPoint(translationTransform(d.vec2f(5, -7)), point)).toEqual(d.vec2f(12, -11));
  });

  test("scale multiplies each axis", () => {
    expect(transformPoint(scalingTransform(d.vec2f(2, 3)), point)).toEqual(d.vec2f(14, -12));
  });

  test("rotate turns counter-clockwise by the angle", () => {
    const turned = transformPoint(rotationTransform(Math.PI / 2), d.vec2f(1, 0));
    expect(turned.x).toBeCloseTo(0, 5);
    expect(turned.y).toBeCloseTo(1, 5);
  });
});

describe("transformDirection ignores translation, which transformPoint applies", () => {
  test("a translation moves a point but leaves a direction alone", () => {
    const shift = translationTransform(d.vec2f(100, 200));
    expect(transformPoint(shift, d.vec2f(1, 0))).toEqual(d.vec2f(101, 200));
    expect(transformDirection(shift, d.vec2f(1, 0))).toEqual(d.vec2f(1, 0));
  });

  test("a scale still applies to a direction", () => {
    expect(transformDirection(scaleAndShift, d.vec2f(1, 1))).toEqual(d.vec2f(2, 3));
  });
});

describe("invertTransform", () => {
  test("round-trips a point through scale and translation", () => {
    const back = transformPoint(
      invertTransform(scaleAndShift),
      transformPoint(scaleAndShift, point),
    );
    expect(back.x).toBeCloseTo(point.x, 3);
    expect(back.y).toBeCloseTo(point.y, 3);
  });

  test("round-trips through a rotation too", () => {
    const back = transformPoint(invertTransform(eighthTurn), transformPoint(eighthTurn, point));
    expect(back.x).toBeCloseTo(point.x, 3);
    expect(back.y).toBeCloseTo(point.y, 3);
  });

  test("round-trips a point through a skew, which a diagonal transform cannot expose", () => {
    const back = transformPoint(invertTransform(skewed), transformPoint(skewed, point));
    expect(back.x).toBeCloseTo(point.x, 3);
    expect(back.y).toBeCloseTo(point.y, 3);
  });

  test("composing a transform with its inverse gives the identity", () => {
    const composed = composeTransforms(skewed, invertTransform(skewed));
    expect(composed.xAxis.x).toBeCloseTo(1, 5);
    expect(composed.xAxis.y).toBeCloseTo(0, 5);
    expect(composed.yAxis.x).toBeCloseTo(0, 5);
    expect(composed.yAxis.y).toBeCloseTo(1, 5);
    expect(composed.origin.x).toBeCloseTo(0, 4);
    expect(composed.origin.y).toBeCloseTo(0, 4);
  });

  test("falls back to the identity when the transform collapses the plane", () => {
    expect(transformDeterminant(collapsed)).toBe(0);
    expect(transformPoint(invertTransform(collapsed), point)).toEqual(point);
  });
});

describe("transformRect", () => {
  test("is exact when the transform only scales and translates", () => {
    expect(transformRect(scaleAndShift, rect)).toEqual(Rect({ x: 12, y: 1, width: 8, height: 18 }));
  });

  test("returns the axis-aligned bounds when the transform rotates", () => {
    expect(transformRect(quarterTurn, rect)).toEqual(Rect({ x: -8, y: 1, width: 6, height: 4 }));
  });

  test("uses every corner, which a diagonal rotation exposes", () => {
    const bounds = transformRect(eighthTurn, rect);
    expect(bounds.x).toBeCloseTo(-7 * half, 4);
    expect(bounds.y).toBeCloseTo(3 * half, 4);
    expect(bounds.width).toBeCloseTo(10 * half, 4);
    expect(bounds.height).toBeCloseTo(10 * half, 4);
  });

  test("keeps a negative scale from producing a negative extent", () => {
    expect(transformRect(mirrored, rect)).toEqual(Rect({ x: -5, y: -8, width: 4, height: 6 }));
  });
});

describe("the transform functions resolve to WGSL", () => {
  test("including the hand-written inverse, which WGSL has no builtin for", () => {
    const wgsl = tgpu.resolve([transformPoint, transformRect, invertTransform, composeTransforms]);
    expect(wgsl).toContain("fn transformPoint");
    expect(wgsl).toContain("fn transformRect");
    expect(wgsl).toContain("fn invertTransform");
    expect(wgsl).toContain("fn composeTransforms");
  });
});
