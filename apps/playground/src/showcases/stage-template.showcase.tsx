import { useState, type PointerEvent } from "react";
import type { ShowcaseMeta } from "../shell/showcase.ts";

export const meta: ShowcaseMeta = {
  description: "Full-viewport stage pattern for canvas showcases.",
  order: 1,
  title: "Stage template",
};

/**
 * Template for canvas-style showcases: a full-viewport dark stage with a
 * pointer readout. Real framework showcases replace the stage contents with
 * an InfiniteCanvas desktop once the core is ported.
 */
export default function StageTemplateShowcase() {
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
      className="stage-canvas"
      data-testid="stage-canvas"
      onPointerLeave={() => {
        setPointer(null);
      }}
      onPointerMove={onPointerMove}
    >
      <div className="stage-readout" data-testid="stage-readout">
        {pointer ? `${pointer.x}, ${pointer.y}` : "move pointer over stage"}
      </div>
    </div>
  );
}
