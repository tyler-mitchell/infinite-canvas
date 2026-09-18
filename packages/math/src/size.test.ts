import { d, tgpu } from "typegpu";
import { describe, expect, test } from "vite-plus/test";
import { containScale, coverScale } from "./size";

const wide = d.vec2f(200, 100);
const box = d.vec2f(100, 100);

describe("containScale fits the whole thing inside, so the tighter axis wins", () => {
  test("takes the axis that runs out first", () => {
    expect(containScale(wide, box)).toBe(0.5);
    expect(containScale(d.vec2f(100, 200), box)).toBe(0.5);
  });

  test("leaves a matching shape alone", () => {
    expect(containScale(box, box)).toBe(1);
  });

  test("never lets the scaled size exceed the bounds on either axis", () => {
    [d.vec2f(300, 50), d.vec2f(50, 300), d.vec2f(17, 240)].forEach((size) => {
      const scale = containScale(size, box);
      expect(size.x * scale).toBeLessThanOrEqual(box.x + 1e-4);
      expect(size.y * scale).toBeLessThanOrEqual(box.y + 1e-4);
    });
  });
});

describe("coverScale fills the bounds, so the looser axis wins", () => {
  test("takes the axis with room to spare", () => {
    expect(coverScale(wide, box)).toBe(1);
    expect(coverScale(d.vec2f(50, 25), box)).toBe(4);
  });

  test("always covers the bounds on both axes", () => {
    [d.vec2f(300, 50), d.vec2f(50, 300), d.vec2f(17, 240)].forEach((size) => {
      const scale = coverScale(size, box);
      expect(size.x * scale).toBeGreaterThanOrEqual(box.x - 1e-4);
      expect(size.y * scale).toBeGreaterThanOrEqual(box.y - 1e-4);
    });
  });

  test("is never smaller than containScale for the same input", () => {
    [d.vec2f(300, 50), d.vec2f(50, 300), d.vec2f(17, 240), box].forEach((size) =>
      expect(coverScale(size, box)).toBeGreaterThanOrEqual(containScale(size, box)),
    );
  });
});

describe("a zero extent would divide by zero, which f32 cannot hold", () => {
  test("returns one rather than an infinity, on either axis and on both", () => {
    expect(containScale(d.vec2f(0, 100), box)).toBe(1);
    expect(containScale(d.vec2f(100, 0), box)).toBe(1);
    expect(coverScale(d.vec2f(0, 0), box)).toBe(1);
  });

  test("a zero bound still gives a finite scale of zero", () => {
    expect(containScale(box, d.vec2f(0, 0))).toBe(0);
  });
});

describe("the fit functions resolve to WGSL", () => {
  test("each one is a named function in the output", () => {
    const wgsl = tgpu.resolve([containScale, coverScale]);
    expect(wgsl).toContain("fn containScale");
    expect(wgsl).toContain("fn coverScale");
  });
});
