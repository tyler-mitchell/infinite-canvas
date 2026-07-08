/**
 * The synthetic interaction harness the performance profile keeps promising.
 *
 * `research/performance-profile.md` closes with "the protocol above is reproducible via
 * the synthetic drivers in this doc's history" — which is to say the drivers were never in
 * the tree, and every number in that document was produced by code nobody can re-run. P2
 * tranche 1 is landed and unmeasured for exactly that reason: re-deriving the harness costs
 * more than reading the diff, so nobody does it, so the tables stay stale.
 *
 * This is that harness, in the repository. **Building it needs no browser; running it does.**
 * That asymmetry is the whole point: the moment someone opens `/stress` they can measure
 * rather than re-litigate.
 *
 * ## Protocol
 *
 * One input event per animation frame, matching the 2026-06-10 runs. Frame duration is the
 * delta between successive `requestAnimationFrame` timestamps, which measures the whole
 * frame — event handling, React reconciliation, style recalc, layout, paint — because that
 * is what a user feels. The first frame after a gesture starts is discarded: it carries the
 * cost of `startMove`/`startPan` and is not representative of the steady state.
 *
 * ## Reading the numbers
 *
 * `p95` matters more than `mean`. A pan that averages 12ms but spikes to 40 twice a second
 * feels broken, and the mean will not say so. Both are reported.
 *
 * The embedded preview browser underclocks `rAF` under load, so **ratios and slopes are the
 * finding; absolutes want real hardware.** Compare a run against another run from the same
 * browser, never against a number in a document.
 *
 * ## Usage
 *
 *     // http://localhost:5173/stress?count=40
 *     await window.__canvasBench.run({ gesture: "pan" })
 *     await window.__canvasBench.table()   // every gesture, markdown, ready to paste
 */

import {
  REGRESSION_FLOOR_MS,
  REGRESSION_MARGIN,
  RUNS,
  type BenchmarkBaselineEntry,
  type BenchmarkBaselineRun,
} from "./benchmark-baseline.ts";

type BenchmarkGesture = "drag" | "pan" | "zoom";

type BenchmarkResult = Readonly<{
  fps: number;
  frames: number;
  gesture: BenchmarkGesture;
  meanMs: number;
  p95Ms: number;
  windows: number;
}>;

/** Frames to measure after the warm-up frame is discarded. ~1.5s at 60fps, as in 2026-06-10. */
const BENCHMARK_FRAMES = 90;

/** Wheel deltas per frame. Large enough to move, small enough not to fling off the windows. */
const PAN_DELTA_PX = 12;
const ZOOM_DELTA_PX = 4;

/** Pointer travel per frame during a drag, in screen pixels. */
const DRAG_DELTA_PX = 3;

const nextFrame = async (): Promise<number> =>
  new Promise((resolve) => {
    requestAnimationFrame(resolve);
  });

const getViewport = (): HTMLElement => {
  const viewport = document.querySelector<HTMLElement>("[data-infinite-canvas-viewport='true']");

  if (viewport === null) {
    throw new Error("No canvas viewport on this page. Open /stress first.");
  }

  return viewport;
};

/** The active window's header — what a user grabs, and what `startMove` listens on. */
const getDragHandle = (): HTMLElement => {
  const header = document.querySelector<HTMLElement>("[data-slot='window-header']");

  if (header === null) {
    throw new Error("No window header found. Does this canvas have windows?");
  }

  return header;
};

const getWindowCount = (): number => document.querySelectorAll("[data-slot='window']").length;

/**
 * `deltaMode: 0` is pixel mode, which is what a trackpad sends and what the framework's
 * wheel normalization treats as authoritative. `ctrlKey` is the pinch-zoom convention every
 * browser uses, and the canvas routes it to zoom rather than pan.
 */
const dispatchWheel = (target: HTMLElement, isZoom: boolean): void => {
  target.dispatchEvent(
    new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      ctrlKey: isZoom,
      deltaMode: 0,
      deltaY: isZoom ? ZOOM_DELTA_PX : PAN_DELTA_PX,
    }),
  );
};

const dispatchPointer = (
  target: EventTarget,
  type: "pointerdown" | "pointermove" | "pointerup",
  x: number,
  y: number,
): void => {
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      button: 0,
      buttons: type === "pointerup" ? 0 : 1,
      cancelable: true,
      clientX: x,
      clientY: y,
      isPrimary: true,
      pointerId: 1,
      pointerType: "mouse",
    }),
  );
};

const summarize = (
  gesture: BenchmarkGesture,
  windows: number,
  durations: readonly number[],
): BenchmarkResult => {
  const sorted = [...durations].sort((left, right) => left - right);
  const meanMs = durations.reduce((total, ms) => total + ms, 0) / durations.length;
  // Nearest-rank p95: the smallest sample at or above the 95th percentile. No interpolation,
  // because an interpolated frame time is a frame that never happened.
  const p95Ms = sorted[Math.min(Math.ceil(sorted.length * 0.95) - 1, sorted.length - 1)] ?? 0;

  return {
    fps: Math.round((1000 / meanMs) * 10) / 10,
    frames: durations.length,
    gesture,
    meanMs: Math.round(meanMs * 100) / 100,
    p95Ms: Math.round(p95Ms * 100) / 100,
    windows,
  };
};

/**
 * Drive one gesture for `BENCHMARK_FRAMES` frames and report the frame times.
 *
 * A drag dispatches `pointermove` on `window`, not on the header, because the framework's
 * interaction listeners are mount-scoped on `window` — a drag that only moved the header
 * would measure nothing and pass. That is not hypothetical: the same assumption, inverted,
 * is what let the "move/resize/pan/marquee listener gap" ship, where a `pointermove` in the
 * same frame as its `pointerdown` was silently dropped.
 */
const run = async ({
  gesture,
}: Readonly<{ gesture: BenchmarkGesture }>): Promise<BenchmarkResult> => {
  const viewport = getViewport();
  const windows = getWindowCount();
  // A drag grabs the header where the header is. The delta arithmetic would survive grabbing
  // at the viewport's centre — `startMove` records whatever `originPointer` it is handed —
  // but a driver that grabs somewhere the user never could is measuring a fiction.
  const origin = (gesture === "drag" ? getDragHandle() : viewport).getBoundingClientRect();
  const originX = origin.left + origin.width / 2;
  const originY = origin.top + origin.height / 2;

  if (gesture === "drag") {
    dispatchPointer(getDragHandle(), "pointerdown", originX, originY);
  }

  // Warm-up: absorbs `startPan`/`startMove` and the first reconciliation.
  let previous = await nextFrame();
  const durations: number[] = [];

  for (let frame = 0; frame < BENCHMARK_FRAMES; frame += 1) {
    if (gesture === "drag") {
      dispatchPointer(window, "pointermove", originX + frame * DRAG_DELTA_PX, originY);
    } else {
      dispatchWheel(viewport, gesture === "zoom");
    }

    const now = await nextFrame();
    durations.push(now - previous);
    previous = now;
  }

  if (gesture === "drag") {
    dispatchPointer(window, "pointerup", originX + BENCHMARK_FRAMES * DRAG_DELTA_PX, originY);
  }

  return summarize(gesture, windows, durations);
};

/**
 * Every gesture, as a markdown row ready to paste into `performance-profile.md`.
 *
 * **The gestures are not independent.** Each mutates the camera the next one starts from: a
 * pan moves the world, a zoom changes the scale every subsequent frame is drawn at, and a
 * drag leaves a window somewhere new. That is tolerable for the ratios this harness exists to
 * find, and it is not tolerable for a strict comparison — reload between rows, and never
 * compare a `table()` row against a `run()` taken from a fresh page.
 */
const runAllGestures = async (): Promise<readonly BenchmarkResult[]> => {
  const results: BenchmarkResult[] = [];

  for (const gesture of ["pan", "zoom", "drag"] as const) {
    // Sequential on purpose: two gestures at once measure their interference, not themselves.
    results.push(await run({ gesture }));
  }

  return results;
};

const table = async (): Promise<string> => {
  const results = await runAllGestures();
  const windows = results[0]?.windows ?? 0;
  const cell = (result: BenchmarkResult | undefined) =>
    result === undefined ? "—" : `${result.fps} fps (${result.meanMs}ms, p95 ${result.p95Ms}ms)`;

  return [
    "| windows | pan | zoom | drag |",
    "| ------- | --- | ---- | ---- |",
    `| ${windows} | ${cell(results[0])} | ${cell(results[1])} | ${cell(results[2])} |`,
  ].join("\n");
};

/** Record every gesture, shaped for pasting into `benchmark-baseline.ts`'s `RUNS`. */
const baseline = async (): Promise<Readonly<Record<number, BenchmarkBaselineRun>>> => {
  const [pan, zoom, drag] = await runAllGestures();

  // Not a cast. `runAllGestures` returns three results today; a baseline silently missing a
  // gesture is a baseline that approves whatever that gesture later does.
  if (pan === undefined || zoom === undefined || drag === undefined) {
    throw new Error("Benchmark did not produce all three gestures; refusing to record.");
  }

  const entry = (result: BenchmarkResult): BenchmarkBaselineEntry => ({
    meanMs: result.meanMs,
    p95Ms: result.p95Ms,
  });

  return { [pan.windows]: { drag: entry(drag), pan: entry(pan), zoom: entry(zoom) } };
};

type BenchmarkComparison = Readonly<{
  detail: string;
  status: "pass" | "regressed" | "unrecorded";
}>;

/**
 * Compare this machine against the committed baseline.
 *
 * **`unrecorded` is not `pass`.** With no baseline for this window count, there is nothing to
 * compare against, and reporting success would make the gate a decoration. It is the same rule
 * `verify-api-doc.mjs` follows when the barrel grows a form its parser cannot see: refuse,
 * loudly, rather than approve vacuously.
 *
 * A gesture regresses when its `p95` exceeds the baseline by both `REGRESSION_MARGIN` **and**
 * `REGRESSION_FLOOR_MS`. Either alone produces a gate nobody trusts: the fraction alone fires
 * on sub-millisecond jitter, the floor alone lets a 40ms frame become 41 forever.
 *
 * This cannot fail CI today. Nothing runs a browser in CI. What it can do is turn "is this
 * slower?" from an argument into a command, and be ready the day a headless runner exists.
 */
const compare = async (): Promise<BenchmarkComparison> => {
  const results = await runAllGestures();
  const windows = results[0]?.windows ?? 0;
  const recorded = RUNS[windows];

  if (recorded === undefined) {
    return {
      detail:
        `No baseline recorded for ${windows} windows. This is not a pass — there is nothing ` +
        "to compare against. Run `await window.__canvasBench.baseline()` on hardware you " +
        "trust and paste the result into `benchmark-baseline.ts`.",
      status: "unrecorded",
    };
  }

  const regressions = results.filter((result) => {
    const before = recorded[result.gesture].p95Ms;
    const growth = result.p95Ms - before;

    return growth > before * REGRESSION_MARGIN && growth > REGRESSION_FLOOR_MS;
  });

  if (regressions.length === 0) {
    return { detail: `${windows} windows: no gesture regressed.`, status: "pass" };
  }

  return {
    detail: regressions
      .map(
        (result) =>
          `${result.gesture}: p95 ${recorded[result.gesture].p95Ms}ms → ${result.p95Ms}ms`,
      )
      .join("; "),
    status: "regressed",
  };
};

declare global {
  interface Window {
    __canvasBench?: Readonly<{
      baseline: typeof baseline;
      compare: typeof compare;
      run: typeof run;
      table: typeof table;
    }>;
  }
}

/** Dev-only, like `__canvas`. A benchmark harness has no business in a production bundle. */
export function exposeCanvasBenchmark(): void {
  if (!import.meta.env.DEV) {
    return;
  }

  window.__canvasBench = { baseline, compare, run, table };
}
