export type Point = { x: number; y: number };
export type Size = { width: number; height: number };
export type Rect = Point & Size;
export type Camera = { center: Point; zoom: number };

export function containsPoint({
  rect,
  point,
  padding = 0,
}: {
  rect: Rect;
  point: Point;
  padding?: number;
}): boolean {
  return (
    point.x >= rect.x - padding &&
    point.x <= rect.x + rect.width + padding &&
    point.y >= rect.y - padding &&
    point.y <= rect.y + rect.height + padding
  );
}

export function screenToWorld({
  point,
  camera,
  viewport,
}: {
  point: Point;
  camera: Camera;
  viewport: Size;
}): Point {
  return {
    x: camera.center.x + (point.x - viewport.width / 2) / camera.zoom,
    y: camera.center.y + (point.y - viewport.height / 2) / camera.zoom,
  };
}

export function intersectsRect({ rect, other }: { rect: Rect; other: Rect }): boolean {
  return (
    rect.x <= other.x + other.width &&
    rect.x + rect.width >= other.x &&
    rect.y <= other.y + other.height &&
    rect.y + rect.height >= other.y
  );
}

export function unionRects(rects: readonly Rect[]): Rect | null {
  if (rects.length === 0) return null;
  const x = Math.min(...rects.map((rect) => rect.x));
  const y = Math.min(...rects.map((rect) => rect.y));
  return {
    x,
    y,
    width: Math.max(...rects.map((rect) => rect.x + rect.width)) - x,
    height: Math.max(...rects.map((rect) => rect.y + rect.height)) - y,
  };
}
export const directions = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};
export type Direction = keyof typeof directions;

export function getDirectionalTarget({
  origin,
  candidates,
  direction,
  axisBias = 2,
}: {
  origin: Rect;
  candidates: Readonly<Record<string, Rect>>;
  direction: Direction;
  axisBias?: number;
}): string | undefined {
  const { x, y } = directions[direction];
  const scored = Object.entries(candidates).flatMap(([id, rect]) => {
    const delta = {
      x: rect.x + rect.width / 2 - origin.x - origin.width / 2,
      y: rect.y + rect.height / 2 - origin.y - origin.height / 2,
    };
    const along = delta.x * x + delta.y * y;
    const across = Math.abs(delta.x * y - delta.y * x);
    return along <= 0 || across > along ? [] : [{ id, score: along + axisBias * across }];
  });
  return scored.toSorted((left, right) => left.score - right.score)[0]?.id;
}

export type ResizeHandle =
  | "north"
  | "south"
  | "east"
  | "west"
  | "north-east"
  | "north-west"
  | "south-east"
  | "south-west";

export function resizeRect({
  rect,
  handle,
  delta,
  minSize,
  aspectRatio,
}: {
  rect: Rect;
  handle: ResizeHandle;
  delta: Point;
  minSize: Size;
  aspectRatio?: number;
}): Rect {
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
}
export function getResizeHandleDescriptors({
  size,
  offset,
  inset,
}: {
  size: string;
  offset: string;
  inset: string | number;
}) {
  return [
    {
      handle: "north",
      cursor: "ns-resize",
      style: { height: size, left: inset, right: inset, top: offset },
    },
    {
      handle: "south",
      cursor: "ns-resize",
      style: { height: size, left: inset, right: inset, bottom: offset },
    },
    {
      handle: "east",
      cursor: "ew-resize",
      style: { width: size, top: inset, bottom: inset, right: offset },
    },
    {
      handle: "west",
      cursor: "ew-resize",
      style: { width: size, top: inset, bottom: inset, left: offset },
    },
    {
      handle: "north-west",
      cursor: "nwse-resize",
      style: { width: size, height: size, top: offset, left: offset },
    },
    {
      handle: "north-east",
      cursor: "nesw-resize",
      style: { width: size, height: size, top: offset, right: offset },
    },
    {
      handle: "south-west",
      cursor: "nesw-resize",
      style: { width: size, height: size, bottom: offset, left: offset },
    },
    {
      handle: "south-east",
      cursor: "nwse-resize",
      style: { width: size, height: size, bottom: offset, right: offset },
    },
  ] as const;
}
