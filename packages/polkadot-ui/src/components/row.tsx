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
  /*
   * Wraps once the two ends stop fitting. Metadata is set `nowrap` because it is short by nature,
   * so a Row that cannot wrap pushes its right end straight out of whatever contains it — which in
   * a Surface means the text is clipped, and on a page means it leaves the column entirely.
   * Nothing moves while both ends fit.
   */
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
