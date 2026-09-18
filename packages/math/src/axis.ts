import type { Rect } from "./rect";

export type Size = { width: number; height: number };

export type Axis = "horizontal" | "vertical";

export type AxisFields = {
  readonly main: "width" | "height";
  readonly cross: "width" | "height";
  readonly mainPosition: "x" | "y";
  readonly crossPosition: "x" | "y";
  readonly crossAxis: Axis;
};

export const axes = {
  horizontal: {
    main: "width",
    cross: "height",
    mainPosition: "x",
    crossPosition: "y",
    crossAxis: "vertical",
  },
  vertical: {
    main: "height",
    cross: "width",
    mainPosition: "y",
    crossPosition: "x",
    crossAxis: "horizontal",
  },
} as const satisfies Record<Axis, AxisFields>;

export function sizeOnAxis({
  axis,
  main,
  cross,
}: {
  axis: Axis;
  main: number;
  cross: number;
}): Size {
  return axis === "horizontal" ? { width: main, height: cross } : { width: cross, height: main };
}

export function placeOnAxis({
  axis,
  rect,
  position,
  extent,
}: {
  axis: Axis;
  rect: Rect;
  position: number;
  extent: number;
}): Rect {
  return axis === "horizontal"
    ? { ...rect, x: position, width: extent }
    : { ...rect, y: position, height: extent };
}
