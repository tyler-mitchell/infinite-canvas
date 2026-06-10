"use client";

import { InfiniteCanvasExperiment } from "#/experiments/infinite-canvas/infinite-canvas-experiment";
import { stressShowcaseWindowCount } from "#/experiments/infinite-canvas/showcases/stress-live-showcase";

function InfiniteCanvasRasterDevtoolsShowcase() {
  return (
    <InfiniteCanvasExperiment
      rasterizationDebug
      rasterizationEnabled
      stressWindowCount={stressShowcaseWindowCount}
    />
  );
}

export { InfiniteCanvasRasterDevtoolsShowcase };
