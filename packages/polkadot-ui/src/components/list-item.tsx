import { useRender } from "@base-ui/react/use-render";
import type { VariantProps } from "tailwind-variants";

import { tv } from "../tv.ts";

const listItem = tv({
  slots: {
    root: "group/item flex w-full items-center gap-2.5 rounded-pk-control-inner py-1.5 text-left font-pk-sans outline-none transition-colors duration-(--pk-duration-hover) ease-pk-swift focus-visible:ring-2 focus-visible:ring-pk-accent/45",
    lead: "flex-none",
    label:
      "min-w-0 flex-1 truncate text-pk-item text-pk-ink-muted transition-[color,translate] duration-(--pk-duration-hover) ease-pk-settle group-hover/item:text-pk-ink-bright",
    trail: "flex-none text-pk-meta text-pk-ink-faint tabular-nums",
  },
  variants: {
    look: {
      plain: {},
      nav: {
        root: "-mx-2 cursor-pointer px-2 hover:bg-pk-ink/[0.06] focus-visible:bg-pk-ink/[0.06]",
        label:
          "group-hover/item:translate-x-[3px] group-focus-visible/item:translate-x-[3px] group-focus-visible/item:text-pk-ink-bright",
        lead: "transition-[translate] duration-(--pk-duration-hover) ease-pk-settle group-hover/item:translate-x-[2px]",
      },
    },
  },
  defaultVariants: { look: "plain" },
});

export interface ListItemProps
  extends useRender.ComponentProps<"div">, VariantProps<typeof listItem> {
  /** A tile, an avatar, a dot — whatever marks the row. */
  readonly lead?: React.ReactNode;
  /** The value on the right: a year, a count, a handle. */
  readonly trail?: React.ReactNode;
}

function ListItem({ lead, trail, look, children, className, render, ...props }: ListItemProps) {
  const styles = listItem({ look });

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
