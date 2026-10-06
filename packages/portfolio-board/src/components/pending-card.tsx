import { tv } from "../tv.ts";
import { Surface, type SurfaceProps } from "./surface.tsx";

const pendingCard = tv({
  slots: {
    root: "gap-3",
    head: "flex flex-none items-start justify-between gap-2.5",
    title: "min-w-0 flex-1 font-pk-sans text-pk-title break-words text-pk-ink",
    badge:
      "flex-none rounded-pk-control-inner border border-pk-pending-line px-2 py-[5px] font-pk-sans text-pk-micro tracking-[0.08em] text-pk-ink-faint uppercase",
    body: "m-0 font-pk-sans text-pk-body break-words text-pk-ink-soft",
  },
});

export type PendingCardProps = Omit<SurfaceProps, "children" | "title"> & {
  readonly title: React.ReactNode;
  readonly body: React.ReactNode;
  /** Defaults to "soon". Set null to omit it. */
  readonly stamp?: React.ReactNode;
};

function PendingCard({ title, body, stamp = "soon", className, ...props }: PendingCardProps) {
  const styles = pendingCard();

  return (
    <Surface
      tone="pending"
      padding="snug"
      render={<div data-slot="pending-card" />}
      className={styles.root({ className })}
      {...props}
    >
      <div className={styles.head()}>
        <span className={styles.title()}>{title}</span>
        {stamp == null || typeof stamp === "boolean" ? null : (
          <span className={styles.badge()}>{stamp}</span>
        )}
      </div>
      <p className={styles.body()}>{body}</p>
    </Surface>
  );
}

export { PendingCard, pendingCard as pendingCardVariants };
