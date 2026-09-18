import { type } from "arktype";

export const columnOptions = {
  columns: "number.integer > 0 = 12",
  "breakpoints?": type({ minWidth: "number >= 0", columns: "number.integer > 0" }).array(),
  "spanColumns?": "number.integer > 0",
  gap: "number >= 0 = 12",
  padding: "number >= 0 = 0",
} as const;

export const columnItem = {
  "column?": "number.integer >= 0",
  "columnSpan?": "number.integer > 0",
  minColumnSpan: "number.integer > 0 = 1",
  hidden: "boolean = false",
} as const;

const columnSchema = type(columnOptions);
type ColumnOptions = typeof columnSchema.infer;

export function resolveColumns({ options, width }: { options: ColumnOptions; width: number }) {
  const { gap, padding } = options;
  const columns =
    (options.breakpoints ?? [])
      .toSorted((left, right) => right.minWidth - left.minWidth)
      .find((breakpoint) => width >= breakpoint.minWidth)?.columns ?? options.columns;
  const cell = Math.max(0, (width - padding * 2 - gap * (columns - 1)) / columns);
  const reference = options.spanColumns ?? columns;
  return {
    columns,
    cell,
    scaled: (span: number, floor: number) =>
      columns >= reference
        ? Math.min(span, columns)
        : Math.min(columns, Math.max(floor, Math.round((span * columns) / reference))),
    authored: (span: number) =>
      columns >= reference ? span : Math.max(1, Math.round((span * reference) / columns)),
    extent: ({ span, size }: { span: number; size: number }) => span * size + (span - 1) * gap,
    units: ({ offset, size }: { offset: number; size: number }) =>
      Math.round(offset / (size + gap)),
    spans: ({ length, size }: { length: number; size: number }) =>
      Math.max(1, Math.round((length + gap) / (size + gap))),
  };
}
