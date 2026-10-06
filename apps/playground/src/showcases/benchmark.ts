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

/** The benchmark measures 90 frames after warm-up, approximately 1.5 seconds at 60 fps. */
const BENCHMARK_FRAMES = 90;

const PAN_DELTA_PX = 12;
const ZOOM_DELTA_PX = 4;

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

const getDragHandle = (): HTMLElement => {
  const header = document.querySelector<HTMLElement>("[data-slot='window-header']");

  if (header === null) {
    throw new Error("No window header found. Does this canvas have windows?");
  }

  return header;
};

const getWindowCount = (): number => document.querySelectorAll("[data-slot='window']").length;

/** Pixel-mode wheel events model trackpad pan and pinch zoom. */
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
  // Nearest-rank p95 keeps each result tied to an observed frame.
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

/** This function measures one gesture after one warm-up frame. */
const run = async ({
  gesture,
}: Readonly<{ gesture: BenchmarkGesture }>): Promise<BenchmarkResult> => {
  const viewport = getViewport();
  const windows = getWindowCount();
  // The drag starts at the center of the real handle.
  const origin = (gesture === "drag" ? getDragHandle() : viewport).getBoundingClientRect();
  const originX = origin.left + origin.width / 2;
  const originY = origin.top + origin.height / 2;

  if (gesture === "drag") {
    dispatchPointer(getDragHandle(), "pointerdown", originX, originY);
  }

  // The first frame includes interaction setup, so exclude it.
  let previous = await nextFrame();
  const durations: number[] = [];

  for (let frame = 0; frame < BENCHMARK_FRAMES; frame += 1) {
    if (gesture === "drag") {
      // The drag moves on window because the listener is mount-scoped there.
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

const runAllGestures = async (): Promise<readonly BenchmarkResult[]> => {
  const results: BenchmarkResult[] = [];

  for (const gesture of ["pan", "zoom", "drag"] as const) {
    // The sequence prevents concurrent input.
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

/** This function shapes results for RUNS. */
const baseline = async (): Promise<Readonly<Record<number, BenchmarkBaselineRun>>> => {
  const [pan, zoom, drag] = await runAllGestures();

  // The baseline rejects incomplete gesture results.
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

/** This function compares p95 values with the current window-count baseline. */
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

/** This function exposes the benchmark only in development builds. */
export function exposeCanvasBenchmark(): void {
  if (!import.meta.env.DEV) {
    return;
  }

  window.__canvasBench = { baseline, compare, run, table };
}
