import { Separator as SeparatorPrimitive } from "@base-ui/react/separator";
import type { VariantProps } from "tailwind-variants";
import { tv } from "../tv.ts";

const separator = tv({
  base: "flex-none",
  variants: {
    look: {
      line: "bg-pk-line-inner",
      engraved: "pk-divider-engraved",
    },
    orientation: {
      horizontal: "h-px w-full",
      vertical: "min-h-[1em] w-px self-stretch",
    },
  },
  compoundVariants: [
    {
      look: "engraved",
      orientation: "horizontal",
      class: "h-(--pk-divider-depth)",
    },
    {
      look: "engraved",
      orientation: "vertical",
      class: "w-(--pk-divider-depth) [--pk-divider-angle:90deg]",
    },
  ],
  defaultVariants: { look: "line", orientation: "horizontal" },
});

export type SeparatorProps = Omit<SeparatorPrimitive.Props, "className"> &
  Pick<VariantProps<typeof separator>, "look"> & { className?: string };

function Separator({ orientation = "horizontal", look, className, ...props }: SeparatorProps) {
  return (
    <SeparatorPrimitive
      data-slot="separator"
      orientation={orientation}
      className={separator({ orientation, look, className })}
      {...props}
    />
  );
}

export { Separator, separator as separatorVariants };
