import { createFileRoute } from "@tanstack/react-router";

import { AppShellLayout } from "#/components/app-shell-layout";
import { InfiniteCanvasDynamicGridExperiment } from "#/experiments/infinite-canvas-dynamic-grid/infinite-canvas-dynamic-grid-experiment";

export const Route = createFileRoute("/experiments/infinite-canvas-dynamic-grid")({
  staticData: {
    shellTitle: "Dynamic Grid",
  },
  component: InfiniteCanvasDynamicGridRoute,
});

function InfiniteCanvasDynamicGridRoute() {
  return (
    <AppShellLayout contentClassName="max-w-none overflow-hidden bg-[#171717] p-0">
      <InfiniteCanvasDynamicGridExperiment />
    </AppShellLayout>
  );
}
