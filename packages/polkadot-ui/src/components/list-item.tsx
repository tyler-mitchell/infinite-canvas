import { useRender } from "@base-ui/react/use-render";
import { tv } from "../tv.ts";

const listItem = tv({
  slots: {
    root: "group/item flex w-full items-center gap-2.5 rounded-pk-control-inner py-1.5 text-left font-pk-sans outline-none transition-colors duration-(--pk-duration-hover) ease-pk-swift focus-visible:ring-2 focus-visible:ring-pk-accent/45",
    lead: "flex-none",
    label:
      "min-w-0 flex-1 truncate text-pk-item text-pk-ink-muted transition-colors duration-(--pk-duration-hover) ease-pk-swift group-hover/item:text-pk-ink-bright",
    trail: "flex-none text-pk-meta text-pk-ink-faint tabular-nums",
  },
});

export interface ListItemProps extends useRender.ComponentProps<"div"> {
  /** A tile, an avatar, a dot — whatever marks the row. */
  readonly lead?: React.ReactNode;
  /** The value on the right: a year, a count, a handle. */
  readonly trail?: React.ReactNode;
}

function ListItem({ lead, trail, children, className, render, ...props }: ListItemProps) {
  const styles = listItem();

  return useRender({
    render,
    defaultTagName: "div",
    props: {
      ...props,
      "data-slot": "list-item",
      className: styles.root({ className: className as string }),
      children: (
        <>
          {lead ? <span className={styles.lead()}>{lead}</span> : null}
          <span className={styles.label()}>{children}</span>
          {trail ? <span className={styles.trail()}>{trail}</span> : null}
        </>
      ),
    },
  });
}

export { ListItem, listItem as listItemVariants };
