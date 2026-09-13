"use client";

import { useObserveEffect } from "@legendapp/state/react";
import { useRef } from "react";

import { INFINITE_CANVAS_SLOTS } from "./data-attributes";
import { getAdaptiveGridSpacing, worldPointToScreenPoint } from "./geometry";
import { useInfiniteCanvasSelector, useInfiniteCanvasState$ } from "./store";
import type { InfiniteCanvasCamera, InfiniteCanvasViewport } from "./types";

/** The major cell in screen pixels: four minor cells. */
function getMajorSpacing(zoom: number) {
  return getAdaptiveGridSpacing(zoom) * zoom * 4;
}

/** Wraps camera translation within one grid cell. */
function getGridShift(camera: InfiniteCanvasCamera, viewport: InfiniteCanvasViewport) {
  const major = getMajorSpacing(camera.zoom);
  const origin = worldPointToScreenPoint(camera, viewport, { x: 0, y: 0 });
  const wrap = (value: number) => ((value % major) + major) % major;

  return `translate(${wrap(origin.x)}px, ${wrap(origin.y)}px)`;
}

function InfiniteCanvasGridBackdrop() {
  const state$ = useInfiniteCanvasState$();
  const gridRef = useRef<HTMLDivElement | null>(null);
  const zoom = useInfiniteCanvasSelector((state) => state.camera.zoom);
  const isMeasured = useInfiniteCanvasSelector(
    (state) => state.viewport.width > 0 && state.viewport.height > 0,
  );

  useObserveEffect(() => {
    const transform = getGridShift(state$.camera.get(), state$.viewport.get());

    if (gridRef.current !== null) {
      gridRef.current.style.transform = transform;
    }
  });

  const major = getMajorSpacing(zoom);
  const minor = major / 4;

  return (
    <div
      aria-hidden="true"
      data-slot={INFINITE_CANVAS_SLOTS.grid}
      ref={gridRef}
      style={{
        backgroundColor: "var(--icx-background)",
        ...(isMeasured
          ? {
              backgroundImage: [
                `linear-gradient(to right, var(--icx-grid-major) 1px, transparent 1px)`,
                `linear-gradient(to bottom, var(--icx-grid-major) 1px, transparent 1px)`,
                `linear-gradient(to right, var(--icx-grid-minor) 1px, transparent 1px)`,
                `linear-gradient(to bottom, var(--icx-grid-minor) 1px, transparent 1px)`,
              ].join(","),
              backgroundSize: [
                `${major}px ${major}px`,
                `${major}px ${major}px`,
                `${minor}px ${minor}px`,
                `${minor}px ${minor}px`,
              ].join(","),
              inset: `${-major}px`,
              transform: getGridShift(state$.camera.peek(), state$.viewport.peek()),
              willChange: "transform",
            }
          : { inset: 0 }),
        pointerEvents: "none",
        position: "absolute",
      }}
    />
  );
}

export { InfiniteCanvasGridBackdrop };
