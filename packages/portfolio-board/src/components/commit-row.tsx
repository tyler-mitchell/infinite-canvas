import { tv } from "../tv.ts";

const commitRow = tv({
  slots: {
    root: "flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5",
    sha: "flex-none font-pk-mono text-pk-mono text-pk-ink-faint",
    subject: "min-w-0 flex-1 basis-[9rem] font-pk-sans text-pk-lede break-words text-pk-ink-muted",
    age: "flex-none font-pk-mono text-pk-mono text-pk-ink-faint",
  },
});

export type CommitRowProps = Omit<React.ComponentProps<"div">, "children"> & {
  readonly sha: string;
  readonly subject: string;
  readonly age: string;
};

function CommitRow({ sha, subject, age, className, ...props }: CommitRowProps) {
  const styles = commitRow();

  return (
    <div data-slot="commit-row" className={styles.root({ className })} {...props}>
      <span className={styles.sha()}>{sha}</span>
      <span className={styles.subject()}>{subject}</span>
      <span className={styles.age()}>{age}</span>
    </div>
  );
}

export { CommitRow, commitRow as commitRowVariants };
