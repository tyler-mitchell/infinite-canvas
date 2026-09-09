import { useRender } from "@base-ui/react/use-render";
import type { VariantProps } from "tailwind-variants";

import { tv } from "../tv.ts";

const surface = tv({
  base: "box-border flex min-h-0 flex-col overflow-hidden font-pk-sans text-pk-ink",
  variants: {
    tone: {
      card: "rounded-pk-card border border-pk-line bg-pk-surface shadow-pk-card",
      sunken:
        "rounded-pk-widget border border-pk-line bg-pk-surface-sunken shadow-[var(--pk-lift-inset),var(--pk-lift-card)]",
      deep: "rounded-pk-card border border-pk-line bg-pk-surface-deep shadow-pk-card",
      rim: "pk-rim rounded-[18px]",
      tile: "pk-rim-tile rounded-pk-inner",
      pending: "rounded-pk-card border border-dashed border-pk-accent/25 bg-pk-accent/[0.02]",
      bare: "",
    },
    interactive: {
      true: "transition-colors duration-(--pk-duration-hover) ease-pk-swift hover:border-pk-line-hover",
      false: "",
    },
    padding: {
      none: "",
      tight: "gap-[10px] p-4",
      snug: "gap-[10px] p-[18px]",
      default: "gap-[10px] p-5",
      roomy: "gap-[14px] p-[22px]",
    },
  },
  defaultVariants: { tone: "card", interactive: true, padding: "default" },
});

export interface SurfaceProps
  extends useRender.ComponentProps<"div">, VariantProps<typeof surface> {}

function Surface({ tone, interactive, padding, className, render, ...props }: SurfaceProps) {
  return useRender({
    render,
    defaultTagName: "div",
    props: {
      ...props,
      "data-slot": "surface",
      className: surface({ tone, interactive, padding, className: className as string }),
    },
  });
}

export { Surface, surface as surfaceVariants };
