import { Switch as SwitchPrimitive } from "@base-ui/react/switch";
import { tv } from "tailwind-variants";

const switchStyles = tv({
  slots: {
    root: "relative inline-flex h-4 w-7 flex-none cursor-pointer items-center rounded-pk-pill border p-px outline-none transition-colors duration-(--pk-duration-hover) ease-pk-swift focus-visible:ring-2 focus-visible:ring-pk-accent/50 disabled:pointer-events-none disabled:opacity-40",
    thumb:
      "size-3 rounded-pk-pill transition-transform duration-(--pk-duration-hover) ease-pk-swift",
  },
  variants: {
    checked: {
      true: {
        root: "border-pk-accent bg-pk-accent",
        /* The travel is the track width less the thumb and both padding edges. */
        thumb: "translate-x-3 bg-pk-on-accent",
      },
      false: {
        root: "border-pk-line bg-pk-surface-sunken hover:border-pk-line-strong",
        thumb: "translate-x-0 bg-pk-ink-faint",
      },
    },
  },
  defaultVariants: { checked: false },
});

export type SwitchProps = Omit<SwitchPrimitive.Root.Props, "className"> & { className?: string };

function Switch({ className, ...props }: SwitchProps) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={(state) => switchStyles({ checked: state.checked }).root({ className })}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={(state) => switchStyles({ checked: state.checked }).thumb()}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch, switchStyles as switchVariants };
