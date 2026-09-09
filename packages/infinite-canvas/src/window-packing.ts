import { unionRects } from "./geometry";
import type { InfiniteCanvasRect } from "./types";

/**
 * Packs rects into a strip: fixed width, unbounded height.
 *
 * A canvas is a strip, not a bin. Bin packing minimises how many fixed containers are needed. Here
 * the width is given and the height simply grows, so the problem is to minimise the height used.
 * That is two-dimensional strip packing, and this is its classical level algorithm, First-Fit
 * Decreasing Height (Coffman, Garey, Johnson and Tarjan, 1980), which stays within 1.7 times the
 * best possible height plus one level. A heuristic with a proven bound is enough; a search is not.
 *
 * Levels are the whole idea. Rects arrive tallest first, so the first rect on a level is also its
 * tallest and nothing placed later can hang below it. Rows cannot interleave, and no two results
 * can overlap.
 *
 * Like aligning and distributing, this moves rects and never resizes them, so no caller needs
 * minimum-size clamping.
 */

/** One row. `freeX` is where the next rect on it would start. */
type PackingLevel = Readonly<{ freeX: number; height: number; y: number }>;

type PackingPlacement = Readonly<{ order: number; rect: InfiniteCanvasRect }>;

/** Packs rects into the region they already occupy and preserves size and input order. */
function getInfiniteCanvasPackedRects(
  rects: readonly InfiniteCanvasRect[],
  options: Readonly<{
    /** Space between neighbours, along a level and between levels. */
    gapPx?: number;
    /** Strip width. Defaults to the width the rects already span. */
    stripWidth?: number;
  }> = {},
): readonly InfiniteCanvasRect[] {
  const bounds = unionRects(rects);

  if (bounds === null) {
    return rects;
  }

  const { gapPx = 0, stripWidth = bounds.width } = options;
  const limit = bounds.x + stripWidth;
  /*
   * Tallest first is what makes the levels work. Equal heights keep the caller's order, so tidying
   * a board of same-sized windows shuffles nothing and gives the same answer every time.
   */
  const ordered = rects
    .map((rect, order) => ({ order, rect }))
    .sort((left, right) => right.rect.height - left.rect.height || left.order - right.order);

  const packed = ordered.reduce<
    Readonly<{ levels: readonly PackingLevel[]; placements: readonly PackingPlacement[] }>
  >(
    (state, { order, rect }) => {
      // First fit: the earliest level with room. A rect wider than the strip fits nowhere and
      // opens a level of its own, where it overhangs rather than being silently shrunk.
      const fitting = state.levels.find((level) => level.freeX + rect.width <= limit);
      const last = state.levels[state.levels.length - 1];
      const level = fitting ?? {
        freeX: bounds.x,
        height: rect.height,
        y: last === undefined ? bounds.y : last.y + last.height + gapPx,
      };
      const occupied = { ...level, freeX: level.freeX + rect.width + gapPx };

      return {
        levels:
          fitting === undefined
            ? [...state.levels, occupied]
            : state.levels.map((candidate) => (candidate === fitting ? occupied : candidate)),
        placements: [...state.placements, { order, rect: { ...rect, x: level.freeX, y: level.y } }],
      };
    },
    { levels: [], placements: [] },
  );

  return [...packed.placements]
    .sort((left, right) => left.order - right.order)
    .map((placement) => placement.rect);
}

export { getInfiniteCanvasPackedRects };
