import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { tv, type VariantProps } from "tailwind-variants";

/*
 * Four tones, ordered by how much attention each one asks for: solid, soft, outline, ghost.
 *
 * A tone is a fill, not an outline. Only `outline` draws an edge, and the base keeps a transparent
 * border on every tone so all four are the same height in a row.
 *
 * The hover fill is alpha on the ink rather than a surface token, so a button sits correctly on the
 * ground, on a card and on a sunken tray without a tone for each.
 */
const button = tv({
  base: "inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-pk-control border border-transparent font-pk-sans whitespace-nowrap outline-none transition-[color,background-color,border-color,opacity] duration-(--pk-duration-hover) ease-pk-swift select-none focus-visible:ring-2 focus-visible:ring-pk-accent/45 focus-visible:ring-offset-2 focus-visible:ring-offset-pk-ground disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0",
  variants: {
    tone: {
      /*
       * Disabled drops the fill rather than fading it. At 40% opacity a saturated fill is still the
       * loudest thing in a row, so an accent button that cannot be pressed read as the one to press.
       */
      solid:
        "bg-pk-accent text-pk-on-accent hover:brightness-110 disabled:bg-pk-ink/[0.06] disabled:text-pk-ink-faint",
      soft: "bg-pk-ink/[0.06] text-pk-ink-muted hover:bg-pk-ink/[0.1] hover:text-pk-ink-bright disabled:text-pk-ink-faint disabled:opacity-50",
      outline:
        "border-pk-line text-pk-ink-muted hover:border-pk-line-strong hover:bg-pk-ink/[0.04] hover:text-pk-ink-bright disabled:text-pk-ink-faint disabled:opacity-50",
      ghost:
        "text-pk-ink-dim hover:bg-pk-ink/[0.06] hover:text-pk-ink-bright disabled:text-pk-ink-faint disabled:opacity-50",
    },
    size: {
      sm: "h-6 px-2.5 text-pk-label [&_svg]:size-3",
      md: "h-7 px-3 text-pk-control [&_svg]:size-3.5",
      lg: "h-8 px-3.5 text-pk-control [&_svg]:size-4",
      icon: "size-7 p-0 [&_svg]:size-3.5",
    },
  },
  defaultVariants: { tone: "soft", size: "md" },
});

export type ButtonProps = Omit<ButtonPrimitive.Props, "className"> &
  VariantProps<typeof button> & { className?: string };

function Button({ tone, size, className, ...props }: ButtonProps) {
  return (
    <ButtonPrimitive data-slot="button" className={button({ tone, size, className })} {...props} />
  );
}

export { Button, button as buttonVariants };
