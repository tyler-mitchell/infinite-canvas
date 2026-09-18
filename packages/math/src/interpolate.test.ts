import { d, std, tgpu } from "typegpu";
import { describe, expect, test } from "vite-plus/test";
import { arcControlPoint, arcPoint, stepSpring, type SpringState } from "./interpolate";

const settle = ({
  delta,
  steps,
  dampingRatio = 1,
  smoothTime = 0.3,
  target = 100,
}: {
  delta: number;
  steps: number;
  dampingRatio?: number;
  smoothTime?: number;
  target?: number;
}): SpringState =>
  Array.from({ length: steps }).reduce<SpringState>(
    (state) => stepSpring({ state, target, delta, smoothTime, dampingRatio }),
    { value: 0, velocity: 0 },
  );

describe("stepSpring", () => {
  test("gives the same answer for one long step as for many short ones, so substeps are not needed", () => {
    const coarse = settle({ delta: 0.095, steps: 4 });
    const fine = settle({ delta: 0.095 / 100, steps: 400 });
    expect(coarse.value).toBeCloseTo(fine.value, 6);
    expect(coarse.velocity).toBeCloseTo(fine.velocity, 6);
  });

  test("stays stable at the 95 ms tick that made an integrated spring diverge", () => {
    const history = Array.from({ length: 40 }).reduce<SpringState[]>(
      (states) => [
        ...states,
        stepSpring({
          state: states[states.length - 1]!,
          target: 100,
          delta: 0.095,
          smoothTime: 0.3,
        }),
      ],
      [{ value: 0, velocity: 0 }],
    );
    history.forEach((state) => {
      expect(Number.isFinite(state.value)).toBe(true);
      expect(state.value).toBeGreaterThanOrEqual(0);
      expect(state.value).toBeLessThanOrEqual(100);
    });
    expect(history[history.length - 1]!.value).toBeCloseTo(100, 6);
  });

  test("never overshoots when critically damped, at any step size", () => {
    [0.001, 0.016, 0.095, 0.5, 2].forEach((delta) =>
      Array.from({ length: 30 }).reduce<SpringState>(
        (state) => {
          const next = stepSpring({ state, target: 100, delta, smoothTime: 0.3 });
          expect(next.value).toBeLessThanOrEqual(100 + 1e-9);
          expect(next.value).toBeGreaterThanOrEqual(state.value - 1e-9);
          return next;
        },
        { value: 0, velocity: 0 },
      ),
    );
  });

  test("overshoots when under-damped and does not when over-damped", () => {
    const peak = (dampingRatio: number) =>
      Array.from({ length: 200 }).reduce<{ state: SpringState; highest: number }>(
        (carried) => {
          const state = stepSpring({
            state: carried.state,
            target: 100,
            delta: 0.004,
            smoothTime: 0.3,
            dampingRatio,
          });
          return { state, highest: Math.max(carried.highest, state.value) };
        },
        { state: { value: 0, velocity: 0 }, highest: 0 },
      ).highest;
    expect(peak(0.3)).toBeGreaterThan(100);
    expect(peak(2.5)).toBeLessThanOrEqual(100 + 1e-9);
  });

  test("reaches the target from either side and holds there", () => {
    [
      { start: 0, target: 100 },
      { start: 250, target: 100 },
    ].forEach(({ start, target }) => {
      const rested = Array.from({ length: 200 }).reduce<SpringState>(
        (state) => stepSpring({ state, target, delta: 0.016, smoothTime: 0.2 }),
        { value: start, velocity: 0 },
      );
      expect(rested.value).toBeCloseTo(target, 6);
      expect(rested.velocity).toBeCloseTo(0, 6);
    });
  });

  test("a zero step changes nothing", () => {
    const state = { value: 40, velocity: -7 };
    expect(stepSpring({ state, target: 100, delta: 0, smoothTime: 0.3 })).toEqual(state);
  });
});

describe("arcPoint", () => {
  const from = d.vec2f(0, 0);
  const to = d.vec2f(100, 0);

  test("starts and ends at the endpoints whatever the curvature", () => {
    [-1, 0, 0.5, 3].forEach((curvature) => {
      expect(arcPoint(from, to, curvature, 0)).toEqual(from);
      expect(arcPoint(from, to, curvature, 1)).toEqual(to);
    });
  });

  test("is the straight line when the curvature is zero", () => {
    [0.25, 0.5, 0.75].forEach((amount) => {
      const point = arcPoint(from, to, 0, amount);
      expect(point.y).toBeCloseTo(0, 5);
      expect(point.x).toBeCloseTo(amount * 100, 4);
    });
  });

  test("bows to one side, and to the other when the curvature flips sign", () => {
    const positive = arcPoint(from, to, 0.5, 0.5);
    const negative = arcPoint(from, to, -0.5, 0.5);
    expect(positive.y).toBeCloseTo(-negative.y, 5);
    expect(Math.abs(positive.y)).toBeGreaterThan(0);
  });

  test("bows further as the curvature grows", () => {
    const shallow = Math.abs(arcPoint(from, to, 0.2, 0.5).y);
    const deep = Math.abs(arcPoint(from, to, 0.8, 0.5).y);
    expect(deep).toBeGreaterThan(shallow);
  });

  test("leaves a zero-length move at the point rather than dividing by zero", () => {
    const point = arcPoint(from, from, 1, 0.5);
    expect(Number.isFinite(point.x)).toBe(true);
    expect(Number.isFinite(point.y)).toBe(true);
    expect(std.distance(point, from)).toBeCloseTo(0, 5);
  });

  test("puts the control point off to the side, which the midpoint exposes", () => {
    const control = arcControlPoint(from, to, 0.25);
    expect(control.x).toBeCloseTo(50, 4);
    expect(control.y).toBeCloseTo(25, 4);
  });

  test("resolves to WGSL", () => {
    const wgsl = tgpu.resolve([arcPoint, arcControlPoint]);
    expect(wgsl).toContain("fn arcPoint");
    expect(wgsl).toContain("fn arcControlPoint");
  });
});
