import { expect, test } from "vite-plus/test";
import { interpolateCamera } from "./zoom-interpolation";

const from = { center: { x: 100, y: 200 }, zoom: 0.7 };
const to = { center: { x: 800, y: 500 }, zoom: 1.4 };

test.each([0, 0.3, 0.9, 1.1])("camera interpolation starts at progress %s", (startProgress) => {
  const interpolate = interpolateCamera({ from, to, width: 800, startProgress });
  expect(interpolate(startProgress).center.x).toBeCloseTo(from.center.x);
  expect(interpolate(startProgress).center.y).toBeCloseTo(from.center.y);
  expect(interpolate(startProgress).zoom).toBeCloseTo(from.zoom);
  expect(interpolate(1).center.x).toBeCloseTo(to.center.x);
  expect(interpolate(1).center.y).toBeCloseTo(to.center.y);
  expect(interpolate(1).zoom).toBeCloseTo(to.zoom);
});

test("a completed interpolation returns the new destination", () => {
  const interpolate = interpolateCamera({ from, to, width: 800, startProgress: 1 });
  expect(interpolate(1).center.x).toBeCloseTo(to.center.x);
  expect(interpolate(1).center.y).toBeCloseTo(to.center.y);
  expect(interpolate(1).zoom).toBeCloseTo(to.zoom);
});

test("retargeting preserves the displayed camera and reaches the new destination", () => {
  const original = interpolateCamera({ from, to, width: 800, curvature: 1 });
  const displayed = original(0.6);
  const destination = { center: { x: -200, y: 900 }, zoom: 0.9 };
  const retargeted = interpolateCamera({
    from: displayed,
    to: destination,
    width: 800,
    curvature: 1,
    startProgress: 0.6,
  });
  expect(retargeted(0.6).center.x).toBeCloseTo(displayed.center.x);
  expect(retargeted(0.6).center.y).toBeCloseTo(displayed.center.y);
  expect(retargeted(0.6).zoom).toBeCloseTo(displayed.zoom);
  expect(retargeted(1).center.x).toBeCloseTo(destination.center.x);
  expect(retargeted(1).center.y).toBeCloseTo(destination.center.y);
  expect(retargeted(1).zoom).toBeCloseTo(destination.zoom);
});
