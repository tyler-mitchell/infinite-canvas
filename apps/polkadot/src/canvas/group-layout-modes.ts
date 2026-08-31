import type { InfiniteCanvasGroupLayoutMode } from "@hyphened/infinite-canvas";

// Keep this order consistent in all controls.
export const GROUP_LAYOUT_MODES = [
  "split",
  "accordion",
  "tabs",
] as const satisfies readonly InfiniteCanvasGroupLayoutMode[];
