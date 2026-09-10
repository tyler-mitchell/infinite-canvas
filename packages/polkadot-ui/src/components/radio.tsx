import { Radio as RadioPrimitive } from "@base-ui/react/radio";
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group";
import type { VariantProps } from "tailwind-variants";

import { tv } from "../tv.ts";

const radio = tv({
  slots: {
    group: "flex min-w-0",
    root: "inline-flex size-4.5 flex-none cursor-pointer items-center justify-center rounded-pk-pill outline-none transition-colors duration-(--pk-duration-hover) ease-pk-swift select-none focus-visible:ring-2 focus-visible:ring-pk-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-(color:--pk-ring-seat) data-disabled:pointer-events-none data-disabled:opacity-40",
    dot: "size-1.5 rounded-pk-pill bg-pk-on-accent",
  },
  variants: {
    layout: {
      stacked: { group: "flex-col gap-2.5" },
      inline: { group: "flex-row flex-wrap items-center gap-4" },
    },
    checked: {
      true: { root: "bg-pk-accent" },
      false: { root: "bg-pk-ink/[0.14] hover:bg-pk-ink/[0.2]" },
    },
  },
  defaultVariants: { layout: "stacked", checked: false },
});

export interface RadioGroupProps
  extends Omit<RadioGroupPrimitive.Props, "className">, VariantProps<typeof radio> {
  readonly className?: string;
}

/**
 * One choice out of several. The group is what a reader hears named, so it belongs inside a
 * `Field` whose label names it — a bare group reads as `radiogroup` and says nothing about what.
 */
function RadioGroup({ layout, className, ...props }: RadioGroupProps) {
  return (
    <RadioGroupPrimitive
      data-slot="radio-group"
      className={radio({ layout }).group({ className })}
      {...props}
    />
  );
}

export type RadioProps = Omit<RadioPrimitive.Root.Props, "className"> & {
  readonly className?: string;
};

/**
 * Base UI renders this as a `button` with `role="radio"`, so it carries `data-disabled` and never
 * the native `disabled` attribute — style it with `data-disabled:`.
 */
function Radio({ className, ...props }: RadioProps) {
  const styles = radio();

  return (
    <RadioPrimitive.Root
      data-slot="radio"
      className={(state) => radio({ checked: state.checked }).root({ className })}
      {...props}
    >
      <RadioPrimitive.Indicator data-slot="radio-dot" className={styles.dot()} />
    </RadioPrimitive.Root>
  );
}

RadioGroup.Item = Radio;

export { Radio, RadioGroup, radio as radioVariants };
