import { useRender } from "@base-ui/react/use-render";
import type { VariantProps } from "tailwind-variants";

import { tv } from "../tv.ts";

const surface = tv({
  base: "box-border flex min-h-0 flex-col overflow-hidden font-pk-sans text-pk-ink",
  variants: {
    tone: {
      card: "rounded-pk-card border border-pk-line bg-pk-surface shadow-pk-card [--pk-ring-seat:var(--pk-surface)]",
      sunken:
        "rounded-pk-widget border border-pk-line bg-pk-surface-sunken shadow-[var(--pk-lift-inset),var(--pk-lift-card)] [--pk-ring-seat:var(--pk-surface-sunken)]",
      deep: "rounded-pk-card border border-pk-line bg-pk-surface-deep shadow-pk-card [--pk-ring-seat:var(--pk-surface-deep)]",
      rim: "pk-rim rounded-[18px] [--pk-ring-seat:var(--pk-surface)]",
      tile: "pk-rim-tile rounded-pk-inner [--pk-ring-seat:var(--pk-surface)]",
      pending:
        "rounded-pk-card border border-dashed border-pk-pending-line bg-pk-pending-surface hover:border-pk-pending-line-hover [--pk-ring-seat:var(--pk-pending-surface)]",
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

/**
 * The frame: tone, padding, radius, lift and hairline. It has no opinion about its contents, so a
 * card, a well and a sheet of paper are the same component wearing a different tone.
 */
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
