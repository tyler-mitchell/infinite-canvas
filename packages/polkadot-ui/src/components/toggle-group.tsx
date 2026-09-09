import { Toggle as TogglePrimitive } from "@base-ui/react/toggle";
import { ToggleGroup as ToggleGroupPrimitive } from "@base-ui/react/toggle-group";
import { tv } from "tailwind-variants";

import { slotClass, stateSlotClass } from "../lib/slot-class.ts";

const toggleGroup = tv({
  slots: {
    root: "inline-flex flex-wrap items-center gap-[5px]",
    /*
     * Pressed state comes from Base UI, so this is a state-driven class rather than an attribute
     * selector. The accent does exactly two jobs in this system: status, and the active state.
     */
    item: "inline-flex cursor-pointer items-center rounded-pk-pill border px-[11px] py-[7px] font-pk-sans text-[11px] leading-none whitespace-nowrap outline-none transition-colors duration-(--pk-duration-hover) ease-pk-swift select-none focus-visible:ring-2 focus-visible:ring-pk-accent/50 disabled:pointer-events-none disabled:opacity-40",
  },
  variants: {
    pressed: {
      true: { item: "border-pk-accent bg-pk-accent text-pk-on-accent" },
      false: {
        item: "border-pk-line bg-transparent text-pk-ink-dim hover:border-pk-line-strong hover:text-pk-ink-muted",
      },
    },
  },
  defaultVariants: { pressed: false },
});

export type ToggleGroupProps<Value extends string = string> = ToggleGroupPrimitive.Props<Value>;

function ToggleGroup<Value extends string = string>({
  className,
  ...props
}: ToggleGroupProps<Value>) {
  return (
    <ToggleGroupPrimitive
      data-slot="toggle-group"
      className={slotClass(toggleGroup().root(), className)}
      {...props}
    />
  );
}

export type ToggleProps<Value extends string = string> = TogglePrimitive.Props<Value>;

function Toggle<Value extends string = string>({ className, ...props }: ToggleProps<Value>) {
  return (
    <TogglePrimitive
      data-slot="toggle"
      className={stateSlotClass(
        (state: TogglePrimitive.State) => toggleGroup({ pressed: state.pressed }).item(),
        className,
      )}
      {...props}
    />
  );
}

ToggleGroup.Item = Toggle;

export { Toggle, ToggleGroup, toggleGroup as toggleGroupVariants };
