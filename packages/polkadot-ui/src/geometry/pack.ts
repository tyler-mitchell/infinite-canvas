import type { Rect } from "./rect.ts";

export interface PackItem {
  readonly id: string;
  /** Columns wide, already resolved against the current lattice. */
  readonly width: number;
  /** Rows tall. */
  readonly height: number;
}

export interface PackSlot {
  readonly column: number;
  readonly row: number;
  readonly width: number;
  readonly height: number;
}

export interface PackedLayout {
  readonly slots: ReadonlyMap<string, PackSlot>;
  readonly rows: number;
}

export interface Lattice {
  readonly cell: number;
  readonly gap: number;
}

/** How close a 1x1 tile may sit to another before the placement is rejected. */
type ScatterRule = "diagonal" | "orthogonal" | "none";

const SCATTER_RULES: readonly ScatterRule[] = ["diagonal", "orthogonal", "none"];

/** Rows searched past the deepest placed slot before the scatter rule relaxes. */
const SCATTER_REACH = 8;

const MAX_ROWS = 400;

type Occupancy = boolean[][];

const rowAt = (occupancy: Occupancy, row: number, columns: number) => {
  while (occupancy.length <= row) occupancy.push(Array.from({ length: columns }, () => false));
  return occupancy[row] as boolean[];
};

const fits = (
  occupancy: Occupancy,
  columns: number,
  column: number,
  row: number,
  width: number,
  height: number,
) => {
  for (let y = row; y < row + height; y++) {
    const cells = rowAt(occupancy, y, columns);
    for (let x = column; x < column + width; x++) if (cells[x]) return false;
  }
  return true;
};

const occupy = (occupancy: Occupancy, columns: number, slot: PackSlot) => {
  for (let y = slot.row; y < slot.row + slot.height; y++) {
    const cells = rowAt(occupancy, y, columns);
    for (let x = slot.column; x < slot.column + slot.width; x++) cells[x] = true;
  }
};

const touchesTile = (
  tiles: readonly { column: number; row: number }[],
  column: number,
  row: number,
  rule: ScatterRule,
) => {
  if (rule === "none") return false;
  return tiles.some((tile) => {
    const dx = Math.abs(tile.column - column);
    const dy = Math.abs(tile.row - row);
    if (dx + dy <= 1) return true;
    return rule === "diagonal" && dx <= 1 && dy <= 1;
  });
};

const firstFit = (occupancy: Occupancy, columns: number, width: number, height: number) => {
  for (let row = 0; row < MAX_ROWS; row++) {
    for (let column = 0; column + width <= columns; column++) {
      if (fits(occupancy, columns, column, row, width, height)) return { column, row };
    }
  }
  return { column: 0, row: 0 };
};

/**
 * A 1x1 tile may not share an edge with another tile.
 *
 * A penalty is always outbid by a shallower row, which queues every tile into one column. A hard
 * constraint is not. Diagonal contact is allowed — that is the scatter — and the rule relaxes only
 * when no legal cell exists within reach.
 */
const scatterFit = (
  occupancy: Occupancy,
  columns: number,
  tiles: readonly { column: number; row: number }[],
  frontier: number,
) => {
  const limit = frontier + SCATTER_REACH;
  for (const rule of SCATTER_RULES) {
    for (let row = 0; row <= limit; row++) {
      for (let column = 0; column < columns; column++) {
        if (!fits(occupancy, columns, column, row, 1, 1)) continue;
        if (touchesTile(tiles, column, row, rule)) continue;
        return { column, row };
      }
    }
  }
  return null;
};

/**
 * Bitmap first-fit. Scans from the top left for the first free footprint, so a small tile placed
 * later drops into a hole an earlier card left behind. A skyline packer cannot backfill.
 *
 * One packer, every depth: a board calls it with its widgets, a nested board with its children.
 */
export const packItems = (items: readonly PackItem[], columns: number): PackedLayout => {
  const occupancy: Occupancy = [];
  const slots = new Map<string, PackSlot>();
  const tiles: { column: number; row: number }[] = [];

  for (const item of items) {
    const width = Math.min(item.width, columns);
    const height = item.height;
    const isTile = width === 1 && height === 1;

    const frontier = [...slots.values()].reduce((deepest, slot) => {
      const bottom = slot.row + slot.height;
      return bottom > deepest ? bottom : deepest;
    }, 0);

    const placement = isTile
      ? (scatterFit(occupancy, columns, tiles, frontier) ??
        firstFit(occupancy, columns, width, height))
      : firstFit(occupancy, columns, width, height);

    if (isTile) tiles.push(placement);

    const slot: PackSlot = { ...placement, width, height };
    occupy(occupancy, columns, slot);
    slots.set(item.id, slot);
  }

  const rows = occupancy.reduce(
    (used, cells, index) => (cells.some(Boolean) ? index + 1 : used),
    0,
  );

  return { slots, rows };
};

export const slotRect = (slot: PackSlot, lattice: Lattice): Rect => ({
  x: slot.column * (lattice.cell + lattice.gap),
  y: slot.row * (lattice.cell + lattice.gap),
  width: slot.width * lattice.cell + (slot.width - 1) * lattice.gap,
  height: slot.height * lattice.cell + (slot.height - 1) * lattice.gap,
});

export const packedHeight = (rows: number, lattice: Lattice) =>
  rows > 0 ? rows * lattice.cell + (rows - 1) * lattice.gap : 0;
