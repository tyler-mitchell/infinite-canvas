"use client";

import { InfiniteCanvasExperiment } from "#/experiments/infinite-canvas/infinite-canvas-experiment";
import { stressShowcaseWindowCount } from "#/experiments/infinite-canvas/showcases/stress-live-showcase";

const infiniteCanvasFrustumDiagnostics = {
  frustum: true,
} as const;

function InfiniteCanvasFrustumDevtoolsShowcase() {
  return (
    <InfiniteCanvasExperiment
      diagnostics={infiniteCanvasFrustumDiagnostics}
      stressWindowCount={stressShowcaseWindowCount}
    />
  );
}

export { InfiniteCanvasFrustumDevtoolsShowcase };
