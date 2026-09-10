import { useRender } from "@base-ui/react/use-render";
import type { VariantProps } from "tailwind-variants";

import { tv } from "../tv.ts";

const text = tv({
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

/** Names a section: `frame budget`, `inbox`. A `span`. */
const Label = role("label", "span");

/** Tags what a thing is: `gist`, `issue`. A `span`. */
const Kind = role("kind", "span");

/** The through-line, and the role most of a widget's chrome is made of. A `span`. */
const Meta = role("meta", "span");

/** Names a widget once. A `span`, because a card's name is not the document's heading. */
const Title = role("title", "span");

/**
 * The page naming itself, so it renders an `h1`. Reach for it as a size and you will emit a second
 * top-level heading — pass `render={<span />}` where the text is not what the page is about.
 */
const Display = role("display", "h1");

/** A sentence meant to be read rather than scanned. A `p`, and the only role with a measure. */
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
