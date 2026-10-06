import type { InfiniteCanvasWindow, InfiniteCanvasWindowCapability } from "./types";

/** Returns whether a window permits an action. Missing flags permit actions. */
function isInfiniteCanvasWindowCapable(
  window: InfiniteCanvasWindow<string> | null,
  capability: InfiniteCanvasWindowCapability,
): boolean {
  return window !== null && window.capabilities?.[capability] !== false;
}

export { isInfiniteCanvasWindowCapable };
