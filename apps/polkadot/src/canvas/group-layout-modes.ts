import type { InfiniteCanvasGroupLayoutMode } from "@hyphened/infinite-canvas/legacy";

// Keep this order consistent in all controls.
export const GROUP_LAYOUT_MODES = [
  "split",
  "accordion",
  "tabs",
  "masonry",
] as const satisfies readonly InfiniteCanvasGroupLayoutMode[];
