import { Separator as SeparatorPrimitive } from "@base-ui/react/separator";
import { tv } from "../tv.ts";

const separator = tv({
  base: "flex-none bg-pk-line-inner",
  variants: {
    orientation: {
      horizontal: "h-px w-full",
      vertical: "min-h-[1em] w-px self-stretch",
    },
  },
  defaultVariants: { orientation: "horizontal" },
});

export type SeparatorProps = Omit<SeparatorPrimitive.Props, "className"> & { className?: string };

function Separator({ orientation = "horizontal", className, ...props }: SeparatorProps) {
  return (
    <SeparatorPrimitive
      data-slot="separator"
      orientation={orientation}
      className={separator({ orientation, className })}
      {...props}
    />
  );
}

export { Separator, separator as separatorVariants };
