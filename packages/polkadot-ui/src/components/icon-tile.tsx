import { useRender } from "@base-ui/react/use-render";
import type { VariantProps } from "tailwind-variants";

import { tv } from "../tv.ts";

const iconTile = tv({
  slots: {
    root: "group/tile inline-flex flex-none items-center justify-center rounded-pk-inner border border-pk-line bg-pk-surface p-2.5 font-pk-sans outline-none transition-colors duration-(--pk-duration-hover) ease-pk-swift select-none hover:border-pk-line-hover focus-visible:ring-2 focus-visible:ring-pk-accent/50",
    icon: "flex flex-none items-center justify-center [&_img]:size-full [&_svg]:size-full",
    label:
      "grid grid-cols-[minmax(0,0fr)] transition-[grid-template-columns] duration-(--pk-duration-hover) ease-pk-swift group-hover/tile:grid-cols-[minmax(0,1fr)] group-focus-visible/tile:grid-cols-[minmax(0,1fr)]",
    text: "min-w-0 overflow-hidden pl-[9px] text-[12.5px] leading-none font-medium tracking-[-0.005em] whitespace-nowrap text-pk-ink-muted",
  },
  variants: {
    fill: { true: { root: "flex aspect-square w-full" }, false: {} },
    size: {
      sm: { icon: "size-5" },
      md: { icon: "size-6.5" },
    },
    open: {
      true: { label: "grid-cols-[minmax(0,1fr)]" },
      false: { label: "sr-only" },
    },
  },
  defaultVariants: { size: "md" },
});

export interface IconTileProps
  extends Omit<useRender.ComponentProps<"div">, "children">, VariantProps<typeof iconTile> {
  /** Decorative: the label is the accessible name, so give an image `alt=""`. */
  readonly icon: React.ReactNode;
  readonly label: string;
  /** Omit for hover reveal. True shows the label; false keeps it visually hidden. */
  readonly open?: boolean;
}

/**
 * An icon that gives its name room when pointed at. The name is in the markup either way, so a
 * reader who cannot see the tile is still told what it is.
 *
 * It opens on hover or on keyboard focus, and a touch device offers neither: measured at 375px
 * with touch emulated, a tap leaves the label nine pixels wide while a held-open tile shows all
 * sixty-eight. Set `open` wherever a sighted reader on a phone has to read the name.
 */
function IconTile({ icon, label, size, open, fill, className, render, ...props }: IconTileProps) {
  const styles = iconTile({ size, open, fill });

  return useRender({
    render,
    defaultTagName: "div",
    props: {
      ...props,
      "data-slot": "icon-tile",
      className: styles.root({ className }),
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
