import type { InfiniteCanvasPoint, InfiniteCanvasRect } from "./types";

/**
 * Aligning and distributing a set of rects — the arrange verbs a window manager needs and this
 * framework did not have.
 *
 * Sibling to `window-placement.ts`, and deliberately so. That module answers "where does *one*
 * window go inside a region"; this one answers "how do *these* windows relate to each other".
 * Between them they are the only things that know what an arrangement means, which is the same
 * bargain FOCUS-003 struck: one canonical engine, so pointer, keyboard, and programmatic
 * drivers cannot disagree.
 *
 * **These translate; they never resize.** Every rect out has the width and height it came in
 * with. That is not a simplification — it is what makes the operations safe: a window can never
 * be pushed below its own `minSize` by an arrange, so the caller needs no clamping pass and
 * there is no constraint to violate. `window-placement.ts` resizes and therefore has to clamp;
 * this module sidesteps the question by construction.
 *
 * **Alignment is relative to the collective bounds**, never to the viewport. Aligning three
 * windows left means "share the left edge of the leftmost", not "go to the left of the screen"
 * — the latter is `window.place`, and conflating them is how a tool ends up with two commands
 * that both claim to align.
 *
 * Both operations are the identity below their minimum count, rather than an error: an arrange
 * over one window is a no-op the same way a nudge with no selection is, and a caller should not
 * have to guard what the function can answer honestly.
 */

/**
 * Which edge or centreline the rects come to share.
 *
 * The wording is the one every design tool uses (Figma, Illustrator, Keynote), and the axis each
 * one moves along is worth stating because the names alone are ambiguous:
 *
 * - `left` / `right` / `horizontal-center` move along **x** and leave y untouched
 * - `top` / `bottom` / `vertical-center` move along **y** and leave x untouched
 *
 * So `horizontal-center` aligns the rects' horizontal centres — it slides them sideways onto a
 * shared vertical centreline. The name describes the centres being aligned, not the direction of
 * travel, which is the convention the tools settled on and not one worth breaking here.
 */
type InfiniteCanvasAlignment =
  | "bottom"
  | "horizontal-center"
  | "left"
  | "right"
  | "top"
  | "vertical-center";

/** The axis along which spacing is evened out. */
type InfiniteCanvasDistribution = "horizontal" | "vertical";

/** Below this many rects an alignment cannot mean anything: there is nothing to align *to*. */
const MINIMUM_ALIGN_COUNT = 2;

/**
 * Below this many rects a distribution cannot mean anything. Distribution holds the outermost
 * two rects still and respaces what lies between them, so with two there is nothing between.
 */
const MINIMUM_DISTRIBUTE_COUNT = 3;

/** A swap is between two things. Three windows have no unambiguous pairing. */
const SWAP_COUNT = 2;

function getRectsBounds(rects: readonly InfiniteCanvasRect[]): InfiniteCanvasRect | null {
  const [first] = rects;

  if (first === undefined) {
    return null;
  }

  const bounds = rects.reduce(
    (union, rect) => ({
      maxX: Math.max(union.maxX, rect.x + rect.width),
      maxY: Math.max(union.maxY, rect.y + rect.height),
      minX: Math.min(union.minX, rect.x),
      minY: Math.min(union.minY, rect.y),
    }),
    { maxX: first.x + first.width, maxY: first.y + first.height, minX: first.x, minY: first.y },
  );

  return {
    height: bounds.maxY - bounds.minY,
    width: bounds.maxX - bounds.minX,
    x: bounds.minX,
    y: bounds.minY,
  };
}

/**
 * Where one rect's origin lands under each alignment, given the bounds it is aligning within.
 *
 * A lookup of pure functions rather than a switch: each entry is the whole definition of that
 * alignment, and adding one cannot forget a branch.
 */
const ALIGNMENT_ORIGINS: Readonly<
  Record<
    InfiniteCanvasAlignment,
    (rect: InfiniteCanvasRect, bounds: InfiniteCanvasRect) => Partial<InfiniteCanvasRect>
  >
> = {
  bottom: (rect, bounds) => ({ y: bounds.y + bounds.height - rect.height }),
  "horizontal-center": (rect, bounds) => ({ x: bounds.x + (bounds.width - rect.width) / 2 }),
  left: (_rect, bounds) => ({ x: bounds.x }),
  right: (rect, bounds) => ({ x: bounds.x + bounds.width - rect.width }),
  top: (_rect, bounds) => ({ y: bounds.y }),
  "vertical-center": (rect, bounds) => ({ y: bounds.y + (bounds.height - rect.height) / 2 }),
};

/**
 * Align every rect to a shared edge or centreline of their collective bounds.
 *
 * Sizes are preserved exactly; only origins move, and only on the one axis the alignment names.
 * Order is preserved, so a caller pairing rects with window ids by index stays correct.
 */
function getInfiniteCanvasAlignedRects(
  rects: readonly InfiniteCanvasRect[],
  alignment: InfiniteCanvasAlignment,
): readonly InfiniteCanvasRect[] {
  const bounds = rects.length < MINIMUM_ALIGN_COUNT ? null : getRectsBounds(rects);

  if (bounds === null) {
    return rects;
  }

  return rects.map((rect) => ({ ...rect, ...ALIGNMENT_ORIGINS[alignment](rect, bounds) }));
}

/** The axis a distribution operates on, as the two rect fields it reads. */
const DISTRIBUTION_AXES: Readonly<
  Record<InfiniteCanvasDistribution, Readonly<{ extent: "height" | "width"; origin: "x" | "y" }>>
> = {
  horizontal: { extent: "width", origin: "x" },
  vertical: { extent: "height", origin: "y" },
};

/**
 * Even out the **gaps** between rects along one axis, holding the outermost two still.
 *
 * Equal gaps, not equal centres. With rects of differing size the two are different
 * arrangements, and equal gaps is the one that looks right and the one every design tool means
 * by "distribute". Equal centres bunches large rects against their neighbours.
 *
 * The span between the outer edges is fixed by the extremes, so if the rects' total extent
 * exceeds it the gap comes out **negative** and they overlap evenly. That is the honest answer
 * rather than a refusal: the user asked for even spacing of things that do not fit, and even
 * overlap is what even spacing degrades to. Nothing is resized to make room.
 *
 * Order in equals order out. The computation needs the rects sorted along the axis, but the
 * result is mapped back to the caller's ordering — a caller pairing rects with window ids by
 * index would otherwise silently assign every window the wrong rect.
 */
function getInfiniteCanvasDistributedRects(
  rects: readonly InfiniteCanvasRect[],
  distribution: InfiniteCanvasDistribution,
): readonly InfiniteCanvasRect[] {
  if (rects.length < MINIMUM_DISTRIBUTE_COUNT) {
    return rects;
  }

  const { extent, origin } = DISTRIBUTION_AXES[distribution];
  const ordered = rects
    .map((rect, index) => ({ index, rect }))
    .sort((left, right) => left.rect[origin] - right.rect[origin]);

  const first = ordered[0];
  const last = ordered[ordered.length - 1];

  if (first === undefined || last === undefined) {
    return rects;
  }

  const span = last.rect[origin] + last.rect[extent] - first.rect[origin];
  const occupied = ordered.reduce((total, entry) => total + entry.rect[extent], 0);
  const gap = (span - occupied) / (ordered.length - 1);

  // Walk the sorted order carrying the running edge, then scatter back to the caller's indices.
  // `reduce` carries the cursor so nothing needs a mutable binding, and each origin is the
  // previous rect's far edge plus one gap rather than an index times a stride — the latter
  // drifts the moment the rects differ in extent, which is the whole reason to distribute.
  const placed = ordered.reduce<
    Readonly<{
      cursor: number;
      items: readonly Readonly<{ index: number; rect: InfiniteCanvasRect }>[];
    }>
  >(
    (accumulator, entry) => ({
      cursor: accumulator.cursor + entry.rect[extent] + gap,
      items: [
        ...accumulator.items,
        { index: entry.index, rect: { ...entry.rect, [origin]: accumulator.cursor } },
      ],
    }),
    { cursor: first.rect[origin], items: [] },
  );

  const arranged = Array.from(rects);

  for (const item of placed.items) {
    arranged[item.index] = item.rect;
  }

  return arranged;
}

/**
 * Exactly two rects trade places, each keeping its own size.
 *
 * **Centres are exchanged, not origins**, and that choice is the whole design. Swapping origins
 * is what a tiling window manager does, because there the two panes occupy identical slots and
 * the sizes come from the tree. Here windows float at whatever size they were given, so
 * exchanging top-left corners makes a large and a small window trade places *lopsidedly* — the
 * small one lands against the large one's corner and appears to have moved somewhere nobody
 * pointed at. Exchanging centres is what "these two swapped" looks like when the sizes differ,
 * and it reduces to exchanging origins exactly when they do not.
 *
 * Nothing is resized, so no `minSize` clamping is needed: a translation cannot violate it.
 *
 * Returns the input array when the count is not exactly two, matching `getInfiniteCanvasAlignedRects`
 * — the caller compares identity to decide whether the command is available at all.
 */
function getInfiniteCanvasSwappedRects(
  rects: readonly InfiniteCanvasRect[],
): readonly InfiniteCanvasRect[] {
  if (rects.length !== SWAP_COUNT) {
    return rects;
  }

  const [first, second] = rects as readonly [InfiniteCanvasRect, InfiniteCanvasRect];
  const toCentre = (rect: InfiniteCanvasRect) => ({
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
  });
  const place = (rect: InfiniteCanvasRect, centre: InfiniteCanvasPoint): InfiniteCanvasRect => ({
    ...rect,
    x: centre.x - rect.width / 2,
    y: centre.y - rect.height / 2,
  });

  return [place(first, toCentre(second)), place(second, toCentre(first))];
}

export {
  getInfiniteCanvasAlignedRects,
  getInfiniteCanvasDistributedRects,
  getInfiniteCanvasSwappedRects,
};
export type { InfiniteCanvasAlignment, InfiniteCanvasDistribution };
