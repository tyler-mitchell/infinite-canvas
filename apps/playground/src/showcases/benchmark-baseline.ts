/**
 * The recorded performance baseline. Committed, so a regression is a diff.
 *
 * **Empty on purpose.** No baseline has ever been recorded on real hardware, and inventing
 * one from the 2026-06-10 tables would be worse than having none: those numbers came from the
 * embedded preview browser, carry means without p95, and predate P2 tranche 1 entirely.
 * `compare()` therefore reports `unrecorded` rather than passing — a benchmark gate that
 * silently approves everything because it has nothing to compare against is the same failure
 * as a drift gate blind to the export you just added.
 *
 * ## Recording one
 *
 * Open `/stress?count=N` on the hardware you intend to defend, and:
 *
 *     await window.__canvasBench.baseline()
 *
 * Paste the printed object into `RUNS` below, keyed by window count. Record at least 20 and
 * 40; 80 and 160 if you care about the tail. Reload the page between counts — the gestures
 * in a `table()` run are not independent.
 *
 * A baseline is only meaningful against the machine that produced it. Recording one on a
 * laptop under thermal throttling and then defending it on a workstation will fail loudly
 * for the wrong reason, which is still better than passing quietly for the wrong reason.
 */

type BenchmarkBaselineEntry = Readonly<{
  meanMs: number;
  p95Ms: number;
}>;

type BenchmarkBaselineRun = Readonly<{
  drag: BenchmarkBaselineEntry;
  pan: BenchmarkBaselineEntry;
  zoom: BenchmarkBaselineEntry;
}>;

/**
 * A frame time may exceed its baseline by this fraction before it counts as a regression.
 *
 * 25% is wide. It is wide because `rAF` timing is noisy, thermal state drifts, and a gate
 * that cries wolf gets deleted. A real regression in this codebase has never been subtle:
 * the body-memoization bug was 8×, the frame-chrome cost is ~0.5ms per window per frame.
 */
const REGRESSION_MARGIN = 0.25;

/**
 * …and by at least this many milliseconds. Without it, a 0.8ms frame regressing to 1.1ms
 * trips a 25% margin while being indistinguishable from scheduler jitter.
 */
const REGRESSION_FLOOR_MS = 1.5;

/** Keyed by window count. Empty until someone records one on hardware they trust. */
const RUNS: Readonly<Record<number, BenchmarkBaselineRun>> = {};

export { REGRESSION_FLOOR_MS, REGRESSION_MARGIN, RUNS };
export type { BenchmarkBaselineEntry, BenchmarkBaselineRun };
