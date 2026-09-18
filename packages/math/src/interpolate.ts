import { d, std, tgpu } from "typegpu";
import { normalizeOrZero, perpendicular } from "./vector";

export type SpringState = { value: number; velocity: number };

type Coefficients = { pp: number; pv: number; vp: number; vv: number };

type Regime = "critical" | "under" | "over";

const regimes: Record<
  Regime,
  (input: { omega: number; dampingRatio: number; delta: number }) => Coefficients
> = {
  critical: ({ omega, delta }) => {
    const decay = Math.exp(-omega * delta);
    return {
      pp: decay * (1 + omega * delta),
      pv: decay * delta,
      vp: -decay * omega * omega * delta,
      vv: decay * (1 - omega * delta),
    };
  },
  under: ({ omega, dampingRatio, delta }) => {
    const real = -omega * dampingRatio;
    const damped = omega * Math.sqrt(1 - dampingRatio * dampingRatio);
    const decay = Math.exp(real * delta);
    const cosine = Math.cos(damped * delta);
    const sine = Math.sin(damped * delta);
    return {
      pp: decay * (cosine - (real * sine) / damped),
      pv: (decay * sine) / damped,
      vp: (-decay * omega * omega * sine) / damped,
      vv: decay * (cosine + (real * sine) / damped),
    };
  },
  over: ({ omega, dampingRatio, delta }) => {
    const real = -omega * dampingRatio;
    const spread = omega * Math.sqrt(dampingRatio * dampingRatio - 1);
    const slow = real - spread;
    const fast = real + spread;
    const gap = slow - fast;
    const slowDecay = Math.exp(slow * delta);
    const fastDecay = Math.exp(fast * delta);
    return {
      pp: (slow * fastDecay - fast * slowDecay) / gap,
      pv: (slowDecay - fastDecay) / gap,
      vp: (omega * omega * (fastDecay - slowDecay)) / gap,
      vv: (slow * slowDecay - fast * fastDecay) / gap,
    };
  },
};

const regimeOf = (dampingRatio: number): Regime => {
  if (Math.abs(dampingRatio - 1) < 1e-4) return "critical";
  return dampingRatio < 1 ? "under" : "over";
};

export function stepSpring({
  state,
  target,
  delta,
  smoothTime,
  dampingRatio = 1,
}: {
  state: SpringState;
  target: number;
  delta: number;
  smoothTime: number;
  dampingRatio?: number | undefined;
}): SpringState {
  const omega = 2 / Math.max(1e-4, smoothTime);
  const { pp, pv, vp, vv } = regimes[regimeOf(dampingRatio)]({ omega, dampingRatio, delta });
  const displacement = state.value - target;
  return {
    value: target + pp * displacement + pv * state.velocity,
    velocity: vp * displacement + vv * state.velocity,
  };
}

export const arcControlPoint = tgpu.fn(
  [d.vec2f, d.vec2f, d.f32],
  d.vec2f,
)((from, to, curvature) => {
  "use gpu";
  const span = std.distance(from, to);
  const sideways = perpendicular(normalizeOrZero(std.sub(to, from)));
  return std.add(std.mix(from, to, 0.5), std.mul(curvature * span, sideways));
});

export const arcPoint = tgpu.fn(
  [d.vec2f, d.vec2f, d.f32, d.f32],
  d.vec2f,
)((from, to, curvature, amount) => {
  "use gpu";
  const control = arcControlPoint(from, to, curvature);
  const rest = 1 - amount;
  return std.add(
    std.add(std.mul(rest * rest, from), std.mul(2 * rest * amount, control)),
    std.mul(amount * amount, to),
  );
});
