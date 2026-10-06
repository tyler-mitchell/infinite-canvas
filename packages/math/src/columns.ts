import { clamp, clamp0 } from "@thi.ng/math";
import { gridGeometry, type GridGeometry } from "./grid-geometry";
import { max } from "@thi.ng/transducers";
import { type } from "arktype";
import type { Rect } from "./rect";
import type { Size } from "./size";

export const columnOptions = type({
  columns: "number.integer > 0 = 12",
  "breakpoints?": type({ minWidth: "number >= 0", columns: "number.integer > 0" }).array(),
  "spanColumns?": "number.integer > 0",
  gap: "number >= 0 = 12",
  padding: "number >= 0 = 0",
});

export const columnItem = type({
  "column?": "number >= 0",
  "columnSpan?": "number > 0",
  minColumnSpan: "number.integer > 0 = 1",
  hidden: "boolean = false",
});

type ColumnOptions = typeof columnOptions.infer;
type ColumnItem = typeof columnItem.infer;

export type ColumnLayoutItem<Item extends ColumnItem = ColumnItem> = {
  id: string;
  item: Item;
  size(proposal: Partial<Size>): Size;
};

export function columnSize({
  options,
  items,
  proposal,
  height,
}: {
  options: ColumnOptions;
  items: readonly { item: { hidden: boolean }; size: (proposal: Partial<Size>) => Size }[];
  proposal: Partial<Size>;
  height: (width: number) => number;
}): Size {
  const narrowest =
    options.padding * 2 +
    clamp0(
      max(items.filter(({ item }) => !item.hidden).map(({ size }) => size({ width: 0 }).width)),
    );
  const width = Math.max(narrowest, proposal.width ?? narrowest);
  return { width, height: height(width === Infinity ? narrowest : width) };
}

export function resolveColumns({
  options,
  width,
  rowHeight = "square",
}: {
  options: ColumnOptions;
  width: number;
  rowHeight?: GridGeometry["rowHeight"];
}) {
  const { gap, padding } = options;
  const referenceColumns =
    (options.breakpoints ?? [])
      .toSorted((left, right) => right.minWidth - left.minWidth)
      .find((breakpoint) => width >= breakpoint.minWidth)?.columns ?? options.columns;
  const columns =
    rowHeight === "square"
      ? referenceColumns
      : Math.max(1, Math.round((clamp0(width - padding * 2) + gap) / (rowHeight + gap)));
  const geometry = gridGeometry({
    columns,
    width,
    rowHeight: "square",
    gap: [gap, gap],
    padding: [padding, padding],
  });
  const reference = options.spanColumns ?? referenceColumns;
  const scale = columns / reference;
  return {
    columns,
    geometry,
    authored: (value: number) => value / scale,
    member: ({
      item,
      target,
      originX,
      resizing,
    }: {
      item: ColumnItem;
      target: Rect | undefined;
      originX: number;
      resizing: boolean;
    }) => {
      const widthSized = target !== undefined && (resizing || item.columnSpan === undefined);
      const column = item.column === undefined ? undefined : Math.round(item.column * scale);
      const proposedSpan = widthSized
        ? geometry.span(target).columnSpan
        : Math.round(((item.column ?? 0) + (item.columnSpan ?? 1)) * scale) - (column ?? 0);
      const span = clamp(proposedSpan, Math.min(columns, item.minColumnSpan), columns);
      return {
        span,
        column:
          target === undefined
            ? column
            : geometry.position({ x: target.x - originX, y: target.y }).column,
      };
    },
  };
}
