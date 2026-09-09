import { Separator as SeparatorPrimitive } from "@base-ui/react/separator";
import { tv } from "tailwind-variants";

import { stateSlotClass } from "../lib/slot-class.ts";

const separator = tv({
  base: "flex-none bg-pk-line-inner",
  variants: {
    orientation: {
      horizontal: "h-px w-full",
      vertical: "h-full w-px",
    },
  },
  defaultVariants: { orientation: "horizontal" },
});

export type SeparatorProps = SeparatorPrimitive.Props;

function Separator({ className, ...props }: SeparatorProps) {
  return (
    <SeparatorPrimitive
      data-slot="separator"
      className={stateSlotClass(
        (state: SeparatorPrimitive.State) => separator({ orientation: state.orientation }),
        className,
      )}
      {...props}
    />
  );
}

export { Separator, separator as separatorVariants };
