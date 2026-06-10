import { createFileRoute } from "@tanstack/react-router";
import { useState, type PointerEvent } from "react";

export const Route = createFileRoute("/stage-template")({
  component: StageTemplateShowcase,
  staticData: {
    showcase: {
      description: "Full-viewport stage pattern for canvas showcases.",
      order: 90,
      title: "Stage template",
    },
  },
});

/**
 * Template for canvas-style showcases: a full-viewport dark stage with a
 * pointer readout. Real framework showcases replace the stage contents with
 * an InfiniteCanvas desktop.
 */
function StageTemplateShowcase() {
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setPointer({
      x: Math.round(event.clientX - rect.left),
      y: Math.round(event.clientY - rect.top),
    });
  };

  return (
    <div
      className="absolute inset-0 touch-none bg-surface-stage [background-image:radial-gradient(var(--surface-stage-dot)_1px,transparent_1px)] [background-position:20px_20px] [background-size:40px_40px]"
      data-testid="stage-canvas"
      onPointerLeave={() => {
        setPointer(null);
      }}
      onPointerMove={onPointerMove}
    >
      <div
        className="pointer-events-none absolute right-4 bottom-3.5 font-mono text-xs text-muted-foreground"
        data-testid="stage-readout"
      >
        {pointer ? `${pointer.x}, ${pointer.y}` : "move pointer over stage"}
      </div>
    </div>
  );
}
