import { area, curveMonotoneX, line } from "d3-shape";
import { useId } from "react";
import type { VariantProps } from "tailwind-variants";

import { namedReading } from "../label.ts";
import { tv } from "../tv.ts";

const sparkline = tv({
  slots: {
    root: "relative w-full",
    plot: "block size-full overflow-visible",
    fillFrom: "[stop-color:var(--pk-accent)] [stop-opacity:0.22]",
    fillTo: "[stop-color:var(--pk-accent)] [stop-opacity:0]",
    traceFrom: "[stop-color:var(--pk-accent)] [stop-opacity:0]",
    traceVia: "[stop-color:var(--pk-accent)] [stop-opacity:0.45]",
    traceTo: "[stop-color:var(--pk-accent)] [stop-opacity:1]",
    fill: "[stroke:none]",
    trace:
      "fill-none [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.6] [vector-effect:non-scaling-stroke]",
    drop: "absolute right-0 bottom-0 w-px bg-pk-accent/35 top-(--head)",
    glow: "absolute right-0 size-7.5 translate-x-1/2 -translate-y-1/2 rounded-pk-pill bg-[image:radial-gradient(circle,color-mix(in_oklab,var(--pk-accent)_45%,transparent),transparent_70%)] top-(--head)",
    dot: "absolute right-0 size-[5px] translate-x-1/2 -translate-y-1/2 rounded-pk-pill bg-pk-ink-bright top-(--head)",
    badge:
      "absolute right-0 flex -translate-y-1/2 items-center rounded-pk-pill bg-pk-accent px-[7px] py-[3px] font-pk-mono text-pk-mono-sm text-pk-on-accent tabular-nums top-(--head)",
  },
  variants: {
    size: {
      sm: { root: "h-8" },
      md: { root: "h-11" },
      lg: { root: "h-14" },
    },
    head: {
      dot: { badge: "hidden" },
      badge: { dot: "hidden", glow: "hidden" },
      none: { dot: "hidden", glow: "hidden", drop: "hidden", badge: "hidden" },
    },
  },
  defaultVariants: { size: "md", head: "dot" },
});

const WIDTH = 300;
const HEIGHT = 44;
const INSET = 4;

export type SparklinePoint = readonly [x: number, y: number];

/**
 * The trace in view space, oldest at the left. An empty series draws nothing, and a single sample
 * draws flat across the full width, because one reading is a series at rest rather than a point at
 * the left edge.
 *
 * A reading that is not a number sits at the low, which is where the bars put one and where the
 * breakdown puts a share it cannot use. It is read out of the extent as well: taken into it, the
 * span is `NaN`, that falls through `|| 1` because `NaN` is falsy, and every other point in the
 * series comes back `NaN` — one bad reading took the whole trace rather than its own place in it.
 */
export function sparklinePoints(values: readonly number[]): readonly SparklinePoint[] {
  if (values.length === 0) return [];

  const real = values.filter((value) => Number.isFinite(value));
  /* Folded rather than spread: a call takes about a hundred and twenty five thousand arguments, and
   * a spread passes one per reading, so a long enough series threw instead of drawing. */
  const low = real.reduce((least, value) => Math.min(least, value), real[0] ?? 0);
  const span = real.reduce((most, value) => Math.max(most, value), real[0] ?? 0) - low || 1;
  const y = (value: number) =>
    INSET + (1 - ((Number.isFinite(value) ? value : low) - low) / span) * (HEIGHT - INSET * 2);

  if (values.length === 1) {
    const only = y(values[0]!);

    return [
      [0, only],
      [WIDTH, only],
    ];
  }

  const step = WIDTH / (values.length - 1);

  return values.map((value, index) => [index * step, y(value)] as const);
}

export type SparklineHead = "dot" | "badge" | "none";

/**
 * The head to draw when the consumer names none. A series with no readings marks nothing, because
 * a head is a reading, and a caption takes the dot's place.
 */
export function sparklineHead(values: readonly number[], caption?: string): SparklineHead {
  if (values.length === 0) return "none";

  return caption ? "badge" : "dot";
}

/**
 * What the chart reads as: how many readings, and the latest one where a head marks it.
 *
 * The head is read for the same reason the bars read their emphasis: the last value is worth
 * naming because a dot or a badge marks it, and a trace drawn with no head marks nothing. Naming a
 * latest there would point at a reading the line runs through like every other.
 *
 * `latest` is how the caption spells that reading — `20ms` rather than `20`. A caption is drawn
 * inside the one `img`, so nothing reads it on its own; saying the bare number instead left a
 * reader the figure without its unit, and left the page writing the unit into the name by hand.
 */
export function sparklineLabel(
  values: readonly number[],
  head: SparklineHead = "dot",
  latest?: string,
) {
  const last = latest ?? values[values.length - 1];

  if (values.length === 0) return "no readings";
  if (values.length === 1) return `one reading, ${last}`;
  if (head === "none") return `${values.length} readings`;

  return `${values.length} readings, latest ${last}`;
}

export type SparklineProps = Omit<React.ComponentProps<"div">, "children"> &
  VariantProps<typeof sparkline> & {
    /** Oldest first. The last value is the head. */
    readonly values: readonly number[];
    /**
     * Puts a badge at the head in the dot's place. An explicit `head` still wins.
     *
     * The chart is one `img` with one name, so nothing drawn inside it is read on its own — so the
     * name says this as the latest reading, units and all. Pages used to write the caption into
     * `label` by hand to get it spoken, which is a second place for the same figure to go stale.
     */
    readonly caption?: string;
    /** Names the series for a reader who cannot see it. */
    readonly label?: string;
  };

/**
 * A trace with a live head. One reading draws level across the width, because a single sample is a
 * series at rest rather than a point at the left edge; an empty one draws nothing and marks no
 * head, since a head is a reading.
 */
function Sparkline({ values, caption, label, size, head, className, ...props }: SparklineProps) {
  /* Resolved once: the same head decides what is drawn and whether a latest is worth naming. */
  const marked = head ?? sparklineHead(values, caption);
  const styles = sparkline({ size, head: marked });
  const id = useId();

  const points = sparklinePoints(values);

  const trace = line<(typeof points)[number]>()
    .x((point) => point[0])
    .y((point) => point[1])
    .curve(curveMonotoneX);
  const under = area<(typeof points)[number]>()
    .x((point) => point[0])
    .y0(HEIGHT)
    .y1((point) => point[1])
    .curve(curveMonotoneX);

  const headHeight = points[points.length - 1]?.[1] ?? HEIGHT / 2;

  return (
    <div
      data-slot="sparkline"
      role="img"
      aria-label={namedReading(label, sparklineLabel(values, marked, caption))}
      style={{ "--head": `${(headHeight / HEIGHT) * 100}%` } as React.CSSProperties}
      className={styles.root({ className })}
      {...props}
    >
      <svg
        aria-hidden
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        className={styles.plot()}
      >
        <defs>
          <linearGradient id={`${id}-fill`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" className={styles.fillFrom()} />
            <stop offset="1" className={styles.fillTo()} />
          </linearGradient>
          <linearGradient id={`${id}-trace`} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" className={styles.traceFrom()} />
            <stop offset="0.18" className={styles.traceVia()} />
            <stop offset="1" className={styles.traceTo()} />
          </linearGradient>
        </defs>
        <path d={under(points) ?? undefined} fill={`url(#${id}-fill)`} className={styles.fill()} />
        <path
          d={trace(points) ?? undefined}
          stroke={`url(#${id}-trace)`}
          className={styles.trace()}
        />
      </svg>
      <span className={styles.drop()} />
      <span className={styles.glow()} />
      <span className={styles.dot()} />
      {caption ? <span className={styles.badge()}>{caption}</span> : null}
    </div>
  );
}

export { Sparkline, sparkline as sparklineVariants };
