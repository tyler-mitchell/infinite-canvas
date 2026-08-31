type BenchmarkBaselineEntry = Readonly<{
  meanMs: number;
  p95Ms: number;
}>;

type BenchmarkBaselineRun = Readonly<{
  drag: BenchmarkBaselineEntry;
  pan: BenchmarkBaselineEntry;
  zoom: BenchmarkBaselineEntry;
}>;

/** The p95 must exceed this fractional margin and the floor. */
const REGRESSION_MARGIN = 0.25;

/** The p95 must exceed this floor and the fractional margin. */
const REGRESSION_FLOOR_MS = 1.5;

/** RUNS stores hardware baselines by window count. An empty map means unrecorded. */
const RUNS: Readonly<Record<number, BenchmarkBaselineRun>> = {};

export { REGRESSION_FLOOR_MS, REGRESSION_MARGIN, RUNS };
export type { BenchmarkBaselineEntry, BenchmarkBaselineRun };
