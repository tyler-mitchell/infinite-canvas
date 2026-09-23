import {
  argminN,
  inRange,
  interval,
  mix,
  translateRect,
  union,
  type Point,
  type Rect,
} from "@hyphened/math/cpu";

export type AlignmentGuide = { axis: "x" | "y"; position: number; start: number; end: number };
export type SnappingOptions = {
  enabled: boolean;
  threshold: number;
  edges: boolean;
  centers: boolean;
};

export function alignRect({
  rect,
  delta,
  targets,
  threshold,
  edges,
  centers,
}: {
  rect: Rect;
  delta: Point;
  targets: readonly Rect[];
} & Pick<SnappingOptions, "threshold" | "edges" | "centers">) {
  const moved = translateRect(rect, delta);
  const alignments = (["x", "y"] as const).map((axis) => {
    const size = axis === "x" ? "width" : "height";
    const fractions = [...(edges ? [0, 1] : []), ...(centers ? [0.5] : [])];
    const anchor = (box: Rect, fraction: number) =>
      mix(box[axis], box[axis] + box[size], fraction);
    const candidates = targets
      .flatMap((target) =>
        fractions.flatMap((from) =>
          fractions.map((to) => ({
            target,
            position: anchor(target, to),
            offset: anchor(target, to) - anchor(moved, from),
          })),
        ),
      )
      .filter(({ offset }) => inRange(offset, -threshold, threshold));
    const closest = candidates[argminN(0, candidates.map((candidate) => candidate.offset))];
    return { axis, closest };
  });
  const snapped = {
    x: delta.x + (alignments[0].closest?.offset ?? 0),
    y: delta.y + (alignments[1].closest?.offset ?? 0),
  };
  const guides: AlignmentGuide[] = alignments.flatMap(({ axis, closest }) => {
    if (closest === undefined) return [];
    const cross = axis === "x" ? "y" : "x";
    const size = axis === "x" ? "height" : "width";
    const start = rect[cross] + snapped[cross];
    const span = union(
      interval(start, start + rect[size]),
      interval(closest.target[cross], closest.target[cross] + closest.target[size]),
    );
    return [{ axis, position: closest.position, start: span.l, end: span.r }];
  });
  return { delta: snapped, guides };
}
