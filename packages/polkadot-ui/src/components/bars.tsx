import type { VariantProps } from "tailwind-variants";

import { tv } from "../tv.ts";

const bars = tv({
  slots: {
    root: "flex min-h-0 flex-1 items-end",
    bar: "flex-1 bg-pk-bar transition-[height] duration-(--pk-duration-detail) ease-pk-swift data-newest:bg-pk-accent",
  },
  variants: {
    gap: {
      tight: { root: "gap-[3px]" },
      default: { root: "gap-1" },
    },
    shape: {
      column: { bar: "rounded-[1px]" },
      bar: { bar: "rounded-t-[2px]" },
    },
    emphasis: {
      last: {},
      none: {},
    },
  },
  defaultVariants: { gap: "default", shape: "bar", emphasis: "last" },
});

/**
 * The value a full bar stands for. An explicit `max` is used only when it is a positive number,
 * because a zero or negative ceiling has no meaning and would divide every height by it.
 */
export function barCeiling(values: readonly number[], max?: number) {
  if (max !== undefined && Number.isFinite(max) && max > 0) return max;

  return Math.max(...values.filter((value) => Number.isFinite(value)), 1);
}

/** A bar's height as a share of the ceiling, floored so an empty bucket is still a mark. */
export function barShare(value: number, ceiling: number, minHeight: number) {
  const floor = Number.isFinite(minHeight) ? Math.min(1, Math.max(0, minHeight)) : 0;
  const share = value / ceiling;

  /*
   * The floor marks a bucket with nothing in it. Holding real values up to it as well flattens a
   * series against a ceiling it does not reach: under one shared with a larger series, four of
   * eight weekly figures met the floor and drew the same height while differing by two thirds.
   */
  if (!Number.isFinite(share) || share <= 0) return floor;

  return Math.min(1, share);
}

/**
 * What the chart is called when the consumer gives no `label`, in the same words the sparkline
 * uses. The newest value is the one the emphasis marks, so it is the one worth naming.
 *
 * Which is why `emphasis` is read here too. A chart that marks no bar has no newest to speak of,
 * and naming one anyway tells a reader the plot distinguishes a value it draws exactly like the
 * rest — a level meter is the case, and it counts its readings without singling one out.
 */
export function barsLabel(values: readonly number[], emphasis: "last" | "none" = "last") {
  if (values.length === 0) return "no readings";
  if (values.length === 1) return `one reading, ${values[0]}`;
  if (emphasis === "none") return `${values.length} readings`;

  return `${values.length} readings, latest ${values[values.length - 1]}`;
}

export interface BarsProps
  extends Omit<React.ComponentProps<"div">, "children">, VariantProps<typeof bars> {
  /** Raw values. Heights are a share of `max`, or of the largest value when `max` is omitted. */
  readonly values: readonly number[];
  readonly max?: number;
  /** Floor so an empty bucket is still a mark rather than nothing. */
  readonly minHeight?: number;
  /** Names the series for a reader who cannot see it. Falls back to the readings themselves. */
  readonly label?: string;
}

/**
 * Heights are a share of `max`, or of the tallest value when `max` is omitted — which is right for
 * a lone chart and wrong for a pair, so give two charts one ceiling if a reader will compare them.
 */
function Bars({
  values,
  max,
  minHeight = 0.08,
  gap,
  shape,
  emphasis,
  label,
  className,
  ...props
}: BarsProps) {
  const styles = bars({ gap, shape, emphasis });
  const ceiling = barCeiling(values, max);

  return (
    <div
      data-slot="bars"
      role="img"
      aria-label={label?.trim() || barsLabel(values, emphasis ?? "last")}
      className={styles.root({ className })}
      {...props}
    >
      {values.map((value, index) => {
        const share = barShare(value, ceiling, minHeight);
        const newest = emphasis !== "none" && index === values.length - 1;
        return (
          <div
            key={index}
            data-slot="bars-bar"
            data-newest={newest ? "" : undefined}
            className={styles.bar()}
            style={{ height: `${(share * 100).toFixed(1)}%` }}
          />
        );
      })}
    </div>
  );
}

export { Bars, bars as barsVariants };
