import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { tv, type VariantProps } from "tailwind-variants";

const button = tv({
  base: "inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 border font-pk-sans whitespace-nowrap outline-none transition-[color,background-color,border-color,box-shadow] duration-(--pk-duration-hover) ease-pk-swift select-none focus-visible:ring-2 focus-visible:ring-pk-accent/50 disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  variants: {
    tone: {
      /* The chip is the board's own control: a hairline that brightens, no fill until active. */
      chip: "rounded-pk-pill border-pk-line bg-transparent text-pk-ink-dim hover:border-pk-line-strong hover:text-pk-ink-muted",
      quiet:
        "rounded-pk-chip border-pk-line-inner-raised bg-transparent text-pk-ink-muted hover:border-pk-line-strong hover:text-pk-ink-bright",
      accent:
        "rounded-pk-chip border-pk-accent bg-pk-accent text-pk-on-accent hover:brightness-110",
      /* Bare text, for a control inside a widget header that must not look like chrome. */
      bare: "border-transparent bg-transparent text-pk-ink-faint hover:text-pk-ink-bright",
    },
    size: {
      xs: "px-[7px] py-[4px] text-[10px] leading-none [&_svg]:size-3",
      sm: "px-[9px] py-[5px] text-[10.5px] leading-none [&_svg]:size-3.5",
      md: "px-[11px] py-[7px] text-[11px] leading-none [&_svg]:size-4",
      icon: "size-5 p-0 [&_svg]:size-3.5",
    },
    mono: { true: "font-pk-mono", false: "" },
  },
  defaultVariants: { tone: "quiet", size: "sm", mono: false },
});

export type ButtonProps = Omit<ButtonPrimitive.Props, "className"> &
  VariantProps<typeof button> & { className?: string };

function Button({ tone, size, mono, className, ...props }: ButtonProps) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={button({ tone, size, mono, className })}
      {...props}
    />
  );
}

export { Button, button as buttonVariants };
