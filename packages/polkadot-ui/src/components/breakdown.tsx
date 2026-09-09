import { tv } from "tailwind-variants";

/*
 * One bar showing how a whole divides, with the legend that names the parts.
 *
 * Shares are normalised rather than trusted: a language breakdown that has dropped its long tail
 * sums to less than one, and rounded percentages sum to more. Either way the bar must fill exactly.
 *
 * Colour is rank, not category. This kit has one accent, so the largest part takes it and the rest
 * step down through the same hue; anything past the fourth is grey, which is what a tail is.
 */
const breakdown = tv({
  slots: {
    root: "flex flex-col gap-2",
    bar: "flex h-[3px] w-full gap-px overflow-hidden rounded-pk-pill",
    segment: "h-full first:rounded-l-pk-pill last:rounded-r-pk-pill",
    legend: "flex flex-wrap items-center gap-x-3 gap-y-1",
    item: "inline-flex items-center gap-1.5 font-pk-sans text-pk-meta text-pk-ink-faint",
    swatch: "size-[5px] flex-none rounded-pk-pill",
    share: "text-pk-ink-dim tabular-nums",
  },
  variants: {
    rank: {
      0: { segment: "bg-pk-accent", swatch: "bg-pk-accent" },
      1: { segment: "bg-pk-accent/55", swatch: "bg-pk-accent/55" },
      2: { segment: "bg-pk-accent/28", swatch: "bg-pk-accent/28" },
      3: { segment: "bg-pk-ink-faint/45", swatch: "bg-pk-ink-faint/45" },
    },
  },
  defaultVariants: { rank: 3 },
});

/** A named part of the whole. `share` is a fraction, not a percentage. */
export interface BreakdownPart {
  readonly name: string;
  readonly share: number;
}

export type BreakdownProps = Omit<React.ComponentProps<"div">, "children"> & {
  readonly parts: readonly BreakdownPart[];
  /** Hides the legend, for a bar that sits under a heading which already names the parts. */
  readonly showLegend?: boolean;
};

function Breakdown({ parts, showLegend = true, className, ...props }: BreakdownProps) {
  const styles = breakdown();
  const total = parts.reduce((sum, part) => sum + part.share, 0) || 1;

  return (
    <div data-slot="breakdown" className={styles.root({ className })} {...props}>
      <div className={styles.bar()}>
        {parts.map((part, index) => (
          <span
            key={part.name}
            style={{ flexGrow: part.share / total }}
            className={breakdown({ rank: Math.min(index, 3) as 0 | 1 | 2 | 3 }).segment()}
          />
        ))}
      </div>
      {showLegend ? (
        <div className={styles.legend()}>
          {parts.map((part, index) => (
            <span key={part.name} className={styles.item()}>
              <span className={breakdown({ rank: Math.min(index, 3) as 0 | 1 | 2 | 3 }).swatch()} />
              {part.name}
              <span className={styles.share()}>
                {Math.round((part.share / total) * 100)}
                {"%"}
              </span>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export { Breakdown, breakdown as breakdownVariants };
