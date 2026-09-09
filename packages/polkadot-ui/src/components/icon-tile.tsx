import { useRender } from "@base-ui/react/use-render";
import { tv, type VariantProps } from "tailwind-variants";

/**
 * An icon that names itself when you point at it.
 *
 * The most repeated shape in the design: fourteen of them, each a one-cell square that widens to
 * three cells and reveals a word. Nothing else in the source occurs half as often.
 *
 * The design measured the label's `scrollWidth` every frame and animated a pixel width to it. A
 * grid column going from `0fr` to `1fr` reaches the same content width with no measurement and no
 * frame loop, so the reveal is one compositor-owned transition.
 *
 * The label stays in the DOM while collapsed — clipped, never `display: none` — so it is the
 * accessible name whether or not anyone hovers. Pass a decorative icon (`alt=""`); the word is what
 * carries the meaning.
 */
const iconTile = tv({
  slots: {
    root: "group/tile inline-flex flex-none items-center rounded-pk-inner border border-pk-line bg-pk-surface p-[10px] font-pk-sans outline-none transition-colors duration-(--pk-duration-hover) ease-pk-swift select-none hover:border-pk-line-hover focus-visible:ring-2 focus-visible:ring-pk-accent/50",
    icon: "flex flex-none items-center justify-center [&_img]:size-full [&_svg]:size-full",
    /*
     * The reveal. `0fr` to `1fr` is a real transition; width to `auto` is not.
     *
     * The minimum is spelled out because a bare `0fr` is `minmax(auto, 0fr)`, and that automatic
     * minimum kept the label's own left padding alive — a nine-pixel sliver on every collapsed tile.
     */
    label:
      "grid grid-cols-[minmax(0,0fr)] transition-[grid-template-columns] duration-(--pk-duration-hover) ease-pk-swift group-hover/tile:grid-cols-[minmax(0,1fr)] group-focus-visible/tile:grid-cols-[minmax(0,1fr)]",
    /* The gap rides on the text so it collapses with it, rather than holding a hole open. */
    text: "min-w-0 overflow-hidden pl-[9px] text-[12.5px] leading-none tracking-[-0.005em] whitespace-nowrap text-pk-ink-muted",
  },
  variants: {
    size: {
      sm: { icon: "size-[20px]" },
      md: { icon: "size-[26px]" },
    },
    /* Held open, for a row that should read as a legend rather than wait to be pointed at. */
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
