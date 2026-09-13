import { useRender } from "@base-ui/react/use-render";
import type { VariantProps } from "tailwind-variants";

import { tv } from "../tv.ts";

const row = tv({
  base: "flex min-w-0 flex-none flex-wrap gap-x-3 gap-y-1.5",
  variants: {
    gap: {
      none: "gap-0",
      xs: "gap-1",
      sm: "gap-x-2 gap-y-1",
      md: "gap-x-3 gap-y-1.5",
      lg: "gap-x-4 gap-y-2",
      xl: "gap-5",
    },
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
    ruleLook: {
      line: "",
      engraved: "",
    },
  },
  compoundVariants: [
    {
      rule: "above",
      ruleLook: "engraved",
      class: "pk-rule-engraved-above border-t-transparent",
    },
    {
      rule: "below",
      ruleLook: "engraved",
      class: "pk-rule-engraved-below border-b-transparent",
    },
  ],
  defaultVariants: { align: "center", justify: "between", rule: "none", ruleLook: "line" },
});

export interface RowProps extends useRender.ComponentProps<"div">, VariantProps<typeof row> {}

/** A wrapping row with optional dividers. */
function Row({ align, justify, rule, ruleLook, gap, className, render, ...props }: RowProps) {
  return useRender({
    render,
    defaultTagName: "div",
    props: {
      ...props,
      "data-slot": "row",
      className: row({ align, justify, rule, ruleLook, gap, className }),
    },
  });
}

export { Row, row as rowVariants };
