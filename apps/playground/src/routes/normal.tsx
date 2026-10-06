import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CanvasTools, CanvasViewport } from "@hyphened/infinite-canvas/react";
import "@hyphened/infinite-canvas/theme.css";
import { CanvasCommands } from "../showcases/canvas-commands";
import { CanvasMinimap } from "../showcases/canvas-minimap";
import { createSampleCanvas, SampleDock, SampleWindow } from "../showcases/sample-canvas";

export const Route = createFileRoute("/normal")({
  component: NormalShowcase,
  staticData: {
    showcase: {
      description: "The canonical sample document: pan, zoom, select, and arrange.",
      order: 1,
      title: "Normal",
    },
  },
});

function NormalShowcase() {
  const [canvas] = useState(createSampleCanvas);
  return (
    <div className="absolute inset-0">
      <CanvasViewport
        canvas={canvas}
        emptyCanvasDrag="marquee"
        renderWindow={(window) => <SampleWindow canvas={canvas} window={window} />}
      >
        <CanvasCommands canvas={canvas} />
        <CanvasTools canvas={canvas} />
        <SampleDock canvas={canvas} />
        <CanvasMinimap canvas={canvas} />
      </CanvasViewport>
    </div>
  );
}
