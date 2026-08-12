import type { InfiniteCanvasRect } from "./types";

/**
 * How much of a window to draw at the size it currently occupies on screen — the readability
 * half of P7, and the half that has nothing to do with the capture lane.
 *
 * Those two were one roadmap item for a long time and should not have been. Rasterization
 * modernization is gated on a browser flag; this is gated on nothing. And rasterization could
 * never have solved the problem it was filed under: **a rasterized paragraph is still a
 * paragraph.** Snapshotting a window at 15% zoom gives you the same unreadable text, only
 * blurrier and cheaper. At far zoom a window has to say something *different* — a title, an
 * icon, a count — not the same thing smaller.
 *
 * The threshold is on **effective screen size**, not on zoom. Zoom is a property of the camera
 * and readability is a property of the window: at 20% zoom a 200px window is 40px and illegible
 * while a 1200px window is 240px and perfectly readable. Thresholding on zoom would demote both
 * or neither, which is why every LOD system that works measures the thing on screen.
 *
 * Pure, and the whole module is one decision. Nothing here renders; the caller owns what a
 * summary looks like, exactly as it owns what a body looks like.
 */

/** `full` draws the window's body. `summary` draws whatever the kind declares instead. */
type InfiniteCanvasDetailLevel = "full" | "summary";

type InfiniteCanvasDetailPolicy = Readonly<{
  /**
   * Screen pixels. A window whose on-screen width **and** height both fall below this drops to
   * `summary`. Both axes, not either: a wide, short window is still readable, and demoting it
   * because it is short would hide content the user can plainly see.
   */
  summaryBelowPx?: number;
  /**
   * Screen pixels at which a `summary` window returns to `full`. Must exceed `summaryBelowPx`,
   * and the gap between them is the hysteresis band.
   *
   * **Without a band, a window sitting exactly at the threshold flickers between its body and
   * its summary for every pixel of zoom** — and zoom is continuous, so "exactly at the
   * threshold" is somewhere on screen almost always. The snap resolver already carries
   * hysteresis for precisely this reason (acquire at 10px, release at 18px); this is the same
   * problem in a different dimension and takes the same answer.
   */
  fullAbovePx?: number;
}>;

/**
 * 180 screen pixels is roughly where a window stops being able to hold a legible line of body
 * text plus its chrome. The return threshold sits 60px above it, wide enough that a deliberate
 * zoom crosses it once and a jittery trackpad does not cross it at all.
 */
const DEFAULT_INFINITE_CANVAS_DETAIL_POLICY = {
  fullAbovePx: 240,
  summaryBelowPx: 180,
} as const satisfies Required<InfiniteCanvasDetailPolicy>;

/**
 * The detail level a window should render at, given where it was.
 *
 * `previousLevel` is what makes the hysteresis band work while keeping this a pure function:
 * the caller holds the last answer and hands it back, rather than this module holding state it
 * would then have to invalidate. A caller with nothing to hand back passes `"full"`, which is
 * the correct cold-start answer — a window that has never been drawn should be drawn.
 *
 * The two thresholds are read in the direction the window is *currently* in, which is the whole
 * point of a band: a `full` window must fall below `summaryBelowPx` to be demoted, and a
 * `summary` window must rise above `fullAbovePx` to be restored. Between them, nothing changes.
 */
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
  // The window's smaller on-screen dimension decides: a window is unreadable as soon as either
  // axis collapses, and taking the larger would keep a 600×20 sliver at full detail.
  const extent = Math.min(screenWidth, screenHeight);

  if (previousLevel === "summary") {
    // A misconfigured band (return threshold at or below the demote threshold) would make the
    // two rules contradict and the window flicker — exactly what the band exists to prevent.
    // Trusting the demote threshold alone degrades to no hysteresis rather than to nonsense.
    return extent > Math.max(fullAbovePx, summaryBelowPx) ? "full" : "summary";
  }

  return extent < summaryBelowPx ? "summary" : "full";
}

export { DEFAULT_INFINITE_CANVAS_DETAIL_POLICY, getInfiniteCanvasWindowDetailLevel };
export type { InfiniteCanvasDetailLevel, InfiniteCanvasDetailPolicy };
