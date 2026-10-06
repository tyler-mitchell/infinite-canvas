import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Button } from "ui";
import { CanvasTools, CanvasViewport } from "@hyphened/infinite-canvas/react";
import "@hyphened/infinite-canvas/theme.css";
import { CanvasCommands } from "../showcases/canvas-commands";
import { CanvasMinimap } from "../showcases/canvas-minimap";
import { createDenseCanvas, DenseWindow } from "../showcases/dense-canvas";

type StressSearch = { count: number };

export const Route = createFileRoute("/stress")({
  component: StressShowcase,
  staticData: {
    showcase: {
      description: "Dense generated layouts; window bodies thin out as the camera pulls back.",
      order: 5,
      title: "Stress",
    },
  },
  validateSearch: (search: Record<string, unknown>): StressSearch => ({
    count: clampCount(Number(search.count ?? 40)),
  }),
});

function clampCount(value: number) {
  return Number.isFinite(value) ? Math.min(Math.max(Math.round(value), 1), 220) : 40;
}

const countPresets = [20, 40, 80, 160] as const;

function StressShowcase() {
  const { count } = Route.useSearch();
  const navigate = Route.useNavigate();
  const canvas = useMemo(() => createDenseCanvas(count), [count]);

  return (
    <div className="absolute inset-0">
      <CanvasViewport
        canvas={canvas}
        emptyCanvasDrag="marquee"
        renderWindow={(window) => <DenseWindow window={window} />}
      >
        <CanvasCommands canvas={canvas} />
        <CanvasTools canvas={canvas} />
        <CanvasMinimap canvas={canvas} />
        <div className="pointer-events-none absolute bottom-4 left-4 z-[70] flex items-center gap-1.5">
          <div className="pointer-events-auto flex items-center gap-1.5 rounded-lg border border-border bg-popover/90 p-1.5 backdrop-blur">
            {countPresets.map((preset) => (
              <Button
                key={preset}
                onClick={() => void navigate({ search: () => ({ count: preset }) })}
                size="xs"
                variant={count === preset ? "secondary" : "ghost"}
              >
                {preset}
              </Button>
            ))}
          </div>
        </div>
      </CanvasViewport>
    </div>
  );
}
