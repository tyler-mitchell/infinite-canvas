import { area, curveMonotoneX, line } from "d3-shape";
import { useId } from "react";
import { tv, type VariantProps } from "tailwind-variants";

/*
 * A trace with a live head: the most repeated data shape in the design, drawn three times there.
 *
 * The path is stretched to the container by `preserveAspectRatio="none"`, so the view box is a
 * proportion rather than a size and nothing has to be measured. A stretched stroke would thin on one
 * axis, which `non-scaling-stroke` prevents, and a stretched circle would become an ellipse — so the
 * head is HTML above the drawing, not a shape inside it, and stays round at every width.
 *
 * The trace fades out at its trailing edge so the window has no hard cut, and the head carries a
 * glow, a tick down to the floor and a hot dot. All four come from the design source.
 */
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
    /* Everything below is positioned from `--head`, the last value's height in the plot. */
    drop: "absolute right-0 bottom-0 w-px bg-pk-accent/35 top-(--head)",
    glow: "absolute right-0 size-[30px] translate-x-1/2 -translate-y-1/2 rounded-pk-pill [background:radial-gradient(circle,color-mix(in_oklab,var(--pk-accent)_45%,transparent),transparent_70%)] top-(--head)",
    dot: "absolute right-0 size-[5px] translate-x-1/2 -translate-y-1/2 rounded-pk-pill bg-white top-(--head)",
    badge:
      "absolute right-0 flex -translate-y-1/2 items-center rounded-pk-pill bg-pk-accent px-[7px] py-[3px] font-pk-mono text-pk-mono-sm text-pk-on-accent tabular-nums top-(--head)",
  },
  variants: {
    size: {
      sm: { root: "h-8" },
      md: { root: "h-11" },
      lg: { root: "h-14" },
    },
    /* A badge sits where the dot would, so the two never both mark the head. */
    head: {
      dot: { badge: "hidden" },
      badge: { dot: "hidden", glow: "hidden" },
      none: { dot: "hidden", glow: "hidden", drop: "hidden", badge: "hidden" },
    },
  },
  defaultVariants: { size: "md", head: "dot" },
});

/* The view box is a proportion, not a size. The inset keeps the extremes off the top and bottom. */
const WIDTH = 300;
const HEIGHT = 44;
const INSET = 4;

export type SparklineProps = Omit<React.ComponentProps<"div">, "children"> &
  VariantProps<typeof sparkline> & {
    /** Oldest first. The last value is the head. */
    readonly values: readonly number[];
    /** Puts a badge at the head in the dot's place. An explicit `head` still wins. */
    readonly caption?: string;
    /** Names the series for a reader who cannot see it. */
    readonly label?: string;
  };

function Sparkline({ values, caption, label, size, head, className, ...props }: SparklineProps) {
  const styles = sparkline({ size, head: head ?? (caption ? "badge" : "dot") });
  const id = useId();

  /*
   * A flat series has no span to divide by, and a single point has no step. Both are real inputs —
   * a metric that has not moved, and a card rendering its first sample — so they draw a flat line at
   * mid height rather than dividing by zero and disappearing.
   */
  const low = Math.min(...values);
  const span = Math.max(...values) - low || 1;
  const step = values.length > 1 ? WIDTH / (values.length - 1) : 0;
  const points = values.map(
    (value, index) =>
      [index * step, INSET + (1 - (value - low) / span) * (HEIGHT - INSET * 2)] as const,
  );

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
      aria-label={label ?? `${values.length} points, latest ${values[values.length - 1]}`}
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
