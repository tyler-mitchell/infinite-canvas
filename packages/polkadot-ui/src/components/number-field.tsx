import { NumberField as NumberFieldPrimitive } from "@base-ui/react/number-field";
import type { VariantProps } from "tailwind-variants";

import { tv } from "../tv.ts";
import { buttonVariants } from "./button.tsx";
import { inputVariants } from "./input.tsx";

/*
 * Only what a number field adds. The group is laid over the input's look and the steps over a
 * ghost icon button, so the field matches every other field and the steps match every other button.
 */
const numberField = tv({
  slots: {
    root: "flex min-w-0 flex-col gap-1.5",
    /* The whole field is one box, so the padding moves off the group and onto the input inside. */
    group: "inline-flex items-center px-0",
    step: "rounded-none text-pk-ink-faint hover:text-pk-ink-bright",
    input:
      "h-full w-full min-w-0 bg-transparent px-1 text-center font-pk-mono text-pk-mono tabular-nums text-pk-ink outline-none",
    scrub: "w-fit cursor-ew-resize select-none",
    /* The colour comes from here rather than from the mark, the way every other mark is coloured. */
    cursor: "text-pk-knob",
  },
});

type WithClassName<T> = Omit<T, "className"> & { className?: string };

export type NumberFieldProps = WithClassName<NumberFieldPrimitive.Root.Props>;

/**
 * A number with a step either side, and a label you can drag.
 *
 * It draws no words of its own, so it takes its name from a `Field` around it, the same way the
 * checkbox, the radio group, the input, the select and the combobox do.
 */
function NumberField({ className, ...props }: NumberFieldProps) {
  return (
    <NumberFieldPrimitive.Root
      data-slot="number-field"
      className={numberField().root({ className })}
      {...props}
    />
  );
}

export type NumberFieldScrubProps = WithClassName<NumberFieldPrimitive.ScrubArea.Props>;

/**
 * Wraps whatever names the field and makes it a handle: dragging sideways changes the value, which
 * is how a canvas asks for a width without anyone typing one.
 */
function NumberFieldScrub({ className, children, ...props }: NumberFieldScrubProps) {
  const styles = numberField();

  return (
    <NumberFieldPrimitive.ScrubArea
      data-slot="number-field-scrub"
      className={styles.scrub({ className })}
      {...props}
    >
      {children}
      <NumberFieldPrimitive.ScrubAreaCursor className={styles.cursor()}>
        <svg width="26" height="14" viewBox="0 0 26 14" fill="none" aria-hidden="true">
          <path
            d="M6 4 2 7l4 3M20 4l4 3-4 3M2 7h22"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </NumberFieldPrimitive.ScrubAreaCursor>
    </NumberFieldPrimitive.ScrubArea>
  );
}

export type NumberFieldGroupProps = WithClassName<NumberFieldPrimitive.Group.Props> &
  VariantProps<typeof inputVariants>;

/** Base UI's Group, Decrement, Input and Increment as one part, the way the menu collapses three. */
function NumberFieldGroup({ tone, className, ...props }: NumberFieldGroupProps) {
  const styles = numberField();
  const step = buttonVariants({ tone: "ghost", size: "icon", className: styles.step() });

  return (
    <NumberFieldPrimitive.Group
      data-slot="number-field-group"
      className={inputVariants({ tone, className: styles.group({ className }) })}
      {...props}
    >
      <NumberFieldPrimitive.Decrement data-slot="number-field-step" className={step}>
        <svg viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="M3 6h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </NumberFieldPrimitive.Decrement>
      <NumberFieldPrimitive.Input data-slot="number-field-input" className={styles.input()} />
      <NumberFieldPrimitive.Increment data-slot="number-field-step" className={step}>
        <svg viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="M6 3v6M3 6h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </NumberFieldPrimitive.Increment>
    </NumberFieldPrimitive.Group>
  );
}

NumberField.Scrub = NumberFieldScrub;
NumberField.Group = NumberFieldGroup;

export { NumberField, NumberFieldGroup, NumberFieldScrub, numberField as numberFieldVariants };
