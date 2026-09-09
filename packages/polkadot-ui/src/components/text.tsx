import { useRender } from "@base-ui/react/use-render";
import type { VariantProps } from "tailwind-variants";

import { tv } from "../tv.ts";

const text = tv({
  base: "",
  variants: {
    as: {
      label: "font-pk-sans text-pk-label text-pk-ink-dim",
      kind: "font-pk-sans text-pk-micro text-pk-ink-dim uppercase",
      meta: "font-pk-sans text-pk-meta text-pk-ink-faint",
      title: "font-pk-sans text-pk-title text-pk-ink-bright",
      display: "font-pk-sans text-pk-display text-pk-ink-bright",
      prose: "font-pk-sans text-pk-body text-pk-ink-soft text-pretty",
      readout: "font-pk-mono text-pk-mono whitespace-nowrap text-pk-ink-muted tabular-nums",
    },
  },
  defaultVariants: { as: "meta" },
});

type Role = NonNullable<VariantProps<typeof text>["as"]>;

export interface TextProps extends useRender.ComponentProps<"span">, VariantProps<typeof text> {}

const role = (name: Role, tag: keyof React.JSX.IntrinsicElements) =>
  function Part({ className, render, ...props }: useRender.ComponentProps<"span">) {
    return useRender({
      render,
      defaultTagName: tag,
      props: {
        ...props,
        "data-slot": `text-${name}`,
        className: text({ as: name, className: className as string }),
      },
    });
  };

const Label = role("label", "span");
const Kind = role("kind", "span");
const Meta = role("meta", "span");
const Title = role("title", "span");
const Display = role("display", "h1");
const Prose = role("prose", "p");

export type ReadoutProps = useRender.ComponentProps<"span">;

/** Announces, so a value that updates without a layout change still reaches a screen reader. */
function Readout({ className, render, ...props }: ReadoutProps) {
  return useRender({
    render,
    defaultTagName: "span",
    props: {
      role: "status",
      "aria-live": "polite",
      ...props,
      "data-slot": "text-readout",
      className: text({ as: "readout", className: className as string }),
    },
  });
}

export { Display, Kind, Label, Meta, Prose, Readout, Title, text as textVariants };
