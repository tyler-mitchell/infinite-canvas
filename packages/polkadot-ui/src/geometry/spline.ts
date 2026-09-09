/** The subset of a 2D path builder a spline needs. `CanvasRenderingContext2D` and `Path2D` both fit. */
export interface PathSink {
  moveTo(x: number, y: number): void;
  bezierCurveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number): void;
}

/**
 * Fritsch-Carlson monotone tangents. A cubic through these cannot overshoot a local minimum or
 * maximum, so the curve reads smooth without inventing peaks the data does not have.
 */
export const monotoneTangents = (xs: readonly number[], ys: readonly number[]) => {
  const count = xs.length;
  if (count < 2) return Array.from({ length: count }, () => 0);

  const secants = xs
    .slice(0, -1)
    .map((x, i) => ((ys[i + 1] as number) - (ys[i] as number)) / ((xs[i + 1] as number) - x));

  const tangents = secants.map((_, i) =>
    i === 0
      ? (secants[0] as number)
      : (secants[i - 1] as number) * (secants[i] as number) <= 0
        ? 0
        : ((secants[i - 1] as number) + (secants[i] as number)) / 2,
  );
  tangents.push(secants[secants.length - 1] as number);

  for (let i = 0; i < secants.length; i++) {
    const secant = secants[i] as number;
    if (secant === 0) {
      tangents[i] = 0;
      tangents[i + 1] = 0;
      continue;
    }
    const a = (tangents[i] as number) / secant;
    const b = (tangents[i + 1] as number) / secant;
    const magnitude = a * a + b * b;
    if (magnitude > 9) {
      const scale = 3 / Math.sqrt(magnitude);
      tangents[i] = scale * a * secant;
      tangents[i + 1] = scale * b * secant;
    }
  }

  return tangents;
};

export const monotonePath = (path: PathSink, xs: readonly number[], ys: readonly number[]) => {
  if (xs.length === 0) return;
  const tangents = monotoneTangents(xs, ys);
  path.moveTo(xs[0] as number, ys[0] as number);
  for (let i = 0; i < xs.length - 1; i++) {
    const span = (xs[i + 1] as number) - (xs[i] as number);
    path.bezierCurveTo(
      (xs[i] as number) + span / 3,
      (ys[i] as number) + ((tangents[i] as number) * span) / 3,
      (xs[i + 1] as number) - span / 3,
      (ys[i + 1] as number) - ((tangents[i + 1] as number) * span) / 3,
      xs[i + 1] as number,
      ys[i + 1] as number,
    );
  }
};
