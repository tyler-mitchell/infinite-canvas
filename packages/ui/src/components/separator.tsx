import { Separator as SeparatorPrimitive } from "@base-ui/react/separator";
import { tv } from "tailwind-variants";

import { cn } from "../lib/utils";

const separator = tv({
  base: "shrink-0 bg-border data-horizontal:h-px data-horizontal:w-full data-vertical:w-px data-vertical:self-stretch",
});

function Separator({ className, orientation = "horizontal", ...props }: SeparatorPrimitive.Props) {
  return (
    <SeparatorPrimitive
      data-slot="separator"
      orientation={orientation}
      className={cn(separator(), className)}
      {...props}
    />
  );
}

export { Separator };
