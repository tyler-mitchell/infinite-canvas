import type { InfiniteCanvasRect } from "./types";

/** Selects full or summary content from the smaller on-screen window dimension. */

/** `full` draws the body. `summary` draws the kind summary. */
type InfiniteCanvasDetailLevel = "full" | "summary";

type InfiniteCanvasDetailPolicy = Readonly<{
  /** Demotes below this screen-pixel size on either axis. */
  summaryBelowPx?: number;
  /** Restores above this screen-pixel size. It must exceed `summaryBelowPx`. */
  fullAbovePx?: number;
}>;

/** Default hysteresis thresholds in screen pixels. */
const DEFAULT_INFINITE_CANVAS_DETAIL_POLICY = {
  fullAbovePx: 160,
  summaryBelowPx: 120,
} as const satisfies Required<InfiniteCanvasDetailPolicy>;

/** Applies hysteresis from the previous detail level. */
function getInfiniteCanvasWindowDetailLevel(
  rect: InfiniteCanvasRect,
  zoom: number,
  previousLevel: InfiniteCanvasDetailLevel = "full",
  policy: InfiniteCanvasDetailPolicy = {},
): InfiniteCanvasDetailLevel {
  const {
    fullAbovePx = DEFAULT_INFINITE_CANVAS_DETAIL_POLICY.fullAbovePx,
    summaryBelowPx = DEFAULT_INFINITE_CANVAS_DETAIL_POLICY.summaryBelowPx,
  } = policy;
  const screenWidth = rect.width * zoom;
  const screenHeight = rect.height * zoom;
  // Use the smaller on-screen dimension.
  const extent = Math.min(screenWidth, screenHeight);

  if (previousLevel === "summary") {
    // Collapse an invalid band to the demotion threshold.
    return extent > Math.max(fullAbovePx, summaryBelowPx) ? "full" : "summary";
  }

  return extent < summaryBelowPx ? "summary" : "full";
}

export { DEFAULT_INFINITE_CANVAS_DETAIL_POLICY, getInfiniteCanvasWindowDetailLevel };
export type { InfiniteCanvasDetailLevel, InfiniteCanvasDetailPolicy };
