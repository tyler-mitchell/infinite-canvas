import { tv } from "../tv.ts";
import { Surface, type SurfaceProps } from "./surface.tsx";

const activityFeed = tv({
  slots: {
    root: "gap-3",
    head: "flex flex-none items-center gap-2",
    title: "min-w-0 font-pk-sans text-pk-label break-words text-pk-ink-dim",
    /* `list-none` rather than leaning on a reset, so the kit carries its own markers off. */
    list: "m-0 flex min-w-0 list-none flex-col p-0",
    item: "flex min-w-0 items-start gap-3 border-t border-pk-line-inner py-3 first:border-t-0 first:pt-0 last:pb-0",
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
  readonly name: React.ReactNode;
  /** How long the run took. Sits beside the name. */
  readonly duration?: React.ReactNode;
  readonly note: React.ReactNode;
  /** How long ago it finished. Sits at the right end. */
  readonly since?: React.ReactNode;
}

export type ActivityFeedProps = Omit<SurfaceProps, "children" | "title"> & {
  readonly entries: readonly ActivityEntry[];
  /** Set null to omit the header. */
  readonly title?: React.ReactNode;
  /** A mark before the title. Decoration, like an entry's own: the title carries the words. */
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
    <Surface
      render={<div data-slot="activity-feed" />}
      className={styles.root({ className })}
      {...props}
    >
      {title === null ? null : (
        <div className={styles.head()}>
          {titleIcon == null || typeof titleIcon === "boolean" ? null : (
            <span aria-hidden className={styles.lead()}>
              {titleIcon}
            </span>
          )}
          <span className={styles.title()}>{title}</span>
        </div>
      )}
      <ul className={styles.list()}>
        {entries.map((entry) => (
          <li key={entry.id} data-slot="activity-entry" className={styles.item()}>
            {entry.icon == null || typeof entry.icon === "boolean" ? null : (
              <span aria-hidden className={styles.lead()}>
                {entry.icon}
              </span>
            )}
            <div className={styles.body()}>
              <div className={styles.line()}>
                <span className={styles.name()}>{entry.name}</span>
                {entry.duration == null || typeof entry.duration === "boolean" ? null : (
                  <span className={styles.duration()}>{entry.duration}</span>
                )}
              </div>
              <p className={styles.note()}>{entry.note}</p>
            </div>
            {entry.since == null || typeof entry.since === "boolean" ? null : (
              <span className={styles.since()}>{entry.since}</span>
            )}
          </li>
        ))}
      </ul>
    </Surface>
  );
}

export { ActivityFeed, activityFeed as activityFeedVariants };
