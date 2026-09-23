import { createCanvasState, type CanvasOptions } from "@hyphened/infinite-canvas/next";
import { components } from "./components.tsx";

export function createCanvas(document: CanvasOptions["document"]) {
  return createCanvasState({
    document,
    windowDefinitions: components,
    grouping: { type: "grid", rowHeight: 40, compact: true },
    camera: { padding: 12 },
  });
}
