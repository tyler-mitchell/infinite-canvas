import { area, curveMonotoneX, line } from "d3-shape";
import { useId } from "react";
import type { VariantProps } from "tailwind-variants";

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
    glow: "absolute right-0 size-7.5 translate-x-1/2 -translate-y-1/2 rounded-pk-pill [background:radial-gradient(circle,color-mix(in_oklab,var(--pk-accent)_45%,transparent),transparent_70%)] top-(--head)",
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
 */
export function sparklinePoints(values: readonly number[]): readonly SparklinePoint[] {
  if (values.length === 0) return [];

  const low = Math.min(...values);
  const span = Math.max(...values) - low || 1;
  const y = (value: number) => INSET + (1 - (value - low) / span) * (HEIGHT - INSET * 2);

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

/**
 * The head to draw when the consumer names none. A series with no readings marks nothing, because
 * a head is a reading, and a caption takes the dot's place.
 */
export function sparklineHead(values: readonly number[], caption?: string) {
  if (values.length === 0) return "none";

  return caption ? "badge" : "dot";
}

/** What the chart is called when the consumer gives no `label`. */
export function sparklineLabel(values: readonly number[]) {
  if (values.length === 0) return "no readings";
  if (values.length === 1) return `one reading, ${values[0]}`;

  return `${values.length} readings, latest ${values[values.length - 1]}`;
}

export type SparklineProps = Omit<React.ComponentProps<"div">, "children"> &
  VariantProps<typeof sparkline> & {
    /** Oldest first. The last value is the head. */
    readonly values: readonly number[];
    /**
     * Puts a badge at the head in the dot's place. An explicit `head` still wins.
     *
     * The chart is one `img` with one name, so nothing drawn inside it is read on its own — this
     * included. Say it in `label` as well, or leave `label` off and let the default name carry the
     * latest reading.
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
  const styles = sparkline({ size, head: head ?? sparklineHead(values, caption) });
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
      aria-label={label ?? sparklineLabel(values)}
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
