import { Switch as SwitchPrimitive } from "@base-ui/react/switch";
import { tv } from "tailwind-variants";

/*
 * No border on either state. The track is a fill, and the thumb stays white through the change, so
 * the only thing that moves is the thumb and the only thing that changes is the track colour.
 */
const switchStyles = tv({
  slots: {
    root: "relative inline-flex h-[18px] w-[30px] flex-none cursor-pointer items-center rounded-pk-pill p-[2px] outline-none transition-colors duration-(--pk-duration-hover) ease-pk-swift focus-visible:ring-2 focus-visible:ring-pk-accent/45 focus-visible:ring-offset-2 focus-visible:ring-offset-pk-ground disabled:pointer-events-none disabled:opacity-40",
    thumb:
      "size-[14px] rounded-pk-pill bg-white shadow-[0_1px_2px_rgb(0_0_0/0.4)] transition-transform duration-(--pk-duration-hover) ease-pk-swift",
  },
  variants: {
    checked: {
      /* The travel is the track width less the thumb and both padding edges. */
      true: { root: "bg-pk-accent", thumb: "translate-x-3" },
      false: { root: "bg-pk-ink/[0.14] hover:bg-pk-ink/[0.2]", thumb: "translate-x-0" },
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
