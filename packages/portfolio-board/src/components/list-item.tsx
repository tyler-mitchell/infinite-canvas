import { useRender } from "@base-ui/react/use-render";
import type { VariantProps } from "tailwind-variants";

import { tv } from "../tv.ts";

const listItem = tv({
  slots: {
    root: "group/item flex w-full min-w-0 items-start gap-3 rounded-pk-control-inner py-2 text-left font-pk-sans outline-none transition-colors duration-(--pk-duration-hover) ease-pk-swift focus-visible:ring-2 focus-visible:ring-pk-accent/50",
    lead: "flex-none",
    label:
      "min-w-0 flex-1 break-words text-pk-item text-pk-ink-muted transition-colors duration-(--pk-duration-hover) ease-pk-swift group-hover/item:text-pk-ink-bright",
    trail: "flex-none text-pk-meta whitespace-nowrap text-pk-ink-faint tabular-nums",
  },
  variants: {
    density: { compact: { root: "py-1" }, comfortable: {} },
    look: {
      plain: {},
      nav: {
        root: "-mx-2 cursor-pointer px-2 hover:bg-pk-ink/[0.06] focus-visible:bg-pk-ink/[0.06]",
        label: "group-focus-visible/item:text-pk-ink-bright",
        trail:
          "transition-colors duration-(--pk-duration-hover) ease-pk-swift group-hover/item:text-pk-ink-muted group-focus-visible/item:text-pk-ink-muted",
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

/** A row with optional leading content and trailing metadata. */
function ListItem({
  lead,
  trail,
  look,
  density,
  children,
  className,
  render,
  ...props
}: ListItemProps) {
  const styles = listItem({ look, density });

  return useRender({
    render,
    defaultTagName: "div",
    props: {
      ...props,
      "data-slot": "list-item",
      className: styles.root({ className }),
      children: (
        <>
          {lead == null || typeof lead === "boolean" ? null : (
            <span className={styles.lead()}>{lead}</span>
          )}
          <span className={styles.label()}>{children}</span>
          {trail == null || typeof trail === "boolean" ? null : (
            <span className={styles.trail()}>{trail}</span>
          )}
        </>
      ),
    },
  });
}

export { ListItem, listItem as listItemVariants };
