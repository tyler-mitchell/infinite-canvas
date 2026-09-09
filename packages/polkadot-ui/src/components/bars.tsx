import { tv, type VariantProps } from "tailwind-variants";

/**
 * A series as a row of bars.
 *
 * Counted in the design POC: 24 bar children across two widgets — a level meter and a weekly
 * install count — with the same shape each time. Equal widths, heights as a share of the tallest,
 * the last member emphasised. That regularity is why this is a component and the five canvas
 * instruments are not: those are five bespoke painters with nothing in common but a `<canvas>`.
 *
 * DOM rather than canvas, so a height change is a CSS transition on the compositor rather than a
 * per-frame repaint, and so the values survive a document that is not producing frames.
 */
const bars = tv({
  slots: {
    root: "flex min-h-0 flex-1 items-end",
    /* Height is inline because it is the data. Everything that is a treatment stays here. */
    bar: "flex-1 bg-pk-line-strong transition-[height] duration-(--pk-duration-detail) ease-pk-swift data-newest:bg-pk-accent",
  },
  variants: {
    gap: {
      tight: { root: "gap-[3px]" },
      default: { root: "gap-1" },
    },
    shape: {
      /* A level meter reads as a column; an install count reads as a bar with a footing. */
      column: { bar: "rounded-[1px]" },
      bar: { bar: "rounded-t-[2px]" },
    },
    emphasis: {
      /* The newest value is the one being reported, so it carries the accent. */
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
