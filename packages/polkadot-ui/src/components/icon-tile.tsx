import { useRender } from "@base-ui/react/use-render";
import type { VariantProps } from "tailwind-variants";

import { tv } from "../tv.ts";

const iconTile = tv({
  slots: {
    root: "group/tile inline-flex flex-none items-center rounded-pk-inner border border-pk-line bg-pk-surface p-[10px] font-pk-sans outline-none transition-colors duration-(--pk-duration-hover) ease-pk-swift select-none hover:border-pk-line-hover focus-visible:ring-2 focus-visible:ring-pk-accent/50",
    icon: "flex flex-none items-center justify-center [&_img]:size-full [&_svg]:size-full",
    label:
      "grid grid-cols-[minmax(0,0fr)] transition-[grid-template-columns] duration-(--pk-duration-hover) ease-pk-swift group-hover/tile:grid-cols-[minmax(0,1fr)] group-focus-visible/tile:grid-cols-[minmax(0,1fr)]",
    text: "min-w-0 overflow-hidden pl-[9px] text-[12.5px] leading-none tracking-[-0.005em] whitespace-nowrap text-pk-ink-muted",
  },
  variants: {
    size: {
      sm: { icon: "size-[20px]" },
      md: { icon: "size-[26px]" },
    },
    open: {
      true: { label: "grid-cols-[minmax(0,1fr)]" },
      false: {},
    },
  },
  defaultVariants: { size: "md", open: false },
});

export interface IconTileProps
  extends Omit<useRender.ComponentProps<"div">, "children">, VariantProps<typeof iconTile> {
  /** Decorative: the label is the accessible name, so give an image `alt=""`. */
  readonly icon: React.ReactNode;
  readonly label: string;
}

function IconTile({ icon, label, size, open, className, render, ...props }: IconTileProps) {
  const styles = iconTile({ size, open });

  return useRender({
    render,
    defaultTagName: "div",
    props: {
      ...props,
      "data-slot": "icon-tile",
      className: styles.root({ className: className as string }),
      children: (
        <>
          <span className={styles.icon()} aria-hidden>
            {icon}
          </span>
          <span className={styles.label()}>
            <span className={styles.text()}>{label}</span>
          </span>
        </>
      ),
    },
  });
}

export { IconTile, iconTile as iconTileVariants };
