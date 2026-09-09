import { useRender } from "@base-ui/react/use-render";
import type { VariantProps } from "tailwind-variants";

import { tv } from "../tv.ts";

const row = tv({
  base: "flex flex-none flex-wrap gap-[10px]",
  variants: {
    align: {
      baseline: "items-baseline",
      center: "items-center",
      start: "items-start",
    },
    justify: {
      between: "justify-between",
      start: "justify-start",
      end: "justify-end",
    },
    rule: {
      none: "",
      above: "border-t border-pk-line-inner pt-[11px]",
      below: "border-b border-pk-line-inner pb-[11px]",
    },
  },
  defaultVariants: { align: "center", justify: "between", rule: "none" },
});

export interface RowProps extends useRender.ComponentProps<"div">, VariantProps<typeof row> {}

function Row({ align, justify, rule, className, render, ...props }: RowProps) {
  return useRender({
    render,
    defaultTagName: "div",
    props: {
      ...props,
      "data-slot": "row",
      className: row({ align, justify, rule, className: className as string }),
    },
  });
}

export { Row, row as rowVariants };
