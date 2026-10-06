import { d } from "typegpu";
import { describe, expect, test } from "vite-plus/test";
import {
  containsPoint as containsPointKernel,
  containsRect as containsRectKernel,
  intersectsRect as intersectsRectKernel,
  Insets,
  outsetRectBy as outsetRectByKernel,
  Rect as RectSchema,
  screenToWorld as screenToWorldKernel,
  unionRect as unionRectKernel,
  View,
  visibleWorldRect as visibleWorldRectKernel,
  worldToScreen as worldToScreenKernel,
} from "./gpu";
import {
  type Camera,
  containsPoint,
  containsRect,
  intersectsRect,
  outsetRectBy,
  type Point,
  type Rect,
  unionRect,
  screenToWorld,
  visibleWorldRect,
  worldToScreen,
} from "./cpu";

// The declared tolerance, scaled by magnitude rather than flat. A fixed epsilon only means anything
// near 1: an f32 step at magnitude 2560, which the camera fixtures reach, is already ~2.4e-4, so a
// flat 1e-4 was passing by luck rather than by agreement. The rule is this package's own
// eqDeltaScaled, from @thi.ng/math@5.15.17 eqdelta.js:5:
//   const eqDeltaScaled = (a, b, eps = EPS) => abs(a - b) <= eps * max(1, abs(a), abs(b));
const TOLERANCE = 1e-5;

const agrees = (onCpu: number, onGpu: number) =>
  Math.abs(onCpu - onGpu) <= TOLERANCE * Math.max(1, Math.abs(onCpu), Math.abs(onGpu));

const representable: { rect: Rect; other: Rect; point: Point }[] = [
  {
    rect: { x: 0, y: 0, width: 120, height: 80 },
    other: { x: 60, y: 40, width: 100, height: 100 },
    point: { x: 60, y: 40 },
  },
  {
    rect: { x: -32, y: -16, width: 64, height: 32 },
    other: { x: 32, y: 16, width: 8, height: 8 },
    point: { x: 32, y: 16 },
  },
  {
    rect: { x: 1024, y: 512, width: 256, height: 128 },
    other: { x: 1280, y: 640, width: 0, height: 0 },
    point: { x: 1280, y: 640 },
  },
  {
    rect: { x: 0.5, y: 0.25, width: 2.5, height: 1.75 },
    other: { x: 3, y: 2, width: 0.5, height: 0.5 },
    point: { x: 3, y: 2 },
  },
  {
    rect: { x: 0, y: 0, width: 120, height: 80 },
    other: { x: -120, y: -80, width: 120, height: 80 },
    point: { x: 0, y: 0 },
  },
  {
    rect: { x: 16, y: 8, width: 32, height: 16 },
    other: { x: 16, y: 8, width: 32, height: 16 },
    point: { x: 16, y: 12 },
  },
  {
    rect: { x: 16, y: 8, width: 32, height: 16 },
    other: { x: -64, y: -64, width: 8, height: 8 },
    point: { x: 15.5, y: 12 },
  },
  {
    rect: { x: 16, y: 8, width: 32, height: 16 },
    other: { x: 48, y: 24, width: 16, height: 16 },
    point: { x: 32, y: 8 },
  },
];

const camera: Camera = { center: { x: 200, y: 150 }, zoom: 2 };
const viewport = { width: 800, height: 600 };

const kernelCamera = View({
  center: d.vec2f(200, 150),
  viewport: d.vec2f(800, 600),
  zoom: 2,
});

const asSchema = (rect: Rect) => RectSchema(rect);

describe("both adapters obey one rule on inputs f32 can hold exactly", () => {
  test("containsPoint agrees, including the inclusive edge", () => {
    representable.forEach(({ rect, point }) => {
      expect(containsPoint(rect, point)).toBe(
        containsPointKernel(asSchema(rect), d.vec2f(point.x, point.y)),
      );
    });
  });

  test("containsRect agrees", () => {
    representable.forEach(({ rect, other }) => {
      expect(containsRect(rect, other)).toBe(containsRectKernel(asSchema(rect), asSchema(other)));
    });
  });

  test("intersectsRect agrees, including edge contact", () => {
    representable.forEach(({ rect, other }) => {
      expect(intersectsRect(rect, other)).toBe(
        intersectsRectKernel(asSchema(rect), asSchema(other)),
      );
    });
  });

  test("unionRect agrees within tolerance on every field", () => {
    representable.forEach(({ rect, other }) => {
      const onCpu = unionRect(rect, other);
      const onGpu = unionRectKernel(asSchema(rect), asSchema(other));
      expect(onCpu.x).toBeCloseTo(onGpu.x, 4);
      expect(onCpu.y).toBeCloseTo(onGpu.y, 4);
      expect(onCpu.width).toBeCloseTo(onGpu.width, 4);
      expect(onCpu.height).toBeCloseTo(onGpu.height, 4);
    });
  });

  test("visibleWorldRect agrees within tolerance, insets and all", () => {
    const edges = [
      { top: 0, right: 0, bottom: 0, left: 0 },
      { top: 48, right: 16, bottom: 8, left: 320 },
      { top: 400, right: 512, bottom: 400, left: 512 },
    ];
    edges.forEach((insets) => {
      const onCpu = visibleWorldRect({ camera, viewport, insets });
      const onGpu = visibleWorldRectKernel(kernelCamera, Insets(insets));
      expect(agrees(onCpu.x, onGpu.x)).toBe(true);
      expect(agrees(onCpu.y, onGpu.y)).toBe(true);
      expect(agrees(onCpu.width, onGpu.width)).toBe(true);
      expect(agrees(onCpu.height, onGpu.height)).toBe(true);
    });
  });

  test("outsetRectBy grows both edges, so a padded hit test is a composition not a second predicate", () => {
    const rect: Rect = { x: 10, y: 20, width: 100, height: 50 };
    const padded = outsetRectBy(rect, 4);
    expect(padded).toEqual({ x: 6, y: 16, width: 108, height: 58 });
    // The point sits 3 outside the right edge, so only the padded rect contains it. This is the
    // shape next/state.computed.ts:626 needs, where the framework passes padding to containsPoint.
    const justOutside = { x: 113, y: 45 };
    expect(containsPoint(rect, justOutside)).toBe(false);
    expect(containsPoint(padded, justOutside)).toBe(true);
    expect(outsetRectBy(rect, -4)).toEqual({ x: 14, y: 24, width: 92, height: 42 });
  });

  test("outsetRectBy agrees with the kernel", () => {
    const rect: Rect = { x: 10, y: 20, width: 100, height: 50 };
    const onGpu = outsetRectByKernel(asSchema(rect), 4);
    const onCpu = outsetRectBy(rect, 4);
    expect(onCpu.x).toBeCloseTo(onGpu.x, 4);
    expect(onCpu.width).toBeCloseTo(onGpu.width, 4);
    expect(onCpu.height).toBeCloseTo(onGpu.height, 4);
  });

  test("visibleWorldRect clamps to zero rather than inverting when insets exceed the viewport", () => {
    const swallowed = visibleWorldRect({
      camera,
      viewport,
      insets: { top: 400, right: 512, bottom: 400, left: 512 },
    });
    expect(swallowed.width).toBe(0);
    expect(swallowed.height).toBe(0);
  });

  test("the camera transforms agree within tolerance", () => {
    representable.forEach(({ point }) => {
      const onCpu = worldToScreen({ point, camera, viewport });
      const onGpu = worldToScreenKernel(d.vec2f(point.x, point.y), kernelCamera);
      expect(agrees(onCpu.x, onGpu.x)).toBe(true);
      expect(agrees(onCpu.y, onGpu.y)).toBe(true);

      const backOnCpu = screenToWorld({ point: onCpu, camera, viewport });
      const backOnGpu = screenToWorldKernel(onGpu, kernelCamera);
      expect(agrees(backOnCpu.x, backOnGpu.x)).toBe(true);
      expect(agrees(backOnCpu.y, backOnGpu.y)).toBe(true);
    });
  });
});

describe("the two adapters are not interchangeable, which is why both exist", () => {
  test("only the f64 adapter survives a world round trip at a fractional coordinate", () => {
    const world = { x: 400.1, y: 0.1 };
    const there = worldToScreen({ point: world, camera, viewport });
    expect(screenToWorld({ point: there, camera, viewport }).x).toBe(400.1);

    const throughKernel = screenToWorldKernel(
      worldToScreenKernel(d.vec2f(world.x, world.y), kernelCamera),
      kernelCamera,
    );
    expect(throughKernel.x).not.toBe(400.1);
  });

  test("the kernel rounds a fractional width before the body runs", () => {
    const rect: Rect = { x: 0, y: 0, width: 0.1, height: 0.1 };
    expect(rect.width).toBe(0.1);
    expect(asSchema(rect).width).toBe(Math.fround(0.1));
    expect(asSchema(rect).width).not.toBe(0.1);
  });

  test("the f64 adapter never rounds its result", () => {
    const merged = unionRect(
      { x: 0.1, y: 0, width: 1, height: 1 },
      { x: 2, y: 0, width: 1, height: 1 },
    );
    expect(merged.x).toBe(0.1);
    expect(merged.width).toBe(2.9);
  });
});
