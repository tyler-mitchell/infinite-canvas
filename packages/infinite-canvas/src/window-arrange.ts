import { unionRects } from "./geometry";
import type { InfiniteCanvasPoint, InfiniteCanvasRect } from "./types";

/** Aligns, distributes, and swaps window rects without resizing them. */
/** Shared edge or center line. */
type InfiniteCanvasAlignment =
  | "bottom"
  | "horizontal-center"
  | "left"
  | "right"
  | "top"
  | "vertical-center";

/** Distribution axis. */
type InfiniteCanvasDistribution = "horizontal" | "vertical";

// Alignment requires two rects.
const MINIMUM_ALIGN_COUNT = 2;

// Distribution requires one rect between the outer rects.
const MINIMUM_DISTRIBUTE_COUNT = 3;

// Swap requires exactly two rects.
const SWAP_COUNT = 2;

/** Maps each alignment to its changed origin fields. */
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

/** Aligns rects within collective bounds and preserves size and input order. */
function getInfiniteCanvasAlignedRects(
  rects: readonly InfiniteCanvasRect[],
  alignment: InfiniteCanvasAlignment,
): readonly InfiniteCanvasRect[] {
  const bounds = rects.length < MINIMUM_ALIGN_COUNT ? null : unionRects(rects);

  if (bounds === null) {
    return rects;
  }

  return rects.map((rect) => ({ ...rect, ...ALIGNMENT_ORIGINS[alignment](rect, bounds) }));
}

const DISTRIBUTION_AXES: Readonly<
  Record<InfiniteCanvasDistribution, Readonly<{ extent: "height" | "width"; origin: "x" | "y" }>>
> = {
  horizontal: { extent: "width", origin: "x" },
  vertical: { extent: "height", origin: "y" },
};

/** Sets equal gaps and preserves outer positions, rect sizes, and input order. */
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

  // Place in axis order, then restore input order.
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

/** Exchanges centers for exactly two rects and preserves each size. */
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
