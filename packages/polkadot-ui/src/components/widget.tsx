import { useRender } from "@base-ui/react/use-render";
import { tv, type VariantProps } from "tailwind-variants";

import { cn } from "../lib/cn.ts";

const widget = tv({
  slots: {
    root: "box-border flex h-full w-full flex-col overflow-hidden font-pk-sans text-pk-ink",
    header: "flex flex-none items-center justify-between gap-[10px]",
    /* Chrome labels are names, counts and states — read by recognition, not by sentence. */
    label: "font-pk-sans text-[11px] leading-none font-medium tracking-[0.02em] text-pk-ink-dim",
    title:
      "font-pk-sans text-[17px] leading-[1.15] font-semibold tracking-[-0.03em] text-pk-ink-bright",
    subtitle: "font-pk-sans text-[13px] leading-[1.5] text-pk-ink-soft text-pretty",
    meta: "font-pk-mono text-[11px] leading-[1.4] whitespace-nowrap text-pk-ink-faint",
    body: "flex min-h-0 flex-1 flex-col",
    footer:
      "flex flex-none items-center justify-between gap-[10px] border-t border-pk-line-inner pt-[11px]",
    badge:
      "inline-flex flex-none items-center rounded-pk-pill border border-pk-line px-[10px] py-[5px] font-pk-sans text-[11px] leading-none font-medium tracking-[0.02em] whitespace-nowrap text-pk-ink-dim",
  },
  variants: {
    tone: {
      card: { root: "rounded-pk-card border border-pk-line bg-pk-surface shadow-pk-card" },
      sunken: {
        root: "rounded-pk-widget border border-pk-line bg-pk-surface-sunken shadow-[var(--pk-lift-inset),var(--pk-lift-card)]",
      },
      deep: { root: "rounded-pk-card border border-pk-line bg-pk-surface-deep shadow-pk-card" },
      /* A specular conic edge that sweeps on hover. Two layers of background, so it is a class. */
      rim: { root: "pk-rim rounded-[18px]" },
      tile: { root: "pk-rim-tile rounded-pk-inner" },
      /* Not built yet, and saying so: a dashed edge reads as a placeholder, not a card. */
      pending: { root: "rounded-pk-card border border-dashed border-[#26302a] bg-[#0a0c0b]" },
      bare: {},
    },
    interactive: {
      true: {
        root: "transition-colors duration-(--pk-duration-hover) ease-pk-swift hover:border-pk-line-hover",
      },
      false: {},
    },
    padding: {
      none: {},
      tight: { root: "gap-2 p-4" },
      snug: { root: "gap-[10px] p-[18px]" },
      default: { root: "gap-3 p-5" },
      roomy: { root: "gap-[14px] p-[22px]" },
    },
    align: {
      start: { header: "items-start" },
      center: {},
      baseline: { header: "items-baseline" },
    },
  },
  defaultVariants: { tone: "card", interactive: true, padding: "default", align: "center" },
});

type WidgetVariants = VariantProps<typeof widget>;

/** Every part renders through `useRender`, so any of them accepts `render` to change its element. */
type PartProps<Tag extends keyof React.JSX.IntrinsicElements> = useRender.ComponentProps<Tag>;

const part = <Tag extends keyof React.JSX.IntrinsicElements>(
  defaultTagName: Tag,
  slot: string,
  slotClassName: string,
) =>
  function Part({ className, render, ...props }: PartProps<Tag>) {
    return useRender({
      render,
      defaultTagName,
      props: { ...props, "data-slot": slot, className: cn(slotClassName, className as string) },
    });
  };

export interface WidgetProps extends useRender.ComponentProps<"div">, WidgetVariants {}

function Widget({ tone, interactive, padding, align, className, render, ...props }: WidgetProps) {
  const styles = widget({ tone, interactive, padding, align });
  return useRender({
    render,
    defaultTagName: "div",
    props: { ...props, "data-slot": "widget", className: cn(styles.root(), className as string) },
  });
}

const styles = widget();

const WidgetHeader = part("div", "widget-header", styles.header());
const WidgetLabel = part("span", "widget-label", styles.label());
const WidgetTitle = part("span", "widget-title", styles.title());
const WidgetSubtitle = part("p", "widget-subtitle", styles.subtitle());
const WidgetMeta = part("span", "widget-meta", styles.meta());
const WidgetBadge = part("span", "widget-badge", styles.badge());
const WidgetBody = part("div", "widget-body", styles.body());
const WidgetFooter = part("div", "widget-footer", styles.footer());

Widget.Header = WidgetHeader;
Widget.Label = WidgetLabel;
Widget.Title = WidgetTitle;
Widget.Subtitle = WidgetSubtitle;
Widget.Meta = WidgetMeta;
Widget.Badge = WidgetBadge;
Widget.Body = WidgetBody;
Widget.Footer = WidgetFooter;

export {
  Widget,
  WidgetBadge,
  WidgetBody,
  WidgetFooter,
  WidgetHeader,
  WidgetLabel,
  WidgetMeta,
  WidgetSubtitle,
  WidgetTitle,
  widget as widgetVariants,
};
