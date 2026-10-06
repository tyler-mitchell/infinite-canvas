import type { VariantProps } from "tailwind-variants";

import { tv } from "../tv.ts";

const metricTile = tv({
  slots: {
    root: "box-border flex min-w-0 flex-col justify-between gap-2",
    label:
      "font-pk-sans text-[9.5px] leading-none font-medium tracking-[0.05em] break-words text-pk-ink-dim uppercase",
    reading: "flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1",
    value:
      "min-w-0 font-pk-mono text-[13px] leading-[1.25] break-words text-pretty text-pk-ink tabular-nums",
    limit: "font-pk-mono text-[13px] leading-[1.25] whitespace-nowrap text-pk-ink-dim tabular-nums",
  },
  variants: {
    look: {
      tile: {
        root: "overflow-hidden rounded-[11px] border border-pk-line bg-pk-surface-inner px-2.5 py-2",
      },
      readout: {
        root: "gap-4",
        label: "text-pk-label leading-[1.25] tracking-normal",
        value:
          "font-pk-sans text-[length:var(--pk-metric-value-size)] leading-none font-semibold tracking-[-0.035em] text-pk-ink-bright [text-shadow:var(--pk-metric-text-shadow)]",
        limit:
          "font-pk-sans text-[length:var(--pk-metric-limit-size)] leading-none font-normal tracking-[-0.025em]",
      },
    },
  },
  defaultVariants: { look: "tile" },
});

export type MetricTileProps = Omit<React.ComponentProps<"div">, "children"> &
  VariantProps<typeof metricTile> & {
    readonly label: string;
    /** A figure, or anything that stands in for one. */
    readonly children: React.ReactNode;
    readonly limit?: React.ReactNode;
  };

function MetricTile({ label, children, limit, look, className, ...props }: MetricTileProps) {
  const styles = metricTile({ look });

  return (
    <div data-slot="metric-tile" className={styles.root({ className })} {...props}>
      <span className={styles.label()}>{label}</span>
      <div className={styles.reading()}>
        <span className={styles.value()}>{children}</span>
        {limit == null || typeof limit === "boolean" ? null : (
          <span className={styles.limit()}>/ {limit}</span>
        )}
      </div>
    </div>
  );
}

export { MetricTile, metricTile as metricTileVariants };
