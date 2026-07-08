import { createFileRoute } from "@tanstack/react-router";
import { InfiniteCanvasDesktop } from "@infinite-canvas/react";
import { useMemo } from "react";
import { Button } from "ui";
import { exposeCanvasBenchmark } from "../showcases/benchmark.ts";
import { exposeCanvasDevHandle } from "../showcases/dev-handle.ts";
import {
  createStressInfiniteCanvasState,
  sampleInfiniteCanvasWindowRegistry,
} from "../showcases/sample-layout.tsx";

type StressSearch = {
  count: number;
  raster: boolean;
  debug: boolean;
};

export const Route = createFileRoute("/stress")({
  component: StressShowcase,
  staticData: {
    showcase: {
      description: "Dense generated layouts; live DOM vs rasterized bodies.",
      order: 5,
      title: "Stress",
    },
  },
  validateSearch: (search: Record<string, unknown>): StressSearch => ({
    count: clampCount(Number(search.count ?? 40)),
    debug: search.debug === true || search.debug === "true",
    raster: search.raster === true || search.raster === "true",
  }),
});

function clampCount(value: number) {
  return Number.isFinite(value) ? Math.min(Math.max(Math.round(value), 1), 220) : 40;
}

const countPresets = [20, 40, 80, 160] as const;

function StressShowcase() {
  const { count, debug, raster } = Route.useSearch();
  const navigate = Route.useNavigate();
  const initialState = useMemo(() => createStressInfiniteCanvasState(count), [count]);
  const rasterization = useMemo(() => (raster ? { debug, enabled: true } : false), [debug, raster]);

  return (
    <div className="absolute inset-0">
      <InfiniteCanvasDesktop
        documentKey={`stress-${count}-${raster ? "raster" : "live"}`}
        initialState={initialState}
        rasterization={rasterization}
        renderOverlay={(context) => {
          exposeCanvasDevHandle(context);
          // `window.__canvasBench.table()` in the console. This is the only route with
          // enough windows for the numbers to mean anything.
          exposeCanvasBenchmark();
          return (
            <div className="pointer-events-none absolute bottom-4 left-4 z-[70] flex items-center gap-1.5">
              <div className="pointer-events-auto flex items-center gap-1.5 rounded-lg border border-border bg-popover/90 p-1.5 backdrop-blur">
                {countPresets.map((preset) => (
                  <Button
                    key={preset}
                    onClick={() =>
                      void navigate({ search: (prev) => ({ ...prev, count: preset }) })
                    }
                    size="xs"
                    variant={count === preset ? "secondary" : "ghost"}
                  >
                    {preset}
                  </Button>
                ))}
                <span className="mx-1 h-4 w-px bg-border" />
                <Button
                  onClick={() =>
                    void navigate({ search: (prev) => ({ ...prev, raster: !prev.raster }) })
                  }
                  size="xs"
                  variant={raster ? "secondary" : "ghost"}
                >
                  raster {raster ? "on" : "off"}
                </Button>
                <Button
                  onClick={() =>
                    void navigate({ search: (prev) => ({ ...prev, debug: !prev.debug }) })
                  }
                  size="xs"
                  variant={debug ? "secondary" : "ghost"}
                >
                  debug
                </Button>
              </div>
            </div>
          );
        }}
        subtitle={`${count} generated windows · bodies ${raster ? "rasterize when eligible" : "stay live DOM"}.`}
        title="Stress"
        windowDefinitions={sampleInfiniteCanvasWindowRegistry}
      />
    </div>
  );
}
