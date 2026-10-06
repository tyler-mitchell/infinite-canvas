import { reductions } from "@thi.ng/transducers";

export function activitySchedule({
  days,
  duration = 1,
  cellDuration = 0,
  thresholds = [],
  impactPause = 0,
}: {
  readonly days: readonly ({ readonly count: number } | null)[];
  readonly duration?: number;
  readonly cellDuration?: number;
  readonly thresholds?: readonly number[];
  readonly impactPause?: number;
}) {
  const weights = days.map(
    (day) => Math.sqrt(Math.max(0, Number.isFinite(day?.count) ? day!.count : 0)) + 1,
  );
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const remaining = Math.max(0, duration - days.length * cellDuration);
  const threshold = thresholds.filter(Number.isFinite).toSorted((a, b) => a - b)[3];
  return reductions<
    [number, number],
    { start: number; end: number; duration: number; impactAt: number | undefined }
  >(
    [
      () => ({ start: 0, end: 0, duration: 0, impactAt: undefined }),
      (segment) => segment,
      (previous, [index, weight]) => {
        const start = previous.end;
        const transitionDuration = cellDuration + (remaining * weight) / total;
        const count = days[index]?.count;
        const impactAt =
          threshold === undefined ||
          count === undefined ||
          !Number.isFinite(count) ||
          count <= 0 ||
          count < threshold
            ? undefined
            : start + (transitionDuration * Math.max(0, threshold)) / count;
        return {
          start,
          duration: transitionDuration,
          impactAt,
          end: start + transitionDuration + (impactAt === undefined ? 0 : impactPause),
        };
      },
    ],
    weights.entries(),
  ).slice(1);
}
