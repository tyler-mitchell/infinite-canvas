"use client";

import type { ReactNode } from "react";

import { InfiniteCanvasDesktop } from "#/experiments/infinite-canvas/infinite-canvas";
import {
  sampleInfiniteCanvasState,
  sampleInfiniteCanvasWindowRegistry,
  type SampleCanvasWindowKind,
} from "#/experiments/infinite-canvas/sample-layout";
import type { InfiniteCanvasDiagnosticsPolicyInput } from "#/experiments/infinite-canvas/diagnostics";
import type { InfiniteCanvasRasterizationPolicyInput } from "#/experiments/infinite-canvas/rasterization-layer";
import type {
  InfiniteCanvasOverlayRenderContext,
  InfiniteCanvasState,
  InfiniteCanvasWindowRegistry,
} from "#/experiments/infinite-canvas/types";

function InfiniteCanvasDesktopRoot({
  className = "h-full min-h-0 rounded-[1.25rem] border border-white/8",
  diagnostics,
  documentKey,
  initialState = sampleInfiniteCanvasState,
  persistence = true,
  rasterization,
  renderOverlay,
  storageKey,
  subtitle = "One WebGPU spatial surface, one DOM body plane, one pure window model.",
  title = "Infinite Canvas Framework",
  windowDefinitions = sampleInfiniteCanvasWindowRegistry,
}: Readonly<{
  className?: string;
  diagnostics?: InfiniteCanvasDiagnosticsPolicyInput;
  documentKey?: string;
  initialState?: InfiniteCanvasState<SampleCanvasWindowKind>;
  persistence?: boolean;
  rasterization?: InfiniteCanvasRasterizationPolicyInput | boolean;
  renderOverlay?: (
    context: InfiniteCanvasOverlayRenderContext<SampleCanvasWindowKind>,
  ) => ReactNode;
  storageKey?: string;
  subtitle?: string;
  title?: string;
  windowDefinitions?: InfiniteCanvasWindowRegistry<SampleCanvasWindowKind>;
}>) {
  const resolvedStorageKey = persistence
    ? (storageKey ?? "kek.infinite-canvas.framework.v1")
    : undefined;

  return (
    <InfiniteCanvasDesktop
      className={className}
      diagnostics={diagnostics}
      documentKey={documentKey}
      initialState={initialState}
      rasterization={rasterization}
      renderOverlay={renderOverlay}
      storageKey={resolvedStorageKey}
      subtitle={subtitle}
      title={title}
      windowDefinitions={windowDefinitions}
    />
  );
}

export { InfiniteCanvasDesktopRoot as InfiniteCanvasDesktop };
