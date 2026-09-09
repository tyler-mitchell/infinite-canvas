import type { Lattice } from "./pack.ts";

export interface BoardBreakpoint {
  /** Board width at or above which this column count applies. */
  readonly minWidth: number;
  readonly columns: number;
}

/**
 * Spans are authored against 16 columns, so a 1x1 skill tile is a genuinely small square that
 * packs into the crevices a card leaves behind.
 */
export const REFERENCE_COLUMNS = 16;

export const DEFAULT_BOARD_BREAKPOINTS: readonly BoardBreakpoint[] = [
  { minWidth: 1120, columns: 16 },
  { minWidth: 880, columns: 13 },
  { minWidth: 660, columns: 10 },
  { minWidth: 470, columns: 8 },
  { minWidth: 0, columns: 6 },
];

export const DEFAULT_BOARD_GAP = 12;

export const resolveColumns = (
  width: number,
  breakpoints: readonly BoardBreakpoint[] = DEFAULT_BOARD_BREAKPOINTS,
) =>
  breakpoints.find((breakpoint) => width >= breakpoint.minWidth)?.columns ??
  breakpoints[breakpoints.length - 1]?.columns ??
  REFERENCE_COLUMNS;

/**
 * Cell size is derived from the board width, so row height scales with it. A literal row count
 * fits at one width and clips at another.
 */
export const latticeFor = (width: number, columns: number, gap = DEFAULT_BOARD_GAP): Lattice => ({
  cell: (width - gap * (columns - 1)) / columns,
  gap,
});

/**
 * Below the reference lattice a span is scaled rather than truncated, and never falls under the
 * width at which the widget's own content still reads.
 */
export const resolveSpanWidth = (authored: number, minimumWidth: number, columns: number) => {
  if (columns >= REFERENCE_COLUMNS) return Math.min(authored, columns);
  const scaled = Math.round((authored * columns) / REFERENCE_COLUMNS);
  return Math.min(columns, Math.max(Math.min(minimumWidth, columns), scaled));
};
