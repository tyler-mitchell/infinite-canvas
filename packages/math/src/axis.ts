import type { Rect } from "./rect";
import type { Size } from "./size";
import type { Point } from "./vector";

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

// NOT GROUNDED, and correctly so: this is not arithmetic. It names which of a size's two fields a
// layout axis treats as its main extent, and no upstream publishes that vocabulary because it is a
// naming decision rather than a computation.
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

// NOT GROUNDED, for the same reason as sizeOnAxis above.
export function pointOnAxis({
  axis,
  main,
  cross,
}: {
  axis: Axis;
  main: number;
  cross: number;
}): Point {
  return axis === "horizontal" ? { x: main, y: cross } : { x: cross, y: main };
}

// NOT GROUNDED, for the same reason as sizeOnAxis above: it selects which pair of a rect's fields
// an axis writes, and selecting a field is not an operation an upstream would publish.
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
