import { useRender } from "@base-ui/react/use-render";
import type { VariantProps } from "tailwind-variants";

import { tv } from "../tv.ts";
import { Row, type RowProps } from "./row.tsx";
import { Surface } from "./surface.tsx";

const card = tv({
  base: "box-border flex min-w-0 flex-col gap-3",
  variants: {
    padding: {
      none: "[--pk-card-padding:0px]",
      tight: "[--pk-card-padding:calc(var(--spacing)*4)] p-(--pk-card-padding)",
      default: "[--pk-card-padding:calc(var(--spacing)*5)] p-(--pk-card-padding)",
    },
    fill: { true: "min-h-full flex-1", false: "" },
    responsive: { true: "@max-[280px]:[--pk-card-padding:calc(var(--spacing)*3)]", false: "" },
  },
  defaultVariants: { padding: "default", fill: true, responsive: true },
});

export interface CardBodyProps extends useRender.ComponentProps<"div">, VariantProps<typeof card> {}

/** Content spacing for standalone cards and canvas frames. */
function CardBody({ padding, fill, responsive, className, render, ...props }: CardBodyProps) {
  return useRender({
    defaultTagName: "div",
    render,
    props: {
      ...props,
      "data-slot": "card-body",
      className: card({ padding, fill, responsive, className }),
    },
  });
}

const footer = tv({ base: "mt-auto" });

function CardFooter({ className, ...props }: RowProps) {
  return <Row {...props} className={footer({ className })} />;
}

export const Card = { Root: Surface, Body: CardBody, Header: Row, Footer: CardFooter };
export { CardBody, CardFooter, card as cardBodyVariants, footer as cardFooterVariants };
