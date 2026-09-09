import { useRender } from "@base-ui/react/use-render";
import { tv, type VariantProps } from "tailwind-variants";

/**
 * A two-end line: something naming on the left, something reporting on the right.
 *
 * Not `Header`. Several widgets in the design put their naming line at the bottom and the printer
 * has two, so calling this a header would assert a document structure the design does not have.
 * Whether a given Row is a header is the consumer's business.
 */
const row = tv({
  base: "flex flex-none gap-[10px]",
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
    /* A rule above the row, which is how the design closes a widget rather than opens one. */
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
