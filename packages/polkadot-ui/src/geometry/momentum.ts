export type Momentum = "up" | "down" | "flat";

export interface MomentumOptions {
  /** Samples the swing is measured against. */
  readonly lookback?: number;
  /** How far back the tail reaches from the head. */
  readonly tail?: number;
  /** Share of the lookback range the tail must cover to count as a swing. */
  readonly threshold?: number;
}

/**
 * A swing detector, not a slope detector: the tail is compared against a share of the whole
 * lookback range, so a steady climb reports one swing at its onset rather than one per step.
 */
export const detectMomentum = (
  samples: readonly number[],
  options: MomentumOptions = {},
): Momentum => {
  const lookback = options.lookback ?? 20;
  const tailLength = options.tail ?? 5;
  const threshold = options.threshold ?? 0.12;

  const window = samples.slice(-lookback);
  if (window.length <= tailLength) return "flat";

  const range = Math.max(...window) - Math.min(...window);
  if (range === 0) return "flat";

  const head = window[window.length - 1] as number;
  const tail = head - (window[window.length - 1 - tailLength] as number);

  if (tail > range * threshold) return "up";
  if (tail < -range * threshold) return "down";
  return "flat";
};
