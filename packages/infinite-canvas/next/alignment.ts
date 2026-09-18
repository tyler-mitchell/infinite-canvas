import type { Point, Rect } from "./geometry";

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
  const moved = { ...rect, x: rect.x + delta.x, y: rect.y + delta.y };
  const alignments = (["x", "y"] as const).map((axis) => {
    const size = axis === "x" ? "width" : "height";
    const fractions = [...(edges ? [0, 1] : []), ...(centers ? [0.5] : [])];
    const candidates = targets
      .flatMap((target) =>
        fractions.flatMap((from) =>
          fractions.map((to) => ({
            target,
            position: target[axis] + target[size] * to,
            offset: target[axis] + target[size] * to - moved[axis] - moved[size] * from,
          })),
        ),
      )
      .filter(({ offset }) => Math.abs(offset) <= threshold);
    const closest = candidates.reduce<(typeof candidates)[number] | undefined>(
      (best, candidate) =>
        best === undefined || Math.abs(candidate.offset) < Math.abs(best.offset) ? candidate : best,
      undefined,
    );
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
    return [
      {
        axis,
        position: closest.position,
        start: Math.min(start, closest.target[cross]),
        end: Math.max(start + rect[size], closest.target[cross] + closest.target[size]),
      },
    ];
  });
  return { delta: snapped, guides };
}
