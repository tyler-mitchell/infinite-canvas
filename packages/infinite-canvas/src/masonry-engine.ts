import {
  applyPositionConstraints,
  applySizeConstraints,
  bottom,
  calcGridColWidth,
  calcGridItemPosition,
  calcWHRaw,
  calcXY,
  calcXYRaw,
  correctBounds,
  defaultConstraints,
  defaultGridConfig,
  findOrGenerateResponsiveLayout,
  getAllCollisions,
  getBreakpointFromWidth,
  getCompactor,
  moveElement,
  resizeItemInDirection,
  sortBreakpoints,
  type Compactor,
  type ConstraintContext,
  type Layout,
  type LayoutItem,
  type PositionParams,
  type ResizeHandleAxis,
} from "react-grid-layout/core";
import { wrapCompactor, wrapOverlapCompactor } from "react-grid-layout/extras";

import type {
  InfiniteCanvasGroupContainerNode,
  InfiniteCanvasGroupWindowNodeLayout,
} from "./group-tree";
import type { InfiniteCanvasResizeHandle } from "./types";
import type { LayoutInput, LayoutEngine } from "./layout";
type MasonryLayouts = Readonly<Record<string, InfiniteCanvasGroupWindowNodeLayout>>;

function getParams({ container, rect }: LayoutInput): PositionParams {
  const config = { ...defaultGridConfig, ...container.masonry };
  const responsive = getResponsiveLayout({ container, rect });
  return {
    cols: responsive?.cols ?? config.cols,
    containerPadding: config.containerPadding ?? config.margin,
    containerWidth: rect.width,
    margin: config.margin,
    maxRows: config.maxRows,
    rowHeight: config.rowHeight,
  };
}

function getResponsiveLayout({ container, rect }: LayoutInput) {
  const responsive = container.masonry?.responsive;
  if (responsive === undefined) return null;
  const largest = sortBreakpoints(responsive.breakpoints).at(-1);
  if (largest === undefined) return null;
  const breakpoint = getBreakpointFromWidth(responsive.breakpoints, rect.width);
  return {
    ...responsive,
    breakpoint,
    largest,
    cols: responsive.cols[breakpoint] ?? container.masonry?.cols ?? defaultGridConfig.cols,
  };
}

function getLayoutChanges(input: LayoutInput, layouts: MasonryLayouts): MasonryLayouts {
  const responsive = getResponsiveLayout(input);
  if (responsive === null || responsive.breakpoint === responsive.largest) return layouts;
  const { breakpoint } = responsive;
  return Object.fromEntries(
    Object.entries(layouts).map(([id, layout]) => {
      const child = input.container.children.find((child) => child.id === id);
      const current = child?.kind === "window" ? child.layouts : undefined;
      return [
        id,
        { layouts: { ...current, [breakpoint]: { ...current?.[breakpoint], ...layout } } },
      ];
    }),
  );
}

function getMasonryCompactor(container: InfiniteCanvasGroupContainerNode): Compactor {
  const { allowOverlap, compactType, preventCollision } = container.masonry ?? {};
  if (compactType === "wrap") {
    const compactor = allowOverlap ? wrapOverlapCompactor : wrapCompactor;
    return preventCollision ? { ...compactor, preventCollision } : compactor;
  }
  return getCompactor(
    compactType === undefined ? "vertical" : compactType,
    allowOverlap,
    preventCollision,
  );
}

function getConstraintContext(params: PositionParams, layout: Layout): ConstraintContext {
  return {
    cols: params.cols,
    containerHeight: 0,
    containerWidth: params.containerWidth,
    layout,
    margin: params.margin,
    maxRows: params.maxRows,
    rowHeight: params.rowHeight,
  };
}

function getGrid(input: LayoutInput) {
  const params = getParams(input);
  const compactor = getMasonryCompactor(input.container);
  let maxY = 0;
  const items = input.container.children
    .filter((child) => child.kind !== "window" || child.hidden !== true)
    .map<LayoutItem>((child) => {
      const cells: InfiniteCanvasGroupWindowNodeLayout = child.kind === "window" ? child : {};
      const item = {
        h: cells.rows ?? 1,
        i: child.id,
        w: cells.span ?? 1,
        x: cells.x ?? 0,
        y: cells.y ?? maxY,
      };
      maxY = Math.max(maxY, item.y + item.h);
      return item;
    });
  const responsive = getResponsiveLayout(input);
  const children = new Map(input.container.children.map((child) => [child.id, child]));
  const generated =
    responsive === null
      ? items
      : findOrGenerateResponsiveLayout(
          { [responsive.largest]: items },
          responsive.breakpoints,
          responsive.breakpoint,
          responsive.largest,
          params.cols,
          compactor,
        );
  const layout = generated.map((item) => {
    const child = children.get(item.i);
    const override =
      responsive !== null &&
      responsive.breakpoint !== responsive.largest &&
      child?.kind === "window"
        ? child.layouts?.[responsive.breakpoint]
        : undefined;
    return override === undefined
      ? item
      : {
          ...item,
          h: override.rows ?? item.h,
          w: override.span ?? item.w,
          x: override.x ?? item.x,
          y: override.y ?? item.y,
        };
  });
  return {
    params,
    compactor,
    layout: compactor.compact(correctBounds(layout, { cols: params.cols }), params.cols),
  };
}

const resizeHandles: Record<InfiniteCanvasResizeHandle, ResizeHandleAxis> = {
  east: "e",
  north: "n",
  "north-east": "ne",
  "north-west": "nw",
  south: "s",
  "south-east": "se",
  "south-west": "sw",
  west: "w",
};

export const masonryEngine: LayoutEngine = {
  layout(input) {
    const { params, layout } = getGrid(input);
    const rows = Math.max(1, bottom(layout));
    return {
      extent:
        rows * params.rowHeight + (rows - 1) * params.margin[1] + params.containerPadding[1] * 2,
      rects: new Map(
        layout.map((item) => {
          const position = calcGridItemPosition(params, item.x, item.y, item.w, item.h);
          return [
            item.i,
            {
              height: position.height,
              width: position.width,
              x: input.rect.x + position.left,
              y: input.rect.y + position.top,
            },
          ];
        }),
      ),
    };
  },
  move(input) {
    const { params, compactor, layout } = getGrid(input);
    const item = layout.find((candidate) => candidate.i === input.windowId);
    if (item === undefined) return {};
    const raw = calcXYRaw(
      params,
      input.windowRect.y - input.rect.y,
      input.windowRect.x - input.rect.x,
    );
    const { x, y } = applyPositionConstraints(
      defaultConstraints,
      item,
      raw.x,
      raw.y,
      getConstraintContext(params, layout),
    );
    const moved = compactor.compact(
      moveElement(
        layout,
        item,
        x,
        y,
        true,
        compactor.preventCollision,
        compactor.type,
        params.cols,
        compactor.allowOverlap,
      ),
      params.cols,
    );
    return getLayoutChanges(
      input,
      Object.fromEntries(moved.map((cells) => [cells.i, { x: cells.x, y: cells.y }])),
    );
  },
  resize(input) {
    const { params, compactor, layout: currentLayout } = getGrid(input);
    const item = currentLayout.find((candidate) => candidate.i === input.windowId);
    if (item === undefined) return {};
    const handle = resizeHandles[input.handle];
    const { cols } = params;
    const preventCollision = compactor.preventCollision ?? false;
    const position = calcGridItemPosition(params, item.x, item.y, item.w, item.h);
    const updatedSize = resizeItemInDirection(
      handle,
      position,
      {
        ...position,
        height: input.windowRect.height,
        width: input.windowRect.width,
      },
      params.containerWidth,
    );
    const rawSize = calcWHRaw(params, updatedSize.width, updatedSize.height);
    const { w: newW, h: newH } = applySizeConstraints(
      defaultConstraints,
      item,
      rawSize.w,
      rawSize.h,
      handle,
      getConstraintContext(params, currentLayout),
    );
    const rawX = handle.includes("w") ? item.x + item.w - newW : item.x;
    const rawY = handle.includes("n") ? item.y + item.h - newH : item.y;
    const x = Math.max(0, rawX);
    const y = Math.max(0, rawY);
    const resized = { ...item, w: rawX < 0 ? item.w : newW, h: rawY < 0 ? item.h : newH };
    if (
      preventCollision &&
      !compactor.allowOverlap &&
      getAllCollisions(currentLayout, { ...resized, x, y }).some(
        (candidate) => candidate.i !== input.windowId,
      )
    )
      return {};
    const layout = currentLayout.map((candidate) =>
      candidate.i === input.windowId ? resized : candidate,
    );
    const finalLayout =
      x === item.x && y === item.y
        ? layout
        : moveElement(
            layout,
            resized,
            x,
            y,
            true,
            preventCollision,
            compactor.type,
            cols,
            compactor.allowOverlap,
          );
    return getLayoutChanges(
      input,
      Object.fromEntries(
        compactor
          .compact(finalLayout, cols)
          .map((cells) => [cells.i, { rows: cells.h, span: cells.w, x: cells.x, y: cells.y }]),
      ),
    );
  },
  contentHeight(input) {
    const { params, layout } = getGrid(input);
    const item = layout.find((candidate) => candidate.i === input.windowId);
    const rows = Math.max(
      1,
      Math.ceil((input.height + params.margin[1]) / (params.rowHeight + params.margin[1])),
    );
    return item === undefined || item.h === rows
      ? {}
      : getLayoutChanges(input, { [input.windowId]: { rows } });
  },
  step(input) {
    const params = getParams(input);
    return {
      width: calcGridColWidth(params) + params.margin[0],
      height: params.rowHeight + params.margin[1],
    };
  },
  drop(input) {
    const { params, compactor, layout } = getGrid(input);
    const size = calcWHRaw(params, input.windowRect.width, input.windowRect.height);
    const { w: span, h: rows } = applySizeConstraints(
      defaultConstraints,
      { i: input.windowId, x: 0, y: 0, ...size },
      size.w,
      size.h,
      "se",
      getConstraintContext(params, []),
    );
    const { x, y } = calcXY(
      params,
      input.windowRect.y - input.rect.y,
      input.windowRect.x - input.rect.x,
      span,
      rows,
    );
    const placed = compactor
      .compact(
        [
          ...layout.filter((item) => item.i !== input.windowId),
          { i: input.windowId, x, y, w: span, h: rows },
        ],
        params.cols,
      )
      .find((item) => item.i === input.windowId)!;
    const position = calcGridItemPosition(params, placed.x, placed.y, placed.w, placed.h);
    return {
      layout: { rows: placed.h, span: placed.w, x: placed.x, y: placed.y },
      rect: {
        height: position.height,
        width: position.width,
        x: input.rect.x + position.left,
        y: input.rect.y + position.top,
      },
    };
  },
};
