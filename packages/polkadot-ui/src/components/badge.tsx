import { useRender } from "@base-ui/react/use-render";
import { tv, type VariantProps } from "tailwind-variants";

/*
 * The small standing label a card wears: a visibility, a licence, a language, a status.
 *
 * Two registers, because the design uses both and they do not substitute. `tag` is a name in
 * sentence case, so it reads as a word. `label` is a state in caps with wide tracking, so it reads
 * as a stamp and stays legible at nine and a half pixels.
 */
const badge = tv({
  base: "inline-flex flex-none items-center gap-1 rounded-pk-pill border border-transparent px-2 py-[3px] font-pk-sans whitespace-nowrap",
  variants: {
    tone: {
      neutral: "bg-pk-ink/[0.06] text-pk-ink-dim",
      accent: "bg-pk-accent text-pk-on-accent",
      outline: "border-pk-line text-pk-ink-dim",
      quiet: "px-0 text-pk-ink-faint",
    },
    look: {
      tag: "text-pk-label",
      label: "text-pk-micro uppercase",
    },
  },
  defaultVariants: { tone: "neutral", look: "tag" },
});

export interface BadgeProps extends useRender.ComponentProps<"span">, VariantProps<typeof badge> {}

function Badge({ tone, look, className, render, ...props }: BadgeProps) {
  return useRender({
    render,
    defaultTagName: "span",
    props: {
      ...props,
      "data-slot": "badge",
      className: badge({ tone, look, className: className as string }),
    },
  });
}

export { Badge, badge as badgeVariants };
