import { useRender } from "@base-ui/react/use-render";
import { tv, type VariantProps } from "tailwind-variants";

/**
 * The type scale, as roles rather than sizes.
 *
 * Counted across the design POC's 45 widgets: mono metadata appears 49 times — more than any
 * container and more than once per widget. That density is the design language, so `meta` is the
 * default rather than an option.
 *
 * `label` and `kind` are two registers that never substitute: a label names a section
 * ("frame budget", "inbox"), a kind tags what a thing is ("gist", "issue"). They differ in face,
 * size, tracking and case.
 */
const text = tv({
  base: "",
  variants: {
    as: {
      label: "font-pk-sans text-[11px] leading-none font-medium tracking-[0.02em] text-pk-ink-dim",
      kind: "font-pk-mono text-[10px] leading-none font-medium tracking-[0.05em] text-pk-ink-dim uppercase",
      meta: "font-pk-mono text-[11px] leading-[1.4] whitespace-nowrap text-pk-ink-faint",
      title:
        "font-pk-sans text-[17px] leading-[1.15] font-semibold tracking-[-0.03em] text-pk-ink-bright",
      prose: "font-pk-sans text-[13px] leading-[1.5] text-pk-ink-soft text-pretty",
      readout: "font-pk-mono text-[11px] leading-[1.4] whitespace-nowrap text-pk-ink-muted",
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
