export interface Range {
  readonly min: number;
  readonly max: number;
}

export interface RangeOptions {
  /** Headroom added above and below, as a fraction of the raw span. */
  readonly margin?: number;
  /** Floor on the span. Without one, a quiet stretch collapses to a zero-height scale. */
  readonly minimumSpan?: number;
}

export const computeRange = (values: readonly number[], options: RangeOptions = {}): Range => {
  if (values.length === 0) return { min: 0, max: 1 };

  const low = Math.min(...values);
  const high = Math.max(...values);
  const span = high - low;
  const floor = options.minimumSpan ?? (span * 0.1 || 0.4);

  if (span < floor) {
    const middle = (low + high) / 2;
    return { min: middle - floor / 2, max: middle + floor / 2 };
  }

  const margin = span * (options.margin ?? 0.12);
  return { min: low - margin, max: high + margin };
};

export const rangeSpan = (range: Range) => Math.max(1e-6, range.max - range.min);
