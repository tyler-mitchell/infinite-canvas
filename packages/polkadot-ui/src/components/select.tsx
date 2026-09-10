import { Select as SelectPrimitive } from "@base-ui/react/select";
import type { VariantProps } from "tailwind-variants";

import { tv } from "../tv.ts";
import { inputVariants } from "./input.tsx";

const select = tv({
  slots: {
    /* Laid over the input's own look, so a select and an input in a column cannot drift apart. */
    trigger:
      "inline-flex cursor-pointer items-center justify-between gap-2 text-left data-disabled:pointer-events-none data-disabled:opacity-40 data-popup-open:border-pk-line-strong",
    value: "min-w-0 truncate",
    icon: "size-3 flex-none text-pk-ink-faint transition-transform duration-(--pk-duration-hover) ease-pk-swift data-popup-open:rotate-180",
    positioner: "z-50",
    popup:
      "z-50 max-h-[min(18rem,var(--available-height))] min-w-(--anchor-width) origin-(--transform-origin) overflow-y-auto rounded-pk-inner border border-pk-line bg-pk-surface p-1 text-pk-ink shadow-pk-card outline-none transition-[transform,opacity] duration-(--pk-duration-detail) ease-pk-swift data-ending-style:scale-[0.97] data-ending-style:opacity-0 data-starting-style:scale-[0.97] data-starting-style:opacity-0",
    item: "flex cursor-pointer items-center justify-between gap-4 rounded-pk-chip px-2 py-1.5 font-pk-sans text-pk-control whitespace-nowrap text-pk-ink-muted outline-none select-none data-disabled:pointer-events-none data-disabled:opacity-40 data-highlighted:bg-pk-accent/15 data-highlighted:text-pk-ink-bright data-selected:text-pk-ink-bright",
    indicator: "size-3 flex-none text-pk-accent",
  },
});

type WithClassName<T> = Omit<T, "className"> & { className?: string };

export type SelectProps = SelectPrimitive.Root.Props<string>;

/**
 * One value out of a list, in a control the width of an input.
 *
 * It draws no words of its own, so it takes its name from a `Field` around it, the same way the
 * checkbox, the radio group and the input do.
 */
function Select(props: SelectProps) {
  return <SelectPrimitive.Root {...props} />;
}

export type SelectTriggerProps = WithClassName<SelectPrimitive.Trigger.Props> &
  VariantProps<typeof inputVariants> & {
    /** What the trigger says before anything is chosen. */
    readonly placeholder?: string;
  };

function SelectTrigger({ tone, className, placeholder, ...props }: SelectTriggerProps) {
  const styles = select();

  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      className={inputVariants({ tone, className: styles.trigger({ className }) })}
      {...props}
    >
      <SelectPrimitive.Value className={styles.value()}>
        {(value: string | null) => value ?? placeholder}
      </SelectPrimitive.Value>
      <SelectPrimitive.Icon className={styles.icon()}>
        <svg viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path
            d="M3 4.5 6 7.5 9 4.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

export type SelectContentProps = WithClassName<SelectPrimitive.Popup.Props> &
  Pick<SelectPrimitive.Positioner.Props, "align" | "side" | "sideOffset">;

/**
 * Base UI's Portal, Positioner and Popup collapsed into one part, the way the menu does it.
 *
 * `alignItemWithTrigger` is off: it lifts the popup over the trigger so the chosen row sits where
 * the closed value was, which reads as the list having jumped when the trigger is near an edge.
 */
function SelectContent({
  className,
  side = "bottom",
  sideOffset = 6,
  align = "start",
  ...props
}: SelectContentProps) {
  const styles = select();

  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        alignItemWithTrigger={false}
        align={align}
        side={side}
        sideOffset={sideOffset}
        className={styles.positioner()}
      >
        <SelectPrimitive.Popup
          data-slot="select-content"
          className={styles.popup({ className })}
          {...props}
        />
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  );
}

export type SelectItemProps = WithClassName<SelectPrimitive.Item.Props>;

function SelectItem({ className, children, ...props }: SelectItemProps) {
  const styles = select();

  return (
    <SelectPrimitive.Item data-slot="select-item" className={styles.item({ className })} {...props}>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator className={styles.indicator()}>
        <svg viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path
            d="M2.5 6.2 4.8 8.5 9.5 3.5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}

Select.Trigger = SelectTrigger;
Select.Content = SelectContent;
Select.Item = SelectItem;

export { Select, SelectContent, SelectItem, SelectTrigger, select as selectVariants };
