import { namedReading } from "../label.ts";
import { tv } from "../tv.ts";

const breakdown = tv({
  slots: {
    root: "flex min-w-0 flex-col gap-2",
    bar: "flex h-[6px] w-full overflow-hidden rounded-pk-pill bg-pk-level-0",
    segment: "h-full",
    legend: "flex flex-wrap items-center gap-x-[13px] gap-y-1",
    item: "flex items-center gap-1.5 font-pk-sans text-pk-meta whitespace-nowrap text-pk-ink-soft",
    swatch: "size-[7px] flex-none rounded-pk-pill",
  },
});

/** A named part of the whole. `share` is a fraction, not a percentage. */
export interface BreakdownPart {
  readonly name: string;
  readonly share: number;
  /** Any CSS colour. The design uses each language's own. */
  readonly color: string;
}

/**
 * Each part's fraction of the whole, in order. Shares need not sum to one, and a share that is
 * negative or not a number counts as nothing rather than dragging the whole bar with it: a
 * breakdown is a summary, and one bad reading should not stop the rest from being drawn.
 */
export function breakdownShares(parts: readonly BreakdownPart[]): readonly number[] {
  const usable = parts.map((part) => (Number.isFinite(part.share) ? Math.max(0, part.share) : 0));
  const total = usable.reduce((sum, share) => sum + share, 0);

  return total > 0 ? usable.map((share) => share / total) : usable.map(() => 0);
}

/**
 * What the bar is called when the consumer gives no `label`. A part that rounds away is still
 * named, because a reader who cannot see the bar has no other way to learn it was there.
 */
export function breakdownLabel(parts: readonly BreakdownPart[]) {
  if (parts.length === 0) return "nothing to show";

  const shares = breakdownShares(parts);

  return parts
    .map((part, index) => `${part.name} ${Math.round((shares[index] ?? 0) * 100)}%`)
    .join(", ");
}

export type BreakdownProps = Omit<React.ComponentProps<"div">, "children"> & {
  readonly parts: readonly BreakdownPart[];
  /** Hides the legend, for a bar under a heading that already names the parts. */
  readonly showLegend?: boolean;
  /**
   * Names the split for a reader who cannot see it. The shares are added to it rather than
   * replaced by it — a name and the figures, in that order.
   *
   * The legend is drawn but muted, so the bar's name is the whole of what a reader gets. This used
   * to replace that name, and a page passing "language split" left every share drawn and unsaid;
   * the answer then was to spell `breakdownLabel(parts)` into the label by hand, which put the same
   * figures in two places.
   */
  readonly label?: string;
};

/**
 * Shares need not sum to one — each part is drawn as its fraction of whatever they do sum to. A
 * share that is negative or not a number counts as nothing rather than dragging the bar with it.
 *
 * The legend is hidden from assistive software because it restates the bar's own name, and one
 * rendering read twice is worse than one read once. That holds because the name always lists every
 * part and its share: a `label` is composed onto that list rather than replacing it, so naming the
 * bar cannot cost the figures the legend is muted in favour of.
 */
function Breakdown({ parts, showLegend = true, label, className, ...props }: BreakdownProps) {
  const styles = breakdown();
  const shares = breakdownShares(parts);

  return (
    <div data-slot="breakdown" className={styles.root({ className })} {...props}>
      <div
        role="img"
        aria-label={namedReading(label, breakdownLabel(parts))}
        className={styles.bar()}
      >
        {parts.map((part, index) => (
          <span
            key={index}
            style={{ width: `${(shares[index] ?? 0) * 100}%`, background: part.color }}
            className={styles.segment()}
          />
        ))}
      </div>
      {showLegend ? (
        <div aria-hidden className={styles.legend()}>
          {parts.map((part, index) => (
            <span key={index} className={styles.item()}>
              <span style={{ background: part.color }} className={styles.swatch()} />
              {part.name} {Math.round((shares[index] ?? 0) * 100)}%
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export { Breakdown, breakdown as breakdownVariants };
