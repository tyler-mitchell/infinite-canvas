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
  if (!Number.isFinite(value)) return floor;

  return Math.max(floor, Math.min(1, value / ceiling));
}

export interface BarsProps
  extends Omit<React.ComponentProps<"div">, "children">, VariantProps<typeof bars> {
  /** Raw values. Heights are a share of `max`, or of the largest value when `max` is omitted. */
  readonly values: readonly number[];
  readonly max?: number;
  /** Floor so an empty bucket is still a mark rather than nothing. */
  readonly minHeight?: number;
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
      aria-label={label}
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
