import { describe, expect, it } from "vitest";
import { d, std } from "typegpu";
import { perspectiveMatrix } from "./perspective";

describe("perspectiveMatrix", () => {
  const matrix = perspectiveMatrix({ fieldOfView: Math.PI / 2, near: 1, far: 10 });

  it("maps near and far planes to WebGPU depth", () => {
    const near = std.mul(matrix, d.vec4f(0, 0, -1, 1));
    const far = std.mul(matrix, d.vec4f(0, 0, -10, 1));
    expect(near.z / near.w).toBeCloseTo(0);
    expect(far.z / far.w).toBeCloseTo(1);
  });

  it("reduces projected size with distance", () => {
    const near = std.mul(matrix, d.vec4f(1, 1, -2, 1));
    const far = std.mul(matrix, d.vec4f(1, 1, -4, 1));
    expect(near.x / near.w).toBeCloseTo(0.5);
    expect(far.x / far.w).toBeCloseTo(0.25);
    expect(far.y / far.w).toBeCloseTo(0.25);
  });
});
