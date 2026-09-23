import { d } from "typegpu";
import { expect, test } from "vite-plus/test";
import { ditherOffset, interleavedGradientNoise } from "./gpu";

const pixels = Array.from({ length: 256 }, (_, index) =>
  d.vec2f(index % 16, Math.floor(index / 16)),
);

test("interleaved noise remains within its normalized range", () => {
  const samples = pixels.map((pixel) => interleavedGradientNoise(pixel));
  expect(Math.min(...samples)).toBeGreaterThanOrEqual(0);
  expect(Math.max(...samples)).toBeLessThan(1);
  expect(new Set(samples).size).toBeGreaterThan(240);
});

test("dither stays within half an 8-bit step and changes with time", () => {
  const samples = pixels.map((pixel) => ditherOffset(pixel, 0));
  expect(Math.max(...samples.map(Math.abs))).toBeLessThanOrEqual(0.5 / 255 + 1e-9);
  expect(Math.abs(samples.reduce((sum, value) => sum + value, 0) / samples.length)).toBeLessThan(
    0.0001,
  );
  expect(ditherOffset(d.vec2f(7, 11), 0)).not.toBe(ditherOffset(d.vec2f(7, 11), 1));
  expect(ditherOffset(d.vec2f(7, 11), 0)).toBe(ditherOffset(d.vec2f(7, 11), 8));
});
