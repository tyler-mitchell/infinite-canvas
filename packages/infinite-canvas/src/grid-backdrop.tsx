"use client";

import { useMemo, type CSSProperties } from "react";

import { INFINITE_CANVAS_SLOTS } from "./data-attributes";
import { getAdaptiveGridSpacing, worldPointToScreenPoint } from "./geometry";
import { useInfiniteCanvasState } from "./store";

function InfiniteCanvasGridBackdrop() {
  const state = useInfiniteCanvasState();
  const gridStyle = useMemo(() => {
    if (state.viewport.width <= 0 || state.viewport.height <= 0) {
      return {
        background: "var(--icx-background)",
      } satisfies CSSProperties;
    }

    const minorSpacing = getAdaptiveGridSpacing(state.camera.zoom) * state.camera.zoom;
    const majorSpacing = minorSpacing * 4;
    const origin = worldPointToScreenPoint(state.camera, state.viewport, {
      x: 0,
      y: 0,
    });

    return {
      backgroundColor: "var(--icx-background)",
      backgroundImage: [
        `linear-gradient(to right, var(--icx-grid-major) 1px, transparent 1px)`,
        `linear-gradient(to bottom, var(--icx-grid-major) 1px, transparent 1px)`,
        `linear-gradient(to right, var(--icx-grid-minor) 1px, transparent 1px)`,
        `linear-gradient(to bottom, var(--icx-grid-minor) 1px, transparent 1px)`,
      ].join(","),
      backgroundPosition: [
        `${origin.x}px ${origin.y}px`,
        `${origin.x}px ${origin.y}px`,
        `${origin.x}px ${origin.y}px`,
        `${origin.x}px ${origin.y}px`,
      ].join(","),
      backgroundSize: [
        `${majorSpacing}px ${majorSpacing}px`,
        `${majorSpacing}px ${majorSpacing}px`,
        `${minorSpacing}px ${minorSpacing}px`,
        `${minorSpacing}px ${minorSpacing}px`,
      ].join(","),
    } satisfies CSSProperties;
  }, [state.camera, state.viewport]);

  return (
    <div
      aria-hidden="true"
      data-slot={INFINITE_CANVAS_SLOTS.grid}
      style={{
        inset: 0,
        pointerEvents: "none",
        position: "absolute",
        ...gridStyle,
      }}
    />
  );
}

export { InfiniteCanvasGridBackdrop };
