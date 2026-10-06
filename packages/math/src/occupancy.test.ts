import { describe, expect, test } from "vite-plus/test";
import {
  createOccupancyGrid,
  findFreeArea,
  isAreaFree,
  markArea,
  occupancyRows,
  type GridArea,
  type GridSpan,
  type OccupancyGrid,
} from "./occupancy";

const areasOverlap = (a: GridArea, b: GridArea) =>
  a.column < b.column + b.columns &&
  a.column + a.columns > b.column &&
  a.row < b.row + b.rows &&
  a.row + a.rows > b.row;

describe("markArea rejects the same areas isAreaFree rejects", () => {
  test("a column past the grid width does not reach into the next row's word", () => {
    const grid = createOccupancyGrid({ columns: 10, rows: 3 });
    const beyond: GridArea = { column: 32, row: 0, columns: 1, rows: 1 };
    expect(isAreaFree({ grid, area: beyond })).toBe(false);
    const marked = markArea({ grid, area: beyond });
    expect(isAreaFree({ grid: marked, area: { column: 0, row: 1, columns: 10, rows: 1 } })).toBe(
      true,
    );
  });

  test("an area straddling the right edge leaves the whole grid free", () => {
    const grid = createOccupancyGrid({ columns: 10, rows: 3 });
    const straddling: GridArea = { column: 8, row: 0, columns: 5, rows: 1 };
    expect(isAreaFree({ grid, area: straddling })).toBe(false);
    const marked = markArea({ grid, area: straddling });
    expect(isAreaFree({ grid: marked, area: { column: 0, row: 0, columns: 10, rows: 3 } })).toBe(
      true,
    );
  });

  test("a negative column or row marks nothing", () => {
    const grid = createOccupancyGrid({ columns: 10, rows: 3 });
    [
      { column: -1, row: 1, columns: 2, rows: 1 },
      { column: 0, row: -1, columns: 2, rows: 1 },
    ].forEach((area) => {
      expect(isAreaFree({ grid, area })).toBe(false);
      const marked = markArea({ grid, area });
      expect(isAreaFree({ grid: marked, area: { column: 0, row: 0, columns: 10, rows: 3 } })).toBe(
        true,
      );
    });
  });

  test("an area inside the grid still marks, so the guard is not blanket", () => {
    const grid = createOccupancyGrid({ columns: 10, rows: 3 });
    const inside: GridArea = { column: 2, row: 1, columns: 3, rows: 1 };
    const marked = markArea({ grid, area: inside });
    expect(isAreaFree({ grid: marked, area: inside })).toBe(false);
  });
});

describe("createOccupancyGrid", () => {
  test("starts with every cell unoccupied, including rows past the end", () => {
    const grid = createOccupancyGrid({ columns: 6, rows: 2 });
    expect(occupancyRows(grid)).toBe(2);
    expect(isAreaFree({ grid, area: { column: 0, row: 0, columns: 6, rows: 2 } })).toBe(true);
    expect(isAreaFree({ grid, area: { column: 0, row: 90, columns: 6, rows: 3 } })).toBe(true);
  });

  test("reports an area outside the columns as not free", () => {
    const grid = createOccupancyGrid({ columns: 6 });
    expect(isAreaFree({ grid, area: { column: 4, row: 0, columns: 3, rows: 1 } })).toBe(false);
    expect(isAreaFree({ grid, area: { column: -1, row: 0, columns: 2, rows: 1 } })).toBe(false);
  });
});

describe("markArea", () => {
  test("occupies exactly the marked cells and no neighbour", () => {
    const grid = markArea({
      grid: createOccupancyGrid({ columns: 6, rows: 4 }),
      area: { column: 2, row: 1, columns: 2, rows: 2 },
    });
    expect(isAreaFree({ grid, area: { column: 2, row: 1, columns: 1, rows: 1 } })).toBe(false);
    expect(isAreaFree({ grid, area: { column: 3, row: 2, columns: 1, rows: 1 } })).toBe(false);
    expect(isAreaFree({ grid, area: { column: 1, row: 1, columns: 1, rows: 1 } })).toBe(true);
    expect(isAreaFree({ grid, area: { column: 4, row: 2, columns: 1, rows: 1 } })).toBe(true);
    expect(isAreaFree({ grid, area: { column: 2, row: 0, columns: 2, rows: 1 } })).toBe(true);
    expect(isAreaFree({ grid, area: { column: 2, row: 3, columns: 2, rows: 1 } })).toBe(true);
  });

  test("creates the implicit rows an area needs", () => {
    const grid = markArea({
      grid: createOccupancyGrid({ columns: 6, rows: 1 }),
      area: { column: 0, row: 3, columns: 1, rows: 2 },
    });
    expect(occupancyRows(grid)).toBe(5);
    expect(isAreaFree({ grid, area: { column: 0, row: 3, columns: 1, rows: 1 } })).toBe(false);
  });

  test("keeps the cells it already had when it grows", () => {
    const first = markArea({
      grid: createOccupancyGrid({ columns: 40, rows: 1 }),
      area: { column: 33, row: 0, columns: 2, rows: 1 },
    });
    const grown = markArea({ grid: first, area: { column: 0, row: 6, columns: 1, rows: 1 } });
    expect(isAreaFree({ grid: grown, area: { column: 33, row: 0, columns: 1, rows: 1 } })).toBe(
      false,
    );
    expect(isAreaFree({ grid: grown, area: { column: 32, row: 0, columns: 1, rows: 1 } })).toBe(
      true,
    );
  });
});

describe("findFreeArea", () => {
  const grid = markArea({
    grid: createOccupancyGrid({ columns: 4, rows: 2 }),
    area: { column: 0, row: 0, columns: 2, rows: 1 },
  });

  test("returns the cursor itself when the span already fits there", () => {
    expect(
      findFreeArea({ grid, span: { columns: 2, rows: 1 }, from: { column: 2, row: 0 } }),
    ).toEqual({ column: 2, row: 0 });
  });

  test("starts at the cursor's column and does not look back at free cells behind it", () => {
    const empty = createOccupancyGrid({ columns: 4, rows: 2 });
    expect(
      findFreeArea({ grid: empty, span: { columns: 1, rows: 1 }, from: { column: 2, row: 0 } }),
    ).toEqual({ column: 2, row: 0 });
    expect(
      findFreeArea({ grid: empty, span: { columns: 2, rows: 1 }, from: { column: 3, row: 0 } }),
    ).toEqual({ column: 0, row: 1 });
  });

  test("advances along the row before it moves down, which is the order the spec fixes", () => {
    expect(findFreeArea({ grid, span: { columns: 1, rows: 1 } })).toEqual({ column: 2, row: 0 });
  });

  test("wraps to column zero of the next row when the span overflows the width", () => {
    expect(findFreeArea({ grid, span: { columns: 3, rows: 1 } })).toEqual({ column: 0, row: 1 });
  });

  test("never fails for a span that fits the width, because implicit rows are always free", () => {
    const full = markArea({
      grid: createOccupancyGrid({ columns: 4, rows: 3 }),
      area: { column: 0, row: 0, columns: 4, rows: 3 },
    });
    expect(findFreeArea({ grid: full, span: { columns: 4, rows: 2 } })).toEqual({
      column: 0,
      row: 3,
    });
  });

  test("returns null only when the span cannot fit the width at all", () => {
    expect(findFreeArea({ grid, span: { columns: 5, rows: 1 } })).toBe(null);
    expect(findFreeArea({ grid, span: { columns: 0, rows: 1 } })).toBe(null);
  });

  test("leaves the sparse and dense difference to the caller's cursor", () => {
    const holed = markArea({
      grid: markArea({
        grid: createOccupancyGrid({ columns: 4, rows: 2 }),
        area: { column: 0, row: 0, columns: 1, rows: 1 },
      }),
      area: { column: 2, row: 0, columns: 2, rows: 2 },
    });
    const span: GridSpan = { columns: 1, rows: 1 };
    expect(findFreeArea({ grid: holed, span, from: { column: 0, row: 1 } })).toEqual({
      column: 0,
      row: 1,
    });
    expect(findFreeArea({ grid: holed, span })).toEqual({ column: 1, row: 0 });
  });
});

describe("dense auto-placement over the grid", () => {
  test("places a sequence of spans without any two areas overlapping", () => {
    const spans: GridSpan[] = [
      { columns: 2, rows: 2 },
      { columns: 1, rows: 1 },
      { columns: 3, rows: 1 },
      { columns: 1, rows: 3 },
      { columns: 2, rows: 1 },
      { columns: 4, rows: 2 },
      { columns: 1, rows: 1 },
      { columns: 2, rows: 3 },
    ];
    const placed = spans.reduce<{ grid: OccupancyGrid; areas: GridArea[] }>(
      (state, span) => {
        const position = findFreeArea({ grid: state.grid, span })!;
        const area = { ...position, ...span };
        return { grid: markArea({ grid: state.grid, area }), areas: [...state.areas, area] };
      },
      { grid: createOccupancyGrid({ columns: 4 }), areas: [] },
    );
    expect(placed.areas).toHaveLength(spans.length);
    placed.areas.forEach((area, index) => {
      expect(area.column).toBeGreaterThanOrEqual(0);
      expect(area.column + area.columns).toBeLessThanOrEqual(4);
      placed.areas.forEach((other, otherIndex) => {
        if (index !== otherIndex) expect(areasOverlap(area, other)).toBe(false);
      });
    });
  });
});
