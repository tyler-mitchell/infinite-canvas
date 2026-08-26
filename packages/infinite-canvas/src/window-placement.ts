import type { InfiniteCanvasRect, InfiniteCanvasSize } from "./types";

/**
 * Where a placement command puts a window inside the region it is given (FOCUS-003).
 *
 * The vocabulary a tiling shortcut needs: halves, quarters, the whole region, and back to
 * natural size in the middle of it. Pointer drags and keyboard placement compile to the same
 * rects because they compute them the same way — this module is the only thing that knows
 * what "left half" means.
 *
 * **Placement does not snap.** `getInfiniteCanvasDropPlacement` runs a dropped rect through
 * `applySnapToRect` so it aligns with its neighbours; a tile must not. A left half nudged a
 * few pixels to align with the window beside it is no longer a left half, and pressing the
 * shortcut twice would give two different rects. Rectangle and Magnet do not snap tiles
 * either. What FOCUS-003 asks for — one canonical placement engine rather than a second
 * hand-rolled path — is this module, not the snap resolver.
 */
type InfiniteCanvasWindowPlacementRegion =
  | "bottom"
  | "bottom-left"
  | "bottom-right"
  | "center"
  | "fill"
  | "left"
  | "right"
  | "top"
  | "top-left"
  | "top-right";

/** A region as fractions of the bounds: origin, then extent. `center` is not a fraction. */
type PlacementFractions = Readonly<{ height: number; width: number; x: number; y: number }>;

const PLACEMENT_FRACTIONS: Readonly<
  Record<Exclude<InfiniteCanvasWindowPlacementRegion, "center">, PlacementFractions>
> = {
  bottom: { height: 0.5, width: 1, x: 0, y: 0.5 },
  "bottom-left": { height: 0.5, width: 0.5, x: 0, y: 0.5 },
  "bottom-right": { height: 0.5, width: 0.5, x: 0.5, y: 0.5 },
  fill: { height: 1, width: 1, x: 0, y: 0 },
  left: { height: 1, width: 0.5, x: 0, y: 0 },
  right: { height: 1, width: 0.5, x: 0.5, y: 0 },
  top: { height: 0.5, width: 1, x: 0, y: 0 },
  "top-left": { height: 0.5, width: 0.5, x: 0, y: 0 },
  "top-right": { height: 0.5, width: 0.5, x: 0.5, y: 0 },
};

/**
 * Grow a clamped extent away from the edge the region is anchored to.
 *
 * A right half narrower than the window's `minSize` has to keep its **right** edge on the
 * bounds and grow leftwards; a left half keeps its left edge. Growing both from the origin
 * would push a too-narrow right half off the right of the screen, which is the one direction
 * the user cannot have meant.
 */
function getClampedAxis(
  boundsOrigin: number,
  boundsExtent: number,
  fractionOrigin: number,
  fractionExtent: number,
  minimumExtent: number,
): Readonly<{ extent: number; origin: number }> {
  const extent = Math.max(boundsExtent * fractionExtent, minimumExtent);
  const isAnchoredToEnd = fractionOrigin + fractionExtent >= 1 && fractionOrigin > 0;
  const origin = isAnchoredToEnd
    ? boundsOrigin + boundsExtent - extent
    : boundsOrigin + boundsExtent * fractionOrigin;

  return { extent, origin };
}

/**
 * The rect a window takes when placed into `region` of `bounds`.
 *
 * `bounds` is whatever the caller considers the placement region — for the keyboard commands
 * it is the viewport projected into world units, so "left half" means the left half of what
 * you can see, not of some unbounded world that has no halves.
 *
 * `size` is the window's current size, used only by `center`. `minSize` floors both axes;
 * a tile smaller than the window can be is grown away from the edge it is anchored to.
 */
function getInfiniteCanvasWindowPlacementRect(
  bounds: InfiniteCanvasRect,
  region: InfiniteCanvasWindowPlacementRegion,
  size: InfiniteCanvasSize,
  minSize: InfiniteCanvasSize = { height: 0, width: 0 },
): InfiniteCanvasRect {
  if (region === "center") {
    const width = Math.max(Math.min(size.width, bounds.width), minSize.width);
    const height = Math.max(Math.min(size.height, bounds.height), minSize.height);

    return {
      height,
      width,
      x: bounds.x + (bounds.width - width) / 2,
      y: bounds.y + (bounds.height - height) / 2,
    };
  }

  const fractions = PLACEMENT_FRACTIONS[region];
  const horizontal = getClampedAxis(
    bounds.x,
    bounds.width,
    fractions.x,
    fractions.width,
    minSize.width,
  );
  const vertical = getClampedAxis(
    bounds.y,
    bounds.height,
    fractions.y,
    fractions.height,
    minSize.height,
  );

  return {
    height: vertical.extent,
    width: horizontal.extent,
    x: horizontal.origin,
    y: vertical.origin,
  };
}

/**
 * The nearest spot of this size that nothing already occupies.
 *
 * **Why this is the framework's and not a consumer's cascade.** A bounded desktop places new
 * windows by offsetting each one a little from the last, because space is scarce and a neat pile is
 * the honest outcome. An infinite canvas has the opposite problem: there is always room, and a
 * consumer that cascades is choosing to overlap for no reason. A 28px step on a 360px window is a
 * 92% overlap on the second opening, and a step that wraps is a pile on the seventh — while empty
 * canvas sits one screen away.
 *
 * The deeper flaw in a cascade is that it counts rather than looks. It knows how many windows
 * exist, never where they are, so opening into a region the user has already filled overlaps no
 * matter how much space is free beside it. This looks.
 *
 * `preferred` is the consumer's policy and stays the consumer's: where a new window *wants* to be —
 * the middle of the view, the pointer, wherever. This answers only whether that spot is clear and,
 * if not, which nearby one is. The search is a widening ring in steps of the rect's own size plus
 * `gapPx`, so results are stable and land on a loose grid rather than at arbitrary offsets;
 * candidates are ordered by distance from `preferred`, because the nearest free spot is the one
 * that best respects the policy that chose it.
 *
 * **Returns `preferred` unchanged when nothing within `bounds` is clear**, rather than placing the
 * window outside the region. A window put somewhere out of view to avoid an overlap is the "did it
 * open?" failure, which is worse than the overlap — and on a canvas this full, overlapping where
 * the user is looking is what they would expect anyway.
 */
function getInfiniteCanvasVacantRect(
  input: Readonly<{
    /** Where placement is allowed — usually the visible world rect. */
    bounds: InfiniteCanvasRect;
    /** Breathing room required between the placed rect and each occupant. */
    gapPx?: number;
    occupied: readonly InfiniteCanvasRect[];
    preferred: InfiniteCanvasRect;
  }>,
): InfiniteCanvasRect {
  const { bounds, gapPx = 0, occupied, preferred } = input;
  const isClear = (candidate: InfiniteCanvasRect) =>
    occupied.every(
      (taken) =>
        candidate.x + candidate.width + gapPx <= taken.x ||
        taken.x + taken.width + gapPx <= candidate.x ||
        candidate.y + candidate.height + gapPx <= taken.y ||
        taken.y + taken.height + gapPx <= candidate.y,
    );

  if (isClear(preferred)) {
    return preferred;
  }

  const stepX = preferred.width + gapPx;
  const stepY = preferred.height + gapPx;
  const columns = Math.max(Math.floor(bounds.width / stepX), 1);
  const rows = Math.max(Math.floor(bounds.height / stepY), 1);
  // Every cell of the loose grid `bounds` admits, nearest to `preferred` first. Distance is measured
  // between origins, which is the same ordering as between centres for rects of one size.
  const candidates = Array.from({ length: columns * rows }, (_unused, index) => ({
    height: preferred.height,
    width: preferred.width,
    x: bounds.x + (index % columns) * stepX,
    y: bounds.y + Math.floor(index / columns) * stepY,
  })).sort(
    (left, right) =>
      (left.x - preferred.x) ** 2 +
      (left.y - preferred.y) ** 2 -
      ((right.x - preferred.x) ** 2 + (right.y - preferred.y) ** 2),
  );

  return candidates.find(isClear) ?? preferred;
}

export { getInfiniteCanvasVacantRect, getInfiniteCanvasWindowPlacementRect };
export type { InfiniteCanvasWindowPlacementRegion };
