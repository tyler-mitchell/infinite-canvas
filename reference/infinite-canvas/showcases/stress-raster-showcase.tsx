"use client";

import { InfiniteCanvasExperiment } from "#/experiments/infinite-canvas/infinite-canvas-experiment";
import { stressShowcaseWindowCount } from "#/experiments/infinite-canvas/showcases/stress-live-showcase";

function InfiniteCanvasStressRasterShowcase() {
  return (
    <InfiniteCanvasExperiment rasterizationEnabled stressWindowCount={stressShowcaseWindowCount} />
  );
}

export { InfiniteCanvasStressRasterShowcase };
