import { Toggle as TogglePrimitive } from "@base-ui/react/toggle";
import { ToggleGroup as ToggleGroupPrimitive } from "@base-ui/react/toggle-group";
import { createContext, use } from "react";
import { tv } from "../tv.ts";

const toggleGroup = tv({
  slots: {
    root: "inline-flex w-fit items-center data-[orientation=vertical]:flex-col data-[orientation=vertical]:items-stretch",
    item: "inline-flex h-6 cursor-pointer items-center justify-center px-2.5 font-pk-sans text-pk-control whitespace-nowrap outline-none transition-[color,background-color] duration-(--pk-duration-hover) ease-pk-swift select-none focus-visible:ring-2 focus-visible:ring-pk-accent/45 focus-visible:ring-offset-2 focus-visible:ring-offset-pk-ground data-disabled:pointer-events-none data-disabled:opacity-40",
  },
  variants: {
    look: {
      segmented: {
        root: "gap-0.5 rounded-pk-control bg-pk-ink/[0.05] p-[3px]",
        item: "rounded-pk-control-inner",
      },
      chips: {
        root: "flex-wrap gap-1.5",
        item: "rounded-pk-control",
      },
    },
    pressed: { true: "", false: "" },
  },
  compoundVariants: [
    {
      look: "segmented",
      pressed: true,
      class: { item: "bg-pk-surface-inner text-pk-ink-bright shadow-[0_1px_2px_rgb(0_0_0/0.45)]" },
    },
    {
      look: "segmented",
      pressed: false,
      class: { item: "text-pk-ink-dim hover:text-pk-ink-muted" },
    },
    {
      look: "chips",
      pressed: true,
      class: { item: "bg-pk-accent text-pk-on-accent" },
    },
    {
      look: "chips",
      pressed: false,
      class: {
        item: "bg-pk-ink/[0.06] text-pk-ink-dim hover:bg-pk-ink/[0.1] hover:text-pk-ink-muted",
      },
    },
  ],
  defaultVariants: { look: "segmented", pressed: false },
});

type Look = "segmented" | "chips";

const LookContext = createContext<Look>("segmented");

export type ToggleGroupProps<Value extends string = string> = Omit<
  ToggleGroupPrimitive.Props<Value>,
  "className"
> & { className?: string; readonly look?: Look };

function ToggleGroup<Value extends string = string>({
  className,
  look = "segmented",
  ...props
}: ToggleGroupProps<Value>) {
  return (
    <LookContext value={look}>
      <ToggleGroupPrimitive
        data-slot="toggle-group"
        className={toggleGroup({ look }).root({ className })}
        {...props}
      />
    </LookContext>
  );
}

export type ToggleProps<Value extends string = string> = Omit<
  TogglePrimitive.Props<Value>,
  "className"
> & { className?: string };

function Toggle<Value extends string = string>({ className, ...props }: ToggleProps<Value>) {
  const look = use(LookContext);

  return (
    <TogglePrimitive
      data-slot="toggle"
      className={(state) => toggleGroup({ look, pressed: state.pressed }).item({ className })}
      {...props}
    />
  );
}

ToggleGroup.Item = Toggle;

export { Toggle, ToggleGroup, toggleGroup as toggleGroupVariants };
