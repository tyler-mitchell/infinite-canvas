import {
  boundGridCell, resizeGridCell, compactGrid,
  gridCellsOverlap, gridGeometry, gridRows, moveGrid, placeGridSequence, type GridCell,
} from "@hyphened/math/cpu";
import type {
  InfiniteCanvasGroupContainerNode,
  InfiniteCanvasGroupWindowNodeLayout,
} from "./group-tree";
import type { LayoutInput, LayoutEngine } from "./layout";

type MasonryLayouts = Readonly<Record<string, InfiniteCanvasGroupWindowNodeLayout>>;
type Item = GridCell & { id: string };
const defaultGridConfig = {
  cols: 12,
  rowHeight: 150,
  margin: [10, 10] as const,
  containerPadding: null,
  maxRows: Infinity,
};

function getParams({ container, rect }: LayoutInput) {
  const config = { ...defaultGridConfig, ...container.masonry };
  const responsive = getResponsiveLayout({ container, rect });
  const params = {
    cols: responsive?.cols ?? config.cols,
    containerPadding: config.containerPadding ?? config.margin,
    containerWidth: rect.width,
    margin: config.margin,
    maxRows: config.maxRows,
    rowHeight: config.rowHeight,
  };
  return {
    ...params,
    geometry: gridGeometry({
      columns: params.cols,
      width: params.containerWidth,
      rowHeight: params.rowHeight,
      gap: params.margin,
      padding: params.containerPadding,
    }),
  };
}

function getResponsiveLayout({ container, rect }: LayoutInput) {
  const responsive = container.masonry?.responsive;
  if (responsive === undefined) return null;
  const breakpoints = Object.keys(responsive.breakpoints).toSorted(
    (a, b) => responsive.breakpoints[a] - responsive.breakpoints[b],
  );
  const largest = breakpoints.at(-1);
  if (largest === undefined) return null;
  const breakpoint =
    breakpoints.findLast((name) => rect.width > responsive.breakpoints[name]) ?? breakpoints[0];
  return {
    ...responsive, breakpoint, largest,
    cols: responsive.cols[breakpoint] ?? container.masonry?.cols ?? defaultGridConfig.cols,
  };
}

function getLayoutChanges(input: LayoutInput, layouts: MasonryLayouts): MasonryLayouts {
  const responsive = getResponsiveLayout(input);
  if (responsive === null || responsive.breakpoint === responsive.largest) return layouts;
  const { breakpoint } = responsive;
  return Object.fromEntries(Object.entries(layouts).map(([id, layout]) => {
    const child = input.container.children.find((child) => child.id === id);
    const current = child?.kind === "window" ? child.layouts : undefined;
    return [id, { layouts: { ...current, [breakpoint]: { ...current?.[breakpoint], ...layout } } }];
  }));
}

function getMasonryCompactor(container: InfiniteCanvasGroupContainerNode) {
  const { allowOverlap = false, compactType = "vertical", preventCollision = false } = container.masonry ?? {};
  return {
    mode: compactType, allowOverlap, preventCollision,
    compact(items: readonly Item[], columns: number): Item[] {
      if (allowOverlap || compactType === null) return items.map((item) => ({ ...item }));
      if (compactType === "wrap") {
        const cells = placeGridSequence({ columns, items });
        return items.map(({ id }) => ({ id, ...cells[id] }));
      }
      return compactGrid({ columns, items, axis: compactType === "vertical" ? "row" : "column" });
    },
  };
}

function getGrid(input: LayoutInput) {
  const params = getParams(input);
  const compactor = getMasonryCompactor(input.container);
  const items = input.container.children
    .filter((child) => child.kind !== "window" || child.hidden !== true)
    .reduce<{ items: Item[]; rows: number }>(({ items, rows }, child) => {
      const cells: InfiniteCanvasGroupWindowNodeLayout = child.kind === "window" ? child : {};
      const item = {
        id: child.id, rowSpan: cells.rows ?? 1, columnSpan: cells.span ?? 1,
        column: cells.x ?? 0, row: cells.y ?? rows,
      };
      return { items: [...items, item], rows: Math.max(rows, item.row + item.rowSpan) };
    }, { items: [], rows: 0 }).items;
  const responsive = getResponsiveLayout(input);
  const children = new Map(input.container.children.map((child) => [child.id, child]));
  const generated = responsive === null || responsive.breakpoint === responsive.largest
    ? items
    : compactor.compact(items.map((item) => ({ ...item, ...boundGridCell({ cell: item, columns: params.cols }) })), params.cols);
  const layout = generated.map((item) => {
    const child = children.get(item.id);
    const override = responsive !== null && responsive.breakpoint !== responsive.largest && child?.kind === "window"
      ? child.layouts?.[responsive.breakpoint] : undefined;
    const cell = {
      columnSpan: override?.span ?? item.columnSpan,
      rowSpan: override?.rows ?? item.rowSpan,
      column: override?.x ?? item.column,
      row: override?.y ?? item.row,
    };
    return { id: item.id, ...boundGridCell({ cell, columns: params.cols }) };
  });
  return { params, compactor, layout: compactor.compact(layout, params.cols) };
}

export const masonryEngine: LayoutEngine = {
  layout(input) {
    const { params, layout } = getGrid(input);
    const rows = Math.max(1, gridRows(layout));
    return {
      extent: rows * params.rowHeight + (rows - 1) * params.margin[1] + params.containerPadding[1] * 2,
      rects: new Map(layout.map((item) => {
        const rect = params.geometry.rect(item);
        return [item.id, { ...rect, x: input.rect.x + rect.x, y: input.rect.y + rect.y }];
      })),
    };
  },
  move(input) {
    const { params, compactor, layout } = getGrid(input);
    const item = layout.find((item) => item.id === input.windowId);
    if (item === undefined) return {};
    const raw = params.geometry.position({
      x: input.windowRect.x - input.rect.x, y: input.windowRect.y - input.rect.y,
    });
    const position = boundGridCell({ cell: { ...item, ...raw }, columns: params.cols, rows: params.maxRows });
    const moved = compactor.compact(moveGrid({ items: layout, id: item.id, position, ...compactor }), params.cols);
    return getLayoutChanges(input, Object.fromEntries(moved.map((cell) => [cell.id, { x: cell.column, y: cell.row }])));
  },
  resize(input) {
    const { params, compactor, layout: currentLayout } = getGrid(input);
    const item = currentLayout.find((item) => item.id === input.windowId);
    if (item === undefined) return {};
    const { column, row, ...span } = resizeGridCell({
      cell: item, span: params.geometry.span(input.windowRect), handle: input.handle,
      columns: params.cols, rows: params.maxRows,
    });
    const resized = { ...item, ...span };
    const position = { column, row };
    if (compactor.preventCollision && !compactor.allowOverlap && currentLayout.some((other) =>
      other.id !== item.id && gridCellsOverlap({ a: other, b: { ...resized, ...position } }),
    )) return {};
    const layout = currentLayout.map((other) => other.id === item.id ? resized : other);
    const moved = column === item.column && row === item.row ? layout
      : moveGrid({ items: layout, id: item.id, position, ...compactor });
    return getLayoutChanges(input, Object.fromEntries(compactor.compact(moved, params.cols).map((cell) => [
      cell.id, { rows: cell.rowSpan, span: cell.columnSpan, x: cell.column, y: cell.row },
    ])));
  },
  contentHeight(input) {
    const { params, layout } = getGrid(input);
    const item = layout.find((item) => item.id === input.windowId);
    const rows = params.geometry.span({ width: 0, height: input.height, round: Math.ceil }).rowSpan;
    return item === undefined || item.rowSpan === rows ? {} : getLayoutChanges(input, { [input.windowId]: { rows } });
  },
  step(input) {
    return getParams(input).geometry.step;
  },
  drop(input) {
    const { params, compactor, layout } = getGrid(input);
    const span = params.geometry.span(input.windowRect);
    const position = params.geometry.position({
      x: input.windowRect.x - input.rect.x, y: input.windowRect.y - input.rect.y,
    });
    const cell = boundGridCell({ cell: { ...span, ...position }, columns: params.cols, rows: params.maxRows });
    const placed = compactor.compact([
      ...layout.filter((item) => item.id !== input.windowId), { id: input.windowId, ...cell },
    ], params.cols).find((item) => item.id === input.windowId)!;
    const rect = params.geometry.rect(placed);
    return {
      layout: { rows: placed.rowSpan, span: placed.columnSpan, x: placed.column, y: placed.row },
      rect: { ...rect, x: input.rect.x + rect.x, y: input.rect.y + rect.y },
    };
  },
};
