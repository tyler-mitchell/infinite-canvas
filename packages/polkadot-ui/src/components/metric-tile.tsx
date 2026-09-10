import { tv } from "../tv.ts";

const metricTile = tv({
  slots: {
    root: "box-border flex min-w-0 flex-col justify-between gap-2 overflow-hidden rounded-[11px] border border-pk-line bg-pk-surface-inner px-2.5 py-2",
    label:
      "font-pk-sans text-[9.5px] leading-none font-medium tracking-[0.05em] whitespace-nowrap text-pk-ink-dim uppercase",
    value: "font-pk-mono text-[13px] leading-[1.25] break-words text-pretty text-pk-ink",
  },
});

export type MetricTileProps = Omit<React.ComponentProps<"div">, "children"> & {
  readonly label: string;
  /** A figure, or anything that stands in for one. */
  readonly children: React.ReactNode;
};

function MetricTile({ label, children, className, ...props }: MetricTileProps) {
  const styles = metricTile();

  return (
    <div data-slot="metric-tile" className={styles.root({ className })} {...props}>
      <span className={styles.label()}>{label}</span>
      <span className={styles.value()}>{children}</span>
    </div>
  );
}

export { MetricTile, metricTile as metricTileVariants };
