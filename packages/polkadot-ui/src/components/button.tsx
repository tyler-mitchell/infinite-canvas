import { Button as ButtonPrimitive } from "@base-ui/react/button";
import type { VariantProps } from "tailwind-variants";

import { tv } from "../tv.ts";

const button = tv({
  base: "inline-flex w-fit shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-pk-control border border-transparent font-pk-sans whitespace-nowrap outline-none transition-[color,background-color,border-color,opacity] duration-(--pk-duration-hover) ease-pk-swift select-none focus-visible:ring-2 focus-visible:ring-pk-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-(color:--pk-ring-seat) data-disabled:pointer-events-none data-disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  variants: {
    tone: {
      solid:
        "bg-pk-accent text-pk-on-accent hover:brightness-110 data-disabled:bg-pk-ink/[0.06] data-disabled:text-pk-ink-faint",
      soft: "bg-pk-ink/[0.06] text-pk-ink-muted hover:bg-pk-ink/[0.1] hover:text-pk-ink-bright data-disabled:text-pk-ink-faint",
      outline:
        "border-pk-line text-pk-ink-muted hover:border-pk-line-strong hover:bg-pk-ink/[0.04] hover:text-pk-ink-bright data-disabled:text-pk-ink-faint",
      ghost:
        "text-pk-ink-dim hover:bg-pk-ink/[0.06] hover:text-pk-ink-bright data-disabled:text-pk-ink-faint",
    },
    size: {
      sm: "h-6 px-2.5 text-pk-label [&_svg]:size-3",
      md: "h-7 px-3 text-pk-control [&_svg]:size-3.5",
      lg: "h-8 px-3.5 text-pk-control [&_svg]:size-4",
      icon: "size-7 p-0 text-pk-control [&_svg]:size-3.5",
    },
  },
  defaultVariants: { tone: "soft", size: "md" },
});

export type ButtonProps = Omit<ButtonPrimitive.Props, "className"> &
  VariantProps<typeof button> & { className?: string };

/**
 * Sized to its content rather than aligned, so it neither stretches down a flex column nor fights
 * `items-center` across a row. Disabled is a colour, not an opacity, and the same in every tone.
 */
function Button({ tone, size, className, ...props }: ButtonProps) {
  return (
    <ButtonPrimitive data-slot="button" className={button({ tone, size, className })} {...props} />
  );
}

export { Button, button as buttonVariants };
