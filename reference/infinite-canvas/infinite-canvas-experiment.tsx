"use client";

import { useMemo, type ReactNode } from "react";

import type { InfiniteCanvasDiagnosticsPolicyInput } from "#/experiments/infinite-canvas/diagnostics";
import { InfiniteCanvasDesktop } from "#/experiments/infinite-canvas/desktop-root";
import {
  createStressInfiniteCanvasState,
  type SampleCanvasWindowKind,
} from "#/experiments/infinite-canvas/sample-layout";
import type { InfiniteCanvasOverlayRenderContext } from "#/experiments/infinite-canvas";

function InfiniteCanvasExperiment({
  diagnostics,
  rasterizationDebug = false,
  rasterizationEnabled = false,
  renderOverlay,
  stressWindowCount = null,
}: Readonly<{
  diagnostics?: InfiniteCanvasDiagnosticsPolicyInput;
  rasterizationDebug?: boolean;
  rasterizationEnabled?: boolean;
  renderOverlay?: (
    context: InfiniteCanvasOverlayRenderContext<SampleCanvasWindowKind>,
  ) => ReactNode;
  stressWindowCount?: number | null;
}>) {
  const stressState = useMemo(
    () => (stressWindowCount === null ? null : createStressInfiniteCanvasState(stressWindowCount)),
    [stressWindowCount],
  );
  const rasterization = useMemo(
    () =>
      rasterizationEnabled
        ? {
            debug: rasterizationDebug,
            enabled: true,
          }
        : false,
    [rasterizationDebug, rasterizationEnabled],
  );
  const documentKey = stressWindowCount === null ? "sample" : `stress-${stressWindowCount}`;

  return (
    <main className="flex h-full min-h-0 flex-1 overflow-hidden">
      <InfiniteCanvasDesktop
        diagnostics={diagnostics}
        documentKey={documentKey}
        initialState={stressState ?? undefined}
        persistence={stressState === null}
        rasterization={rasterization}
        renderOverlay={renderOverlay}
        subtitle={
          stressState === null
            ? undefined
            : "Stress mode uses a generated dense layout and skips persistence."
        }
        title={
          stressState === null
            ? undefined
            : `Infinite Canvas Stress Test (${stressState.windows.length} windows)`
        }
      />
    </main>
  );
}

export { InfiniteCanvasExperiment };
