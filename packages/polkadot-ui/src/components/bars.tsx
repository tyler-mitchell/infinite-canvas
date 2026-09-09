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

export interface BarsProps
  extends Omit<React.ComponentProps<"div">, "children">, VariantProps<typeof bars> {
  /** Raw values. Heights are a share of `max`, or of the largest value when `max` is omitted. */
  readonly values: readonly number[];
  readonly max?: number;
  /** Floor so an empty bucket is still a mark rather than nothing. */
  readonly minHeight?: number;
  readonly label?: string;
}

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
  const ceiling = max ?? Math.max(...values, 1);

  return (
    <div
      data-slot="bars"
      role="img"
      aria-label={label}
      className={styles.root({ className })}
      {...props}
    >
      {values.map((value, index) => {
        const share = Math.max(minHeight, Math.min(1, value / ceiling));
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
