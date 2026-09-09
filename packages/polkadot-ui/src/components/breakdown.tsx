import { tv } from "../tv.ts";

const breakdown = tv({
  slots: {
    root: "flex flex-col gap-[7px]",
    bar: "flex h-[6px] w-full overflow-hidden rounded-pk-pill bg-pk-level-0",
    segment: "h-full",
    legend: "flex flex-wrap items-center gap-x-[13px] gap-y-1",
    item: "flex items-center gap-[5px] font-pk-sans text-[10.5px] leading-none whitespace-nowrap text-pk-ink-soft",
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

export type BreakdownProps = Omit<React.ComponentProps<"div">, "children"> & {
  readonly parts: readonly BreakdownPart[];
  /** Hides the legend, for a bar under a heading that already names the parts. */
  readonly showLegend?: boolean;
};

function Breakdown({ parts, showLegend = true, className, ...props }: BreakdownProps) {
  const styles = breakdown();
  const total = parts.reduce((sum, part) => sum + part.share, 0) || 1;

  return (
    <div data-slot="breakdown" className={styles.root({ className })} {...props}>
      <div className={styles.bar()}>
        {parts.map((part) => (
          <span
            key={part.name}
            style={{ width: `${(part.share / total) * 100}%`, background: part.color }}
            className={styles.segment()}
          />
        ))}
      </div>
      {showLegend ? (
        <div className={styles.legend()}>
          {parts.map((part) => (
            <span key={part.name} className={styles.item()}>
              <span style={{ background: part.color }} className={styles.swatch()} />
              {part.name} {Math.round((part.share / total) * 100)}%
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export { Breakdown, breakdown as breakdownVariants };
