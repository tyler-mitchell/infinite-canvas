"use client";

import { useObserveEffect } from "@legendapp/state/react";
import { useRef, type ReactNode } from "react";

import { worldPointToScreenPoint } from "./geometry";
import { useInfiniteCanvasState$ } from "./react/store";
import type { InfiniteCanvasCamera, InfiniteCanvasViewport } from "./types";

/** The world origin's screen position and the zoom. Not snapped: a snapped origin steps. */
function getCameraTransform(camera: InfiniteCanvasCamera, viewport: InfiniteCanvasViewport) {
  const origin = worldPointToScreenPoint(camera, viewport, { x: 0, y: 0 });

  return `translate(${origin.x}px, ${origin.y}px) scale(${camera.zoom})`;
}

/** Applies camera changes to the world layer without rendering its children. */
function InfiniteCanvasCameraLayer({
  children,
  zIndex,
}: Readonly<{ children: ReactNode; zIndex: number }>) {
  const state$ = useInfiniteCanvasState$();
  const layerRef = useRef<HTMLDivElement | null>(null);

  useObserveEffect(() => {
    const transform = getCameraTransform(state$.camera.get(), state$.viewport.get());

    if (layerRef.current !== null) {
      layerRef.current.style.transform = transform;
    }
  });

  return (
    <div
      ref={layerRef}
      style={{
        inset: 0,
        pointerEvents: "none",
        position: "absolute",
        transform: getCameraTransform(state$.camera.peek(), state$.viewport.peek()),
        transformOrigin: "0 0",
        willChange: "transform",
        zIndex,
      }}
    >
      {children}
    </div>
  );
}

export { InfiniteCanvasCameraLayer };
