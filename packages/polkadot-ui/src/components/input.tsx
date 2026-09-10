import { Input as InputPrimitive } from "@base-ui/react/input";
import type { VariantProps } from "tailwind-variants";

import { tv } from "../tv.ts";

const input = tv({
  base: "h-7 w-full min-w-0 rounded-pk-control border border-transparent px-3 font-pk-sans text-pk-control text-pk-ink outline-none transition-[color,background-color,border-color] duration-(--pk-duration-hover) ease-pk-swift placeholder:text-pk-ink-faint focus-visible:ring-2 focus-visible:ring-pk-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-(color:--pk-ring-seat) data-disabled:pointer-events-none data-disabled:opacity-40",
  variants: {
    tone: {
      soft: "bg-pk-ink/[0.06] hover:bg-pk-ink/[0.1]",
      outline: "border-pk-line hover:border-pk-line-strong",
    },
  },
  defaultVariants: { tone: "soft" },
});

export type InputProps = Omit<InputPrimitive.Props, "className"> &
  VariantProps<typeof input> & { className?: string };

/**
 * The same height and padding as a medium button, so the two line up in a row.
 *
 * It draws no words of its own, so it takes its name from a `Field` around it. A placeholder is
 * not a name: it disappears the moment anything is typed, and a reader who cannot see the field
 * hears nothing at all.
 */
function Input({ tone, className, ...props }: InputProps) {
  return <InputPrimitive data-slot="input" className={input({ tone, className })} {...props} />;
}

export { Input, input as inputVariants };
