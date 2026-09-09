import { tv } from "../tv.ts";

const pendingCard = tv({
  slots: {
    root: "box-border flex flex-col justify-start gap-3 overflow-hidden rounded-pk-card border border-dashed border-pk-pending-line bg-pk-pending-surface p-[18px] transition-colors duration-(--pk-duration-hover) ease-pk-swift hover:border-pk-pending-line-hover",
    head: "flex flex-none items-start justify-between gap-[10px]",
    title:
      "truncate font-pk-mono text-[13px] leading-[1.4] font-medium tracking-[0.02em] text-pk-accent",
    badge:
      "flex-none rounded-[6px] border border-pk-pending-line px-2 py-[5px] font-pk-sans text-[10px] leading-none font-medium tracking-[0.08em] text-pk-ink-faint uppercase",
    body: "overflow-hidden font-pk-mono text-[11.5px] leading-[1.6] text-pk-pending-ink",
  },
});

export type PendingCardProps = Omit<React.ComponentProps<"div">, "children" | "title"> & {
  readonly title: string;
  readonly body: string;
  /** The stamp on the right. Defaults to the design's own word. */
  readonly stamp?: string;
};

function PendingCard({ title, body, stamp = "soon", className, ...props }: PendingCardProps) {
  const styles = pendingCard();

  return (
    <div data-slot="pending-card" className={styles.root({ className })} {...props}>
      <div className={styles.head()}>
        <span className={styles.title()}>{title}</span>
        <span className={styles.badge()}>{stamp}</span>
      </div>
      <span className={styles.body()}>{body}</span>
    </div>
  );
}

export { PendingCard, pendingCard as pendingCardVariants };
