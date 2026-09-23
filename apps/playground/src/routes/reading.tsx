import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "ui";
import {
  CanvasScroll,
  CanvasTools,
  CanvasViewport,
  Sections,
} from "@hyphened/infinite-canvas/next/react";
import "@hyphened/infinite-canvas/next/theme.css";
import { createSampleCanvas, SampleWindow } from "../showcases/sample-canvas";

export const Route = createFileRoute("/reading")({
  component: ReadingShowcase,
  staticData: {
    showcase: {
      description:
        "The canvas is the page: the document scrolls, the camera follows the layout's reading order, and Explore frees it.",
      order: 2,
      title: "Reading",
    },
  },
});

function Rail() {
  return (
    <Sections.Root className="absolute top-1/2 right-4 z-70 flex -translate-y-1/2 flex-col gap-1">
      {(section) => (
        <Sections.Item
          key={section.id}
          section={section}
          className="rounded px-2 py-1 text-right font-mono text-[11px] text-white/50 aria-[current=true]:text-white"
        />
      )}
    </Sections.Root>
  );
}

function ReadingShowcase() {
  const [canvas] = useState(createSampleCanvas);
  const [exploring, setExploring] = useState(false);
  return (
    <div className="absolute inset-0">
      <CanvasScroll canvas={canvas} attached={!exploring}>
        <CanvasViewport
          canvas={canvas}
          renderWindow={(window) => <SampleWindow canvas={canvas} window={window} />}
        >
          <CanvasTools canvas={canvas} />
          <div
            data-canvas-control
            className="absolute top-4 left-4 z-70 flex gap-2 border border-white/10 bg-black/90 p-2 text-xs"
          >
            <Button size="xs" variant="ghost" onClick={() => setExploring((value) => !value)}>
              {exploring ? "Back to reading" : "Explore"}
            </Button>
          </div>
        </CanvasViewport>
        <Rail />
      </CanvasScroll>
    </div>
  );
}
