"use client";

import {
  getInfiniteCanvasWindowPresence,
  type InfiniteCanvasOverlayRenderContext,
} from "#/experiments/infinite-canvas";
import { InfiniteCanvasExperiment } from "#/experiments/infinite-canvas/infinite-canvas-experiment";
import type { SampleCanvasWindowKind } from "#/experiments/infinite-canvas/sample-layout";

function InfiniteCanvasNormalShowcase() {
  return <InfiniteCanvasExperiment renderOverlay={renderSampleWindowDock} />;
}

function renderSampleWindowDock(
  context: InfiniteCanvasOverlayRenderContext<SampleCanvasWindowKind>,
) {
  const presence = getInfiniteCanvasWindowPresence(context.state);
  const dockItems = [...presence.pinned, ...presence.minimized].filter(
    (window, index, windows) =>
      windows.findIndex((candidate) => candidate.id === window.id) === index,
  );

  if (dockItems.length === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute bottom-4 left-4 z-[70]">
      <div className="pointer-events-auto min-w-56 border border-white/10 bg-[#05080b]/90 p-2 shadow-[0_18px_54px_-38px_rgba(142,230,240,0.7)]">
        <div className="mb-2 px-1 font-mono text-[9px] uppercase tracking-[0.16em] text-white/38">
          Dock
        </div>
        <div className="grid gap-1">
          {dockItems.map((window) => (
            <button
              className={[
                "flex items-center justify-between border px-2 py-1.5 text-left text-[10px] uppercase tracking-[0.08em] transition-colors",
                window.isActive
                  ? "border-cyan-100/42 bg-cyan-100/[0.08] text-cyan-50"
                  : "border-white/10 bg-white/[0.035] text-white/58 hover:border-white/20 hover:text-white/78",
              ].join(" ")}
              key={window.id}
              onClick={() => {
                if (window.mode === "minimized") {
                  context.actions.restoreWindow(window.id);
                }

                context.actions.focusWindow(window.id);
                context.actions.navigateToWindow({
                  windowId: window.id,
                });
              }}
              onPointerDown={(event) => {
                event.stopPropagation();
              }}
              type="button"
            >
              <span>{window.title}</span>
              <span className="ml-4 text-white/35">
                {window.mode === "minimized" ? "restore" : window.isPinned ? "pinned" : "open"}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export { InfiniteCanvasNormalShowcase };
