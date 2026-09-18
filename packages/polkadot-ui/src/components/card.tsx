import { useRender } from "@base-ui/react/use-render";
import type { Observable } from "@legendapp/state";
import { useObservable, useObserveEffect, useUnmount, useValue } from "@legendapp/state/react";
import { useMeasure } from "@legendapp/state/react-hooks/useMeasure";
import { createContext, useContext, useEffectEvent, useLayoutEffect, useRef } from "react";
import type { VariantProps } from "tailwind-variants";

import { tv } from "../tv.ts";
import { Row, type RowProps } from "./row.tsx";
import { Surface, type SurfaceProps } from "./surface.tsx";

const card = tv({
  base: "box-border flex min-w-0 flex-col gap-3",
  variants: {
    padding: {
      none: "[--pk-card-padding:0px] p-0",
      tight: "[--pk-card-padding:calc(var(--spacing)*4)] p-(--pk-card-padding)",
      default: "[--pk-card-padding:calc(var(--spacing)*5)] p-(--pk-card-padding)",
    },
    fill: { true: "h-full min-h-0 flex-auto overflow-hidden", false: "" },
    responsive: { true: "@max-[280px]:[--pk-card-padding:calc(var(--spacing)*3)]", false: "" },
  },
  defaultVariants: { padding: "default", fill: true, responsive: true },
});

type CardPart = "header" | "content" | "footer";
const CardSizeContext = createContext<Observable<Partial<Record<CardPart, number>>> | null>(null);

function useCardPartSize(part: CardPart) {
  const parts$ = useContext(CardSizeContext);
  const ref = useRef<HTMLDivElement>(null);
  const size$ = useMeasure(ref as Parameters<typeof useMeasure>[0]);
  useObserveEffect(() => {
    const height = size$.height.get();
    if (height !== undefined) parts$?.[part].set(height);
  }, [parts$, part]);
  useUnmount(() => parts$?.[part].delete());
  return ref;
}

export interface CardBodyProps extends useRender.ComponentProps<"div">, VariantProps<typeof card> {
  readonly onContentHeightChange?: (height: number) => void;
}

/** Content spacing for standalone cards and canvas frames. */
function CardBody({
  padding,
  fill,
  responsive,
  className,
  render,
  onContentHeightChange,
  ref,
  ...props
}: CardBodyProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const bodySize$ = useMeasure(bodyRef as Parameters<typeof useMeasure>[0]);
  const width = useValue(bodySize$.width);
  const parts$ = useObservable<Partial<Record<CardPart, number>>>({});
  const [headerHeight, contentHeight, footerHeight] = useValue(() => [
    parts$.header.get(),
    parts$.content.get(),
    parts$.footer.get(),
  ]);
  const reportsContentHeight = onContentHeightChange !== undefined;
  const reportContentHeight = useEffectEvent((height: number) => onContentHeightChange?.(height));
  useLayoutEffect(() => {
    if (!reportsContentHeight || bodyRef.current === null || contentHeight === undefined) return;
    const style = getComputedStyle(bodyRef.current);
    const heights = [headerHeight, contentHeight, footerHeight].filter(
      (height): height is number => height !== undefined,
    );
    const spacing = [
      style.paddingTop,
      style.paddingBottom,
      style.borderTopWidth,
      style.borderBottomWidth,
    ].reduce((sum, value) => sum + (Number.parseFloat(value) || 0), 0);
    const gap = Number.parseFloat(style.rowGap) || 0;
    reportContentHeight(
      Math.ceil(
        heights.reduce((sum, height) => sum + height, spacing) +
          gap * Math.max(0, heights.length - 1),
      ),
    );
  }, [contentHeight, footerHeight, headerHeight, reportsContentHeight, width]);
  const body = useRender({
    defaultTagName: "div",
    render,
    ref: [bodyRef, ref ?? null],
    props: {
      ...props,
      "data-slot": "card-body",
      className: card({ padding, fill, responsive, className }),
    },
  });
  return <CardSizeContext value={parts$}>{body}</CardSizeContext>;
}

const footer = tv({ base: "mt-auto" });
const content = tv({
  base: "flex min-h-0 min-w-0 flex-col gap-3",
  variants: {
    scrollable: { true: "flex-auto overflow-auto", false: "flex-none overflow-visible" },
  },
  defaultVariants: { scrollable: true },
});

function CardRoot({ padding = "none", container = true, ...props }: SurfaceProps) {
  return <Surface {...props} padding={padding} container={container} />;
}

export interface CardContentProps extends useRender.ComponentProps<"div"> {}

function CardContent({ className, render, ...props }: CardContentProps) {
  const ref = useCardPartSize("content");
  return useRender({
    defaultTagName: "div",
    render,
    props: {
      ...props,
      "data-slot": "card-content",
      className: content({ className }),
      children: (
        <div ref={ref} className={content({ scrollable: false })}>
          {props.children}
        </div>
      ),
    },
  });
}

function CardHeader({ ref, ...props }: RowProps) {
  const measureRef = useCardPartSize("header");
  return useRender({ render: <Row {...props} />, ref: [measureRef, ref ?? null] });
}

function CardFooter({ className, align = "baseline", ref, ...props }: RowProps) {
  const measureRef = useCardPartSize("footer");
  return useRender({
    render: <Row {...props} align={align} className={footer({ className })} />,
    ref: [measureRef, ref ?? null],
  });
}

export const Card = {
  Root: CardRoot,
  Body: CardBody,
  Header: CardHeader,
  Content: CardContent,
  Footer: CardFooter,
};
export {
  CardRoot,
  CardBody,
  CardHeader,
  CardContent,
  CardFooter,
  card as cardBodyVariants,
  content as cardContentVariants,
  footer as cardFooterVariants,
};
