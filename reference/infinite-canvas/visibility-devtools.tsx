"use client";

import { DEFAULT_INFINITE_CANVAS_STACK_BANDS } from "#/experiments/infinite-canvas/constants";
import { useInfiniteCanvasVisibilitySummary } from "#/experiments/infinite-canvas/visibility";

function InfiniteCanvasVisibilityHud() {
  const summary = useInfiniteCanvasVisibilitySummary();

  return (
    <div
      className="pointer-events-none absolute right-4 top-4 w-[220px] border border-cyan-100/20 bg-[#05080b]/88 p-3 font-mono text-[10px] uppercase leading-relaxed text-white/56 shadow-[0_18px_50px_rgba(0,0,0,0.38)] backdrop-blur-md"
      data-infinite-canvas-visibility-hud="true"
      style={{ zIndex: DEFAULT_INFINITE_CANVAS_STACK_BANDS.overlay }}
    >
      <div className="mb-2 flex items-center justify-between border-b border-white/10 pb-2">
        <div className="text-cyan-100/78">Frustum</div>
        <div className="text-white/34">R3F</div>
      </div>
      <div className="grid gap-1">
        {[
          ["tracked", summary.tracked],
          ["visible", summary.visible],
          ["hidden", summary.hidden],
        ].map(([label, value]) => (
          <div className="flex items-center justify-between gap-3" key={label}>
            <span className="text-white/34">{label}</span>
            <span className="text-white/72">{value}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 border-t border-white/8 pt-2 text-white/34">
        Counts should change as windows enter and leave the viewport.
      </div>
    </div>
  );
}

export { InfiniteCanvasVisibilityHud };
