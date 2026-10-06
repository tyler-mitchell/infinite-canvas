import { useRender } from "@base-ui/react/use-render";
import type { VariantProps } from "tailwind-variants";

import { tv } from "../tv.ts";

/**
 * `wrap-anywhere` sits on each role that wraps rather than on the base. On the base it reached the
 * readout as well, which says `whitespace-nowrap`: the two are opposite instructions, and the
 * browser resolves it silently in favour of the nowrap. Every rule here reads slot strings one at a
 * time and none of them could see it, because neither string says both — the contradiction only
 * exists once `tv` has composed them.
 */
const text = tv({
  variants: {
    fluid: { true: "", false: "" },
    lines: { 1: "line-clamp-1", 2: "line-clamp-2", 3: "line-clamp-3" },
    size: {
      sm: "text-pk-mono-sm",
      md: "",
      lg: "text-[20px] leading-[1.4] tracking-[-0.03em] text-pk-ink-bright",
    },
    as: {
      label: "wrap-anywhere font-pk-sans text-pk-label text-pk-ink-dim",
      kind: "wrap-anywhere font-pk-sans text-pk-micro text-pk-ink-dim",
      meta: "wrap-anywhere font-pk-sans text-pk-meta text-pk-ink-faint",
      title: "wrap-anywhere font-pk-sans text-pk-title text-pk-ink-bright",
      display: "wrap-anywhere font-pk-sans text-pk-display text-pk-ink-bright",
      prose: "wrap-anywhere font-pk-sans text-pk-body text-pk-ink-soft text-pretty",
      readout: "font-pk-mono text-pk-mono whitespace-nowrap text-pk-ink-muted tabular-nums",
      code: "wrap-anywhere font-pk-mono text-pk-mono text-pk-ink-muted tabular-nums",
    },
  },
  compoundVariants: [
    {
      as: "display",
      fluid: true,
      class: "text-[length:clamp(var(--text-pk-title),6cqi,var(--text-pk-display))]",
    },
  ],
  defaultVariants: { as: "meta", fluid: false },
});

type Role = NonNullable<VariantProps<typeof text>["as"]>;

export interface TextProps extends useRender.ComponentProps<"span">, VariantProps<typeof text> {}

const role = (name: Role, tag: keyof React.JSX.IntrinsicElements, slot: string = name) =>
  function Part({
    className,
    render,
    lines,
    fluid,
    ...props
  }: useRender.ComponentProps<"span"> & Pick<VariantProps<typeof text>, "lines" | "fluid">) {
    return useRender({
      render,
      defaultTagName: tag,
      props: {
        ...props,
        "data-slot": `text-${slot}`,
        className: text({ as: name, lines, fluid, className }),
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
      className: text({ as: "readout", className }),
    },
  });
}

export type TimeProps = useRender.ComponentProps<"time"> & Pick<VariantProps<typeof text>, "size">;

/** A semantic time value without automatic announcements. */
function Time({ className, render, size, ...props }: TimeProps) {
  return useRender({
    defaultTagName: "time",
    render,
    props: { ...props, "data-slot": "time", className: text({ as: "readout", size, className }) },
  });
}

export { Code, Display, Kind, Label, Meta, Prose, Readout, Time, Title, text as textVariants };
