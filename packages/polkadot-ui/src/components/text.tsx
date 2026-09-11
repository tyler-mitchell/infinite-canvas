import { useRender } from "@base-ui/react/use-render";
import type { VariantProps } from "tailwind-variants";

import { tv } from "../tv.ts";

const text = tv({
  base: "wrap-anywhere",
  variants: {
    as: {
      label: "font-pk-sans text-pk-label text-pk-ink-dim",
      kind: "font-pk-sans text-pk-micro text-pk-ink-dim uppercase",
      meta: "font-pk-sans text-pk-meta text-pk-ink-faint",
      title: "font-pk-sans text-pk-title text-pk-ink-bright",
      display: "font-pk-sans text-pk-display text-pk-ink-bright",
      prose: "font-pk-sans text-pk-body text-pk-ink-soft text-pretty",
      readout: "font-pk-mono text-pk-mono whitespace-nowrap text-pk-ink-muted tabular-nums",
      code: "font-pk-mono text-pk-mono text-pk-ink-muted tabular-nums",
    },
  },
  defaultVariants: { as: "meta" },
});

type Role = NonNullable<VariantProps<typeof text>["as"]>;

export interface TextProps extends useRender.ComponentProps<"span">, VariantProps<typeof text> {}

const role = (name: Role, tag: keyof React.JSX.IntrinsicElements, slot: string = name) =>
  function Part({ className, render, ...props }: useRender.ComponentProps<"span">) {
    return useRender({
      render,
      defaultTagName: tag,
      props: {
        ...props,
        "data-slot": `text-${slot}`,
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

/**
 * A name from the code inside a sentence: a component, a prop, a state. A `code`, and the readout's
 * look without its voice.
 *
 * `Readout` is a live region, which is right for a figure that changes in place and wrong for a
 * word in a paragraph. One page marked seven terms with it and gave a reader seven regions that
 * announce "Field" and never change.
 *
 * It has its own role rather than borrowing the readout's, because the readout stays on one line —
 * a figure broken in two reads as two figures — and a term sitting in a sentence must not. Sharing
 * the one role gave a long name nowhere to break and pushed the page 206px wider than the screen.
 */
const Code = role("code", "code");

export type ReadoutProps = useRender.ComponentProps<"span">;

/**
 * Announces, so a value that updates without a layout change still reaches a screen reader. For a
 * term in a sentence, which never updates, reach for `Code` instead.
 *
 * `render` composes this onto something else — a `NumberTicker` is drawn this way, and needs to be,
 * since on its own it replaces its figure in silence. A picture is the case that does not work: a
 * chart already carries `role="img"` and a name read from its own values, and this carries
 * `role="status"`. One element cannot be both, and the status wins, so the chart stops being a
 * picture. Put a reading beside a live chart rather than wrapping the chart in one.
 */
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

export { Code, Display, Kind, Label, Meta, Prose, Readout, Title, text as textVariants };
