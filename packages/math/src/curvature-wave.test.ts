import { d, std } from "typegpu";
import { expect, test } from "vite-plus/test";
import { curvatureWave } from "./curvature-wave";

const wave = curvatureWave({ wavelength: 3, bendAngle: 1.1 });

test("holds the anchor without changing the curve shape", () => {
  const anchored = curvatureWave({ wavelength: 3, bendAngle: 1.1, anchor: 3 });
  for (const phase of [0, 0.7, 2.4, 4.9]) {
    const head = wave(d.vec2f(3, phase));
    expect(std.length(anchored(d.vec2f(3, phase)).position)).toBeLessThan(0.000001);
    const sample = anchored(d.vec2f(-1, phase));
    expect(std.distance(sample.position, std.sub(wave(d.vec2f(-1, phase)).position, head.position)))
      .toBeLessThan(0.000001);
  }
});

test("preserves arc length and prescribed curvature through a complete cycle", () => {
  const step = 0.01;
  for (const phase of [0, 0.7, 2.4, 4.9]) {
    for (const arc of [-3, -2.1, -0.7, 0, 0.4, 1.8, 3]) {
      const before = wave(d.vec2f(arc - step, phase));
      const sample = wave(d.vec2f(arc, phase));
      const after = wave(d.vec2f(arc + step, phase));
      const derivative = std.div(std.sub(after.position, before.position), 2 * step);
      const tangentDerivative = std.div(std.sub(after.tangent, before.tangent), 2 * step);
      const curvature = 1.1 * 2 * Math.PI / 3 * Math.cos(arc * 2 * Math.PI / 3 - phase);
      expect(Math.abs(std.length(derivative) - 1)).toBeLessThan(0.001);
      expect(std.distance(derivative, sample.tangent)).toBeLessThan(0.001);
      expect(Math.abs(std.cross(sample.tangent, tangentDerivative).z - curvature))
        .toBeLessThan(0.001);
    }
  }
});

test("joins the phase cycle without a position or tangent jump", () => {
  for (const arc of [-4, -1, 0, 0.8, 3.2, 4]) {
    const start = wave(d.vec2f(arc, 0));
    const end = wave(d.vec2f(arc, 2 * Math.PI));
    expect(std.distance(start.position, end.position)).toBeLessThan(0.000001);
    expect(std.distance(start.tangent, end.tangent)).toBeLessThan(0.000001);
  }
});
