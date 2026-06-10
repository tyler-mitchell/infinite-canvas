"use client";

import { InfiniteCanvasExperiment } from "#/experiments/infinite-canvas/infinite-canvas-experiment";

const stressShowcaseWindowCount = 40;

function InfiniteCanvasStressLiveShowcase() {
  return <InfiniteCanvasExperiment stressWindowCount={stressShowcaseWindowCount} />;
}

export { InfiniteCanvasStressLiveShowcase, stressShowcaseWindowCount };
