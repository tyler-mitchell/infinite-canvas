import { type } from "arktype";
import { expect, test } from "vite-plus/test";
import { columnItem, columnOptions, placeLanes, resolveColumns, type Layout } from "../index";
import { arrangeWindows, bindLayout, type LayoutNode } from "./arrange";
import { lanes } from "./lanes";

const boardOptions = type({ type: "'board'", ...columnOptions, tolerance: "number >= 0 = 0" });
const boardItem = type(columnItem);

const board: Layout<typeof boardOptions, typeof boardItem> = {
  options: boardOptions,
  item: boardItem,
  size: ({ options, items, proposal }) => {
    const width = proposal.width ?? 0;
    const { columns, cell, scaled, extent } = resolveColumns({ options, width });
    const shown = items
      .filter(({ item }) => !item.hidden)
      .map(({ id, item, size }) => {
        const span = scaled(item.columnSpan ?? 1, item.minColumnSpan);
        return {
          id,
          span,
          column: item.column,
          height: size({ width: extent({ span, size: cell }) }).height,
        };
      });
    const placed = placeLanes({
      columns,
      gap: options.gap,
      tolerance: options.tolerance,
      items: shown,
    });
    return {
      width,
      height:
        options.padding * 2 +
        Math.max(
          0,
          ...placed.map((lane) => lane.y + shown.find(({ id }) => id === lane.id)!.height),
        ),
    };
  },
  arrange: ({ options, items, rect }) => {
    const { columns, cell, scaled, extent } = resolveColumns({ options, width: rect.width });
    const shown = items
      .filter(({ item }) => !item.hidden)
      .map(({ id, item, size }) => {
        const span = scaled(item.columnSpan ?? 1, item.minColumnSpan);
        return {
          id,
          span,
          column: item.column,
          height: size({ width: extent({ span, size: cell }) }).height,
        };
      });
    const placed = placeLanes({
      columns,
      gap: options.gap,
      tolerance: options.tolerance,
      items: shown,
    });
    return {
      size: {
        width: rect.width,
        height:
          options.padding * 2 +
          Math.max(
            0,
            ...placed.map((lane) => lane.y + shown.find(({ id }) => id === lane.id)!.height),
          ),
      },
      controls: [],
      children: [
        ...placed.map((lane) => ({
          id: lane.id,
          visible: true,
          rect: {
            x: rect.x + options.padding + lane.column * (cell + options.gap),
            y: rect.y + options.padding + lane.y,
            width: extent({ span: shown.find(({ id }) => id === lane.id)!.span, size: cell }),
            height: shown.find(({ id }) => id === lane.id)!.height,
          },
        })),
        ...items.filter(({ item }) => item.hidden).map(({ id }) => ({ id, visible: false, rect })),
      ],
    };
  },
};

test("a lanes layout written from the public entry alone gives the rectangles of the built-in on random boards", () => {
  const layouts = { lanes: bindLayout(lanes), board: bindLayout(board) };
  const random = (seed: number) => () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  Array.from({ length: 200 }, (_, seed) => seed + 1).forEach((seed) => {
    const next = random(seed);
    const columns = 1 + Math.floor(next() * 6);
    const ids = Array.from({ length: Math.floor(next() * 10) }, (_, index) => `w${index}`);
    const options = {
      columns,
      gap: Math.floor(next() * 16),
      padding: Math.floor(next() * 12),
      tolerance: Math.floor(next() * 20),
    };
    const nodes: Record<string, LayoutNode> = Object.fromEntries(
      ids.map((id) => {
        const columnSpan = 1 + Math.floor(next() * columns);
        return [
          id,
          {
            item: {
              columnSpan,
              ...(next() < 0.2 ? { column: Math.floor(next() * (columns - columnSpan + 1)) } : {}),
              ...(next() < 0.1 ? { hidden: true } : {}),
            },
          },
        ];
      }),
    );
    const sizes = Object.fromEntries(
      ids.map((id) => {
        const height = Math.floor(next() * 300);
        return [id, ({ width = 0 }: { width?: number }) => ({ width, height })];
      }),
    );
    const rect = {
      x: Math.floor(next() * 100),
      y: Math.floor(next() * 100),
      width: 200 + Math.floor(next() * 800),
      height: 10,
    };
    const arranged = (kind: string) =>
      arrangeWindows({
        id: "root",
        rect,
        layouts,
        sizes,
        nodes: { ...nodes, root: { layout: { type: kind, ...options }, children: ids } },
      });
    const expected = arranged("lanes");
    const actual = arranged("board");
    expect(actual.rects, `seed ${seed}`).toEqual(expected.rects);
    expect(actual.size, `seed ${seed}`).toEqual(expected.size);
  });
});
