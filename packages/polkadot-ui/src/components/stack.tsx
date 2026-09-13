import { useRender } from "@base-ui/react/use-render";
import type { VariantProps } from "tailwind-variants";

import { tv } from "../tv.ts";

const stack = tv({
  base: "flex min-w-0 flex-col",
  variants: {
    grow: { true: "flex-1", false: "" },
    gap: { none: "gap-0", xs: "gap-1", sm: "gap-2", md: "gap-3", lg: "gap-4" },
  },
  defaultVariants: { gap: "md" },
});

export interface StackProps extends useRender.ComponentProps<"div">, VariantProps<typeof stack> {
  readonly minHeight?: React.CSSProperties["minHeight"];
}

/** A vertical group with shared spacing. */
function Stack({ gap, grow, minHeight, style, className, render, ...props }: StackProps) {
  return useRender({
    defaultTagName: "div",
    render,
    props: {
      ...props,
      "data-slot": "stack",
      style: { ...style, minHeight: minHeight ?? style?.minHeight },
      className: stack({ gap, grow, className }),
    },
  });
}

export { Stack, stack as stackVariants };
