import { d } from "typegpu";
import { describe, expect, test } from "vite-plus/test";
import { axes, placeOnAxis, sizeOnAxis, type Axis } from "./axis";
import { Rect, resizeRect, type ResizeHandle } from "./rect";
import { max, min } from "@thi.ng/transducers";

type Size = { width: number; height: number };

const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);

type Limits = { min: Size; max: Size };

const todayAxes = {
  horizontal: { position: "x", extent: "width", cross: "height" },
  vertical: { position: "y", extent: "height", cross: "width" },
} as const;

const todaySum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);

const todayOriented = ({
  axis,
  along,
  across,
}: {
  axis: Axis;
  along: number;
  across: number;
}): Size =>
  axis === "horizontal" ? { width: along, height: across } : { width: across, height: along };

const todaySplitGeometry = ({
  axis,
  rect,
  sizes,
  gap,
}: {
  axis: Axis;
  rect: Rect;
  sizes: readonly number[];
  gap: number;
}) => {
  const { position, extent } = todayAxes[axis];
  const offsets = sizes.map(
    (_, index) => rect[position] + todaySum(sizes.slice(0, index)) + gap * index,
  );
  return {
    children: sizes.map((_, index) => ({
      ...rect,
      [position]: offsets[index],
      [extent]: sizes[index],
    })) as Rect[],
    sashes: sizes.slice(0, -1).map((_, index) => ({
      ...rect,
      [position]: offsets[index]! + sizes[index]!,
      [extent]: gap,
    })) as Rect[],
  };
};

const todaySplitLimits = ({
  axis,
  limits,
  gap,
}: {
  axis: Axis;
  limits: readonly Limits[];
  gap: number;
}): Limits => {
  const { extent, cross } = todayAxes[axis];
  const gaps = gap * Math.max(0, limits.length - 1);
  const along = (limit: "min" | "max") =>
    todaySum(limits.map((each) => each[limit][extent])) + gaps;
  return {
    min: todayOriented({
      axis,
      along: along("min"),
      across: Math.max(0, ...limits.map((each) => each.min[cross])),
    }),
    max: todayOriented({
      axis,
      along: along("max"),
      across: Math.min(Infinity, ...limits.map((each) => each.max[cross])),
    }),
  };
};

const todayStacked = (limits: readonly Limits[]): Limits => ({
  min: {
    width: Math.max(0, ...limits.map((each) => each.min.width)),
    height: Math.max(0, ...limits.map((each) => each.min.height)),
  },
  max: {
    width: Math.min(Infinity, ...limits.map((each) => each.max.width)),
    height: Math.min(Infinity, ...limits.map((each) => each.max.height)),
  },
});

const rebuiltSplitGeometry = ({
  axis,
  rect,
  sizes,
  gap,
}: {
  axis: Axis;
  rect: Rect;
  sizes: readonly number[];
  gap: number;
}) => {
  const offsets = sizes.map(
    (_, index) => rect[axes[axis].mainPosition] + sum(sizes.slice(0, index)) + gap * index,
  );
  return {
    children: sizes.map((extent, index) =>
      placeOnAxis({ axis, rect, position: offsets[index]!, extent }),
    ),
    sashes: sizes
      .slice(0, -1)
      .map((extent, index) =>
        placeOnAxis({ axis, rect, position: offsets[index]! + extent, extent: gap }),
      ),
  };
};

const rebuiltSplitLimits = ({
  axis,
  limits,
  gap,
}: {
  axis: Axis;
  limits: readonly Limits[];
  gap: number;
}): Limits => {
  const { main, cross } = axes[axis];
  const gaps = gap * Math.max(0, limits.length - 1);
  return {
    min: sizeOnAxis({
      axis,
      main: sum(limits.map((each) => each.min[main])) + gaps,
      cross: Math.max(0, max(limits.map((each) => each.min[cross]))),
    }),
    max: sizeOnAxis({
      axis,
      main: sum(limits.map((each) => each.max[main])) + gaps,
      cross: Math.min(Infinity, min(limits.map((each) => each.max[cross]))),
    }),
  };
};

const rebuiltStacked = (limits: readonly Limits[]): Limits => ({
  min: {
    width: Math.max(0, max(limits.map((each) => each.min.width))),
    height: Math.max(0, max(limits.map((each) => each.min.height))),
  },
  max: {
    width: Math.min(Infinity, min(limits.map((each) => each.max.width))),
    height: Math.min(Infinity, min(limits.map((each) => each.max.height))),
  },
});

const rects: Rect[] = [
  { x: 0, y: 0, width: 400, height: 300 },
  { x: -120, y: 45, width: 900, height: 120 },
  { x: 33.5, y: -7.25, width: 61, height: 58 },
];

const sizeLists: number[][] = [[], [100], [100, 200], [40, 40, 40, 40], [0, 250, 10]];

const limitLists: Limits[][] = [
  [],
  [{ min: { width: 20, height: 10 }, max: { width: 400, height: Infinity } }],
  [
    { min: { width: 20, height: 10 }, max: { width: 400, height: 900 } },
    { min: { width: 60, height: 80 }, max: { width: Infinity, height: 120 } },
    { min: { width: 5, height: 200 }, max: { width: 90, height: Infinity } },
  ],
];

const everyAxis: Axis[] = ["horizontal", "vertical"];

describe("the split geometry in next/layout/kinds.ts", () => {
  test("rebuilds from placeOnAxis with identical output and no computed-key spread", () => {
    everyAxis.forEach((axis) =>
      rects.forEach((rect) =>
        sizeLists.forEach((sizes) =>
          [0, 6, 21.5].forEach((gap) => {
            const input = { axis, rect, sizes, gap };
            expect(rebuiltSplitGeometry(input)).toEqual(todaySplitGeometry(input));
          }),
        ),
      ),
    );
  });

  test("rebuilds its limits from sizeOnAxis, sum, minOf and maxOf with identical output", () => {
    everyAxis.forEach((axis) =>
      limitLists.forEach((limits) =>
        [0, 6].forEach((gap) => {
          const input = { axis, limits, gap };
          expect(rebuiltSplitLimits(input)).toEqual(todaySplitLimits(input));
        }),
      ),
    );
  });
});

describe("the stacked limits in next/layout/kinds.ts", () => {
  test("rebuild from minOf and maxOf with identical output, empty list included", () => {
    limitLists.forEach((limits) => expect(rebuiltStacked(limits)).toEqual(todayStacked(limits)));
  });

  test("agree that an empty list floors at zero and does not bound the maximum", () => {
    expect(rebuiltStacked([])).toEqual({
      min: { width: 0, height: 0 },
      max: { width: Infinity, height: Infinity },
    });
  });
});

const todayResizeRect = ({
  rect,
  handle,
  delta,
  minSize,
  aspectRatio,
}: {
  rect: Rect;
  handle: ResizeHandle;
  delta: { x: number; y: number };
  minSize: Size;
  aspectRatio?: number | undefined;
}): Rect => {
  const west = handle.includes("west");
  const east = handle.includes("east");
  const north = handle.includes("north");
  const south = handle.includes("south");
  const widthDelta = (Number(east) - Number(west)) * delta.x;
  const heightDelta = (Number(south) - Number(north)) * delta.y;
  const rawWidth = Math.max(rect.width + widthDelta, minSize.width);
  const rawHeight = Math.max(rect.height + heightDelta, minSize.height);
  const useHeight =
    !(west || east) ||
    ((north || south) && Math.abs(heightDelta * (aspectRatio ?? 1)) > Math.abs(widthDelta));
  const width =
    aspectRatio === undefined
      ? rawWidth
      : Math.max(
          useHeight ? rawHeight * aspectRatio : rawWidth,
          minSize.width,
          minSize.height * aspectRatio,
        );
  const height = aspectRatio === undefined ? rawHeight : width / aspectRatio;
  return {
    width,
    height,
    x: west ? rect.x + rect.width - width : rect.x,
    y: north ? rect.y + rect.height - height : rect.y,
  };
};

describe("this package's resizeRect guards ratios the incumbent never receives", () => {
  const base: Rect = { x: 20, y: 40, width: 300, height: 200 };
  const minSize: Size = { width: 60, height: 30 };
  const limits = { min: minSize, max: { width: Infinity, height: Infinity } };
  const delta = d.vec2f(37, -23);

  // NOT a defect in the incumbent. next/state.schema.ts:11 defines Positive as "Finite > 0" and
  // applies it to aspectRatio on both the window record (:29) and the window definition (:86), so
  // ArkType rejects 0, NaN and Infinity before either call site runs. The guard here is defensive:
  // this package is published and cannot assume a validated caller. An earlier version of this
  // suite asserted the incumbent was broken; that claim was wrong and is withdrawn.
  test("a zero ratio would make an unguarded implementation infinitely tall", () => {
    const theirs = todayResizeRect({
      rect: base,
      handle: "south-east",
      delta: { x: delta.x, y: delta.y },
      minSize,
      aspectRatio: 0,
    });
    expect(Number.isFinite(theirs.height)).toBe(false);

    const mine = resizeRect({
      rect: Rect(base),
      handle: "south-east",
      delta,
      limits,
      aspectRatio: 0,
    });
    expect(Number.isFinite(mine.height)).toBe(true);
  });

  test("a NaN ratio would poison every field of an unguarded implementation", () => {
    const theirs = todayResizeRect({
      rect: base,
      handle: "south-east",
      delta: { x: delta.x, y: delta.y },
      minSize,
      aspectRatio: Number.NaN,
    });
    expect(Number.isNaN(theirs.width)).toBe(true);
    expect(Number.isNaN(theirs.height)).toBe(true);

    const mine = resizeRect({
      rect: Rect(base),
      handle: "south-east",
      delta,
      limits,
      aspectRatio: Number.NaN,
    });
    expect(Number.isFinite(mine.width)).toBe(true);
    expect(Number.isFinite(mine.height)).toBe(true);
  });

  test("they still agree for every ratio an author would mean", () => {
    [0.5, 1, 1.75, 16 / 9].forEach((aspectRatio) => {
      const theirs = todayResizeRect({
        rect: base,
        handle: "south-east",
        delta: { x: delta.x, y: delta.y },
        minSize,
        aspectRatio,
      });
      const mine = resizeRect({
        rect: Rect(base),
        handle: "south-east",
        delta,
        limits,
        aspectRatio,
      });
      expect(mine.width).toBeCloseTo(theirs.width, 3);
      expect(mine.height).toBeCloseTo(theirs.height, 3);
    });
  });
});

const handles: ResizeHandle[] = [
  "north",
  "south",
  "east",
  "west",
  "north-east",
  "north-west",
  "south-east",
  "south-west",
];

describe("resizeRect against the one in next/geometry.ts", () => {
  const base: Rect = { x: 20, y: 40, width: 300, height: 200 };
  const minSize: Size = { width: 60, height: 30 };
  const deltas: { x: number; y: number }[] = [
    { x: 0, y: 0 },
    { x: 37, y: -23 },
    { x: -500, y: -500 },
    { x: 500, y: 500 },
    { x: -12, y: 400 },
  ];

  test("is identical with no maximum, for every handle, delta and aspect ratio", () => {
    handles.forEach((handle) =>
      deltas.forEach((delta) =>
        [undefined, 0.5, 1, 2.5].forEach((aspectRatio) => {
          const now = resizeRect({
            rect: Rect(base),
            handle,
            delta: d.vec2f(delta.x, delta.y),
            limits: { min: minSize, max: { width: Infinity, height: Infinity } },
            aspectRatio,
          });
          const before = todayResizeRect({ rect: base, handle, delta, minSize, aspectRatio });
          expect(now.x).toBeCloseTo(before.x, 3);
          expect(now.y).toBeCloseTo(before.y, 3);
          expect(now.width).toBeCloseTo(before.width, 3);
          expect(now.height).toBeCloseTo(before.height, 3);
        }),
      ),
    );
  });

  test("keeps a zero or negative aspect ratio from poisoning the result with NaN", () => {
    handles.forEach((handle) =>
      [0, -2].forEach((aspectRatio) => {
        const resized = resizeRect({
          rect: Rect(base),
          handle,
          delta: d.vec2f(37, -23),
          limits: { min: minSize, max: { width: Infinity, height: Infinity } },
          aspectRatio,
        });
        expect(Number.isFinite(resized.width)).toBe(true);
        expect(Number.isFinite(resized.height)).toBe(true);
        expect(Number.isFinite(resized.x)).toBe(true);
        expect(Number.isFinite(resized.y)).toBe(true);
      }),
    );
  });
});
