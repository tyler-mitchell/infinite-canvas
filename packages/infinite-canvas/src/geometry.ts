import { centroidOfRect, cross2, dot2, sub2, type Rect } from "@hyphened/math/cpu";
import { argMin } from "@thi.ng/arrays";

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
  const from = centroidOfRect(origin);
  const scored = Object.entries(candidates).flatMap(([id, rect]) => {
    const to = centroidOfRect(rect);
    const delta = sub2([], [to.x, to.y], [from.x, from.y]);
    const along = dot2(delta, [x, y]);
    const across = Math.abs(cross2(delta, [x, y]));
    return along <= 0 || across > along ? [] : [{ id, score: along + axisBias * across }];
  });
  return scored[argMin(scored.map((entry) => entry.score))]?.id;
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
