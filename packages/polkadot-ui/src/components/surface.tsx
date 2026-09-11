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
      rim: "pk-rim rounded-pk-card [--pk-ring-seat:var(--pk-surface)]",
      tile: "pk-rim-tile rounded-pk-inner [--pk-ring-seat:var(--pk-surface)]",
      pending:
        "rounded-pk-card border border-dashed border-pk-pending-line bg-pk-pending-surface hover:border-pk-pending-line-hover [--pk-ring-seat:var(--pk-pending-surface)]",
      bare: "",
    },
    /*
     * The hover belongs to the tones that draw a hairline, not to this variant. A rim draws its
     * border as 2px of transparent with a conic gradient showing through, and the sheet spins that
     * gradient on hover. Lifting the hairline colour here painted an opaque border over it, so the
     * one tone with an animated edge was the one that lost its edge the moment it was hovered.
     */
    interactive: {
      true: "transition-colors duration-(--pk-duration-hover) ease-pk-swift",
      false: "",
    },
    padding: {
      none: "",
      tight: "gap-2.5 p-4",
      snug: "gap-2.5 p-4.5",
      default: "gap-2.5 p-5",
      roomy: "gap-3.5 p-5.5",
    },
  },
  compoundVariants: [
    { tone: "card", interactive: true, class: "hover:border-pk-line-hover" },
    { tone: "sunken", interactive: true, class: "hover:border-pk-line-hover" },
    { tone: "deep", interactive: true, class: "hover:border-pk-line-hover" },
  ],
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
