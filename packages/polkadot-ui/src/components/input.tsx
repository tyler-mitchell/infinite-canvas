import { Input as InputPrimitive } from "@base-ui/react/input";
import type { VariantProps } from "tailwind-variants";

import { tv } from "../tv.ts";

/**
 * The placeholder takes the dim ink rather than the faint one, and the soft tone answers a pointer
 * on its edge rather than by lightening its fill. Both come from the same measurement: a fill is a
 * ground of its own, and the faint ink is the floor on a surface — over a fill that lightens that
 * surface it falls under 4.5:1, which the combobox placeholder read at 4.40 inside a card.
 */
const input = tv({
  base: "h-7 w-full min-w-0 rounded-pk-control border border-transparent px-3 font-pk-sans text-pk-control text-pk-ink outline-none transition-[color,background-color,border-color] duration-(--pk-duration-hover) ease-pk-swift placeholder:text-pk-ink-dim focus-visible:ring-2 focus-visible:ring-pk-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-(color:--pk-ring-seat) data-disabled:pointer-events-none data-disabled:opacity-40",
  variants: {
    tone: {
      soft: "bg-pk-ink/[0.06] hover:border-pk-line",
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
