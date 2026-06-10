"use client";

import { DEFAULT_INFINITE_CANVAS_STACK_BANDS } from "./constants";
import { useInfiniteCanvasRasterPolicy, useInfiniteCanvasRasterSummary } from "./rasterization";

function InfiniteCanvasRasterHud() {
  const rasterizationPolicy = useInfiniteCanvasRasterPolicy();
  const summary = useInfiniteCanvasRasterSummary();

  if (!rasterizationPolicy.enabled) {
    return null;
  }

  if (rasterizationPolicy.debug) {
    const displayMetrics = [
      ["displayed", summary.displayed],
      ["live", summary.live],
      ["snapshot", summary.snapshot],
      ["ready", summary.ready],
      ["queued", summary.queued],
      ["capturing", summary.capturing],
      ["failed", summary.failed],
      ["paused", summary.paused ? "yes" : "no"],
    ] as const;
    const runtimeMetrics = [
      ["active", summary.activeCaptures],
      ["queue", summary.queuedCaptures],
      ["started", summary.totalStarted],
      ["finished", summary.totalReady],
      ["errored", summary.totalFailed],
      ["avg ms", formatRasterMetric(summary.averageCaptureMs)],
      ["last ms", formatRasterMetric(summary.latestCaptureMs)],
    ] as const;

    return (
      <div
        className="pointer-events-none absolute right-4 top-4 w-[280px] border border-cyan-100/20 bg-[#05080b]/88 p-3 font-mono text-[10px] uppercase leading-relaxed text-white/56 shadow-[0_18px_50px_rgba(0,0,0,0.38)] backdrop-blur-md"
        data-infinite-canvas-raster-devtools="true"
        style={{ zIndex: DEFAULT_INFINITE_CANVAS_STACK_BANDS.overlay }}
      >
        <div className="mb-2 flex items-center justify-between border-b border-white/10 pb-2">
          <div className="text-cyan-100/78">Raster Devtools</div>
          <div className="text-white/34">{rasterizationPolicy.adapter}</div>
        </div>
        <div className="mb-3 grid grid-cols-2 gap-x-3 gap-y-1">
          {displayMetrics.map(([label, value]) => (
            <div className="flex items-center justify-between gap-3" key={label}>
              <span className="text-white/34">{label}</span>
              <span className="text-white/72">{value}</span>
            </div>
          ))}
        </div>
        <div className="mb-3 grid grid-cols-2 gap-x-3 gap-y-1 border-t border-white/8 pt-2">
          {runtimeMetrics.map(([label, value]) => (
            <div className="flex items-center justify-between gap-3" key={label}>
              <span className="text-white/34">{label}</span>
              <span className="text-white/72">{value}</span>
            </div>
          ))}
        </div>
        <div className="grid gap-1 border-t border-white/8 pt-2 text-white/42">
          <div className="flex justify-between gap-3">
            <span>schedule</span>
            <span className="text-white/62">{rasterizationPolicy.captureScheduling}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span>format</span>
            <span className="text-white/62">{rasterizationPolicy.format}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span>cache</span>
            <span className="text-white/62">{rasterizationPolicy.cache}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span>concurrency</span>
            <span className="text-white/62">{rasterizationPolicy.maxConcurrentCaptures}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span>pending cap</span>
            <span className="text-white/62">
              {formatRasterLimit(rasterizationPolicy.maxPendingCaptures)}
            </span>
          </div>
          <div className="flex justify-between gap-3">
            <span>delay</span>
            <span className="text-white/62">{rasterizationPolicy.captureDelayMs}ms</span>
          </div>
          <div className="flex justify-between gap-3">
            <span>stagger</span>
            <span className="text-white/62">{rasterizationPolicy.captureStaggerMs}ms</span>
          </div>
          {summary.latestEvent === null ? null : (
            <div className="mt-1 truncate border-t border-white/8 pt-2 text-cyan-100/60">
              {summary.latestEvent}
            </div>
          )}
          {summary.latestError === null ? null : (
            <div className="mt-1 line-clamp-2 text-[#ffb4a8]">{summary.latestError}</div>
          )}
          <div className="mt-1 border-t border-white/8 pt-2 text-white/34">
            Active, selected, and native-scroll windows intentionally stay live.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="pointer-events-none absolute right-4 top-4 border border-white/10 bg-black/55 px-3 py-2 font-mono text-[10px] uppercase leading-relaxed text-white/48 backdrop-blur-sm"
      data-infinite-canvas-raster-hud="true"
      style={{ zIndex: DEFAULT_INFINITE_CANVAS_STACK_BANDS.overlay }}
    >
      <div className="text-cyan-100/70">Raster</div>
      <div>displayed {summary.displayed}</div>
      <div>live DOM {summary.live}</div>
      <div>snapshot {summary.snapshot}</div>
      <div>queued {summary.queued}</div>
      <div>capturing {summary.capturing}</div>
      <div>ready {summary.ready}</div>
      {summary.live > 0 ? <div className="text-white/36">interactive windows stay live</div> : null}
      {summary.paused ? <div className="text-cyan-100/60">paused</div> : null}
      {summary.failed > 0 ? <div className="text-[#ffb4a8]">failed {summary.failed}</div> : null}
    </div>
  );
}

const formatRasterMetric = (value: number | null): string => (value === null ? "-" : `${value}`);
const formatRasterLimit = (value: number): string =>
  Number.isFinite(value) ? `${value}` : "unbounded";

export { InfiniteCanvasRasterHud };
