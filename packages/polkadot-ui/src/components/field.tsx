import { Field as FieldPrimitive } from "@base-ui/react/field";
import type { VariantProps } from "tailwind-variants";

import { tv } from "../tv.ts";
import { textVariants } from "./text.tsx";

const field = tv({
  slots: {
    root: "flex min-w-0",
    label: "cursor-pointer select-none data-disabled:cursor-default data-disabled:opacity-40",
  },
  variants: {
    layout: {
      inline: { root: "flex-row items-center gap-2.5" },
      stacked: { root: "flex-col gap-1.5" },
    },
  },
  defaultVariants: { layout: "inline" },
});

export interface FieldProps
  extends Omit<FieldPrimitive.Root.Props, "className">, VariantProps<typeof field> {
  readonly className?: string;
}

/**
 * Pairs a control with the words that name it. Base UI associates the two, so a switch that reads
 * as `switch, off` on its own reads as `sound, switch, off` inside one.
 *
 * Only the grouping and the label are here. Base UI's Field also carries validation, description
 * and error parts, which this kit has no use for until it has a form.
 */
function Field({ layout, className, ...props }: FieldProps) {
  return (
    <FieldPrimitive.Root
      data-slot="field"
      className={field({ layout }).root({ className })}
      {...props}
    />
  );
}

export type FieldLabelProps = Omit<FieldPrimitive.Label.Props, "className"> & {
  readonly className?: string;
};

/**
 * The control's name, in the same voice as a `Label`. It renders a real `label`, so pointing at
 * the words works the control.
 */
function FieldLabel({ className, ...props }: FieldLabelProps) {
  const styles = field();

  return (
    <FieldPrimitive.Label
      data-slot="field-label"
      className={textVariants({
        as: "label",
        className: styles.label({ className }),
      })}
      {...props}
    />
  );
}

Field.Label = FieldLabel;

export { Field, FieldLabel, field as fieldVariants };
