"use client";

import { useMemo, type CSSProperties } from "react";

import { getAdaptiveGridSpacing, worldPointToScreenPoint } from "./geometry";
import { useInfiniteCanvasState } from "./store";
import type { InfiniteCanvasTheme } from "./types";

function InfiniteCanvasGridBackdrop({
  theme,
}: Readonly<{
  theme: InfiniteCanvasTheme;
}>) {
  const state = useInfiniteCanvasState();
  const gridStyle = useMemo(() => {
    if (state.viewport.width <= 0 || state.viewport.height <= 0) {
      return {
        background: theme.background,
      } satisfies CSSProperties;
    }

    const minorSpacing = getAdaptiveGridSpacing(state.camera.zoom) * state.camera.zoom;
    const majorSpacing = minorSpacing * 4;
    const origin = worldPointToScreenPoint(state.camera, state.viewport, {
      x: 0,
      y: 0,
    });

    return {
      backgroundColor: theme.background,
      backgroundImage: [
        `linear-gradient(to right, ${theme.gridMajor} 1px, transparent 1px)`,
        `linear-gradient(to bottom, ${theme.gridMajor} 1px, transparent 1px)`,
        `linear-gradient(to right, ${theme.gridMinor} 1px, transparent 1px)`,
        `linear-gradient(to bottom, ${theme.gridMinor} 1px, transparent 1px)`,
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
  }, [state.camera, state.viewport, theme]);

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={gridStyle} />
  );
}

export { InfiniteCanvasGridBackdrop };
