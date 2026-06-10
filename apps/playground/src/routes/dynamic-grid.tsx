import { createFileRoute } from "@tanstack/react-router";
import { InfiniteCanvasDynamicGridExperiment } from "../showcases/dynamic-grid-experiment.tsx";

export const Route = createFileRoute("/dynamic-grid")({
  component: DynamicGridShowcase,
  staticData: {
    showcase: {
      description: "Living reference: the nodegrid motion study (aesthetic source material).",
      order: 80,
      title: "Dynamic grid",
    },
  },
});

function DynamicGridShowcase() {
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#171717]">
      <InfiniteCanvasDynamicGridExperiment />
    </div>
  );
}
