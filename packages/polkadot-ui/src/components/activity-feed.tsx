import { tv } from "../tv.ts";

const activityFeed = tv({
  slots: {
    root: "box-border flex flex-col gap-2.5 overflow-hidden rounded-pk-card border border-pk-line bg-pk-surface p-5 shadow-pk-card transition-colors duration-(--pk-duration-hover) ease-pk-swift hover:border-pk-line-hover",
    head: "flex flex-none items-center gap-2",
    title: "min-w-0 font-pk-sans text-pk-label break-words text-pk-ink-dim",
    /* `list-none` rather than leaning on a reset, so the kit carries its own markers off. */
    list: "flex list-none flex-col",
    item: "pk-rise flex items-start gap-2.5 border-t border-pk-line-inner py-[11px] first:border-t-0 first:pt-0 last:pb-0",
    lead: "mt-px flex size-4.5 flex-none items-center justify-center text-pk-ink-faint [&_svg]:size-full",
    body: "flex min-w-0 flex-1 flex-col gap-1",
    line: "flex flex-wrap items-baseline gap-2",
    name: "min-w-0 font-pk-sans text-pk-item break-words text-pk-ink-muted",
    duration:
      "flex-none rounded-pk-pill bg-pk-ink/[0.06] px-[7px] py-[3px] font-pk-mono text-pk-mono-sm text-pk-ink-dim tabular-nums",
    note: "m-0 font-pk-sans text-pk-note break-words text-pk-ink-faint",
    since:
      "flex-none self-start font-pk-mono text-pk-mono-sm text-pk-ink-faint uppercase tabular-nums",
  },
});

export interface ActivityEntry {
  /** Unique across `entries`: it is what tells one row from another when the list changes. */
  readonly id: string;
  readonly icon?: React.ReactNode;
  readonly name: string;
  /** How long the run took. Sits beside the name. */
  readonly duration?: string;
  readonly note: string;
  /** How long ago it finished. Sits at the right end. */
  readonly since?: string;
}

export type ActivityFeedProps = Omit<React.ComponentProps<"div">, "children" | "title"> & {
  readonly entries: readonly ActivityEntry[];
  readonly title?: string;
  readonly titleIcon?: React.ReactNode;
};

function ActivityFeed({
  entries,
  title = "recent activity",
  titleIcon,
  className,
  ...props
}: ActivityFeedProps) {
  const styles = activityFeed();

  return (
    <div data-slot="activity-feed" className={styles.root({ className })} {...props}>
      <div className={styles.head()}>
        {titleIcon ? <span className={styles.lead()}>{titleIcon}</span> : null}
        <span className={styles.title()}>{title}</span>
      </div>
      <ul className={styles.list()}>
        {entries.map((entry) => (
          <li key={entry.id} data-slot="activity-entry" className={styles.item()}>
            {entry.icon ? (
              <span aria-hidden className={styles.lead()}>
                {entry.icon}
              </span>
            ) : null}
            <div className={styles.body()}>
              <div className={styles.line()}>
                <span className={styles.name()}>{entry.name}</span>
                {entry.duration ? (
                  <span className={styles.duration()}>{entry.duration}</span>
                ) : null}
              </div>
              <p className={styles.note()}>{entry.note}</p>
            </div>
            {entry.since ? <span className={styles.since()}>{entry.since}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

export { ActivityFeed, activityFeed as activityFeedVariants };
