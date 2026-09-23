import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";

import { tv } from "../tv.ts";

const checkbox = tv({
  slots: {
    root: "inline-flex size-4.5 flex-none cursor-pointer items-center justify-center rounded-pk-control-inner outline-none transition-colors duration-(--pk-duration-hover) ease-pk-swift select-none focus-visible:ring-2 focus-visible:ring-pk-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-(color:--pk-ring-seat) data-disabled:pointer-events-none data-disabled:opacity-40",
    /* The group is what lets the two marks read the state, since only this part carries it. */
    indicator: "group inline-flex text-pk-on-accent",
    tick: "size-3 group-data-indeterminate:hidden",
    dash: "hidden size-3 group-data-indeterminate:block",
  },
  variants: {
    checked: {
      true: { root: "bg-pk-accent" },
      false: { root: "bg-pk-ink/[0.14] hover:bg-pk-ink/[0.2]" },
    },
  },
  defaultVariants: { checked: false },
});

export type CheckboxProps = Omit<CheckboxPrimitive.Root.Props, "className"> & {
  readonly className?: string;
};

/**
 * Base UI renders this as a `button` with `role="checkbox"`, so it carries `data-disabled` and
 * never the native `disabled` attribute — style it with `data-disabled:`.
 *
 * It draws no words of its own, so it takes its name from a `Field` around it or from a label
 * pointing at it. On its own it reads as `checkbox, not ticked` and says nothing about what.
 */
function Checkbox({ className, ...props }: CheckboxProps) {
  const styles = checkbox();

  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={(state) =>
        checkbox({ checked: state.checked || state.indeterminate }).root({ className })
      }
      {...props}
    >
      <CheckboxPrimitive.Indicator data-slot="checkbox-indicator" className={styles.indicator()}>
        <svg className={styles.tick()} viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path
            d="M2.5 6.2 4.8 8.5 9.5 3.5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <svg className={styles.dash()} viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="M3 6h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox, checkbox as checkboxVariants };
