import { useRender } from "@base-ui/react/use-render";
import { tv, type VariantProps } from "tailwind-variants";

/**
 * The type scale, as roles rather than sizes.
 *
 * Sans carries the interface. Mono is reserved for a value that is read as data — a frame time, a
 * price, a hovered count — and `readout` is the only role that uses it. Descriptive text beside a
 * heading is interface, not data, so `meta` is sans.
 *
 * `label` and `kind` are two registers that never substitute: a label names a section
 * ("frame budget", "inbox"), a kind tags what a thing is ("gist", "issue"). Both are sans; they
 * differ in size, tracking and case.
 */
const text = tv({
  base: "",
  variants: {
    as: {
      label: "font-pk-sans text-pk-label text-pk-ink-dim",
      /* A kind names what a thing is, so it is a label in sans, not a value in mono. */
      kind: "font-pk-sans text-pk-micro text-pk-ink-dim uppercase",
      meta: "font-pk-sans text-pk-meta text-pk-ink-faint",
      title: "font-pk-sans text-pk-head text-pk-ink-bright",
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
const Prose = role("prose", "p");

export type ReadoutProps = useRender.ComponentProps<"span">;

/**
 * A value that changes while you are looking at it — a frame time, a hovered day, a chart head.
 *
 * The only part of the scale that is more than a class: it announces, so a value that updates
 * without a layout change is still reachable by someone who cannot see it change.
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

export { Kind, Label, Meta, Prose, Readout, Title, text as textVariants };
