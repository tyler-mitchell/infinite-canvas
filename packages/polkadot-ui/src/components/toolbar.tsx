import { Toolbar as ToolbarPrimitive } from "@base-ui/react/toolbar";
import type { VariantProps } from "tailwind-variants";

import { tv } from "../tv.ts";
import { buttonVariants } from "./button.tsx";

const toolbar = tv({
  slots: {
    root: "inline-flex flex-wrap items-center gap-1 rounded-pk-tray border border-pk-line bg-pk-surface p-1 shadow-pk-card [--pk-ring-seat:var(--pk-surface)] data-[orientation=vertical]:flex-col",
    group: "flex items-center gap-1 data-[orientation=vertical]:flex-col",
    separator:
      "flex-none self-center bg-pk-line-inner data-[orientation=horizontal]:my-1 data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-4 data-[orientation=vertical]:mx-1 data-[orientation=vertical]:h-4 data-[orientation=vertical]:w-px",
  },
});

type WithClassName<T> = Omit<T, "className"> & { className?: string };

export type ToolbarProps = WithClassName<ToolbarPrimitive.Root.Props>;

function Toolbar({ orientation = "horizontal", className, ...props }: ToolbarProps) {
  return (
    <ToolbarPrimitive.Root
      data-slot="toolbar"
      orientation={orientation}
      className={toolbar().root({ className })}
      {...props}
    />
  );
}

export type ToolbarGroupProps = WithClassName<ToolbarPrimitive.Group.Props>;

function ToolbarGroup({ className, ...props }: ToolbarGroupProps) {
  return (
    <ToolbarPrimitive.Group
      data-slot="toolbar-group"
      className={toolbar().group({ className })}
      {...props}
    />
  );
}

export type ToolbarButtonProps = WithClassName<ToolbarPrimitive.Button.Props> &
  VariantProps<typeof buttonVariants>;

/**
 * The tray draws its own buttons, over the kit's button rather than a second copy of it. Ghost is
 * the tone a rail wants: the tray already carries the border and the fill, so a button inside it
 * only takes one on hover.
 */
function ToolbarButton({ tone = "ghost", size, className, ...props }: ToolbarButtonProps) {
  return (
    <ToolbarPrimitive.Button
      data-slot="toolbar-button"
      className={buttonVariants({ tone, size, className })}
      {...props}
    />
  );
}

export type ToolbarSeparatorProps = WithClassName<ToolbarPrimitive.Separator.Props>;

function ToolbarSeparator({ className, ...props }: ToolbarSeparatorProps) {
  return (
    <ToolbarPrimitive.Separator
      data-slot="toolbar-separator"
      className={toolbar().separator({ className })}
      {...props}
    />
  );
}

Toolbar.Group = ToolbarGroup;
Toolbar.Button = ToolbarButton;
Toolbar.Separator = ToolbarSeparator;

export { Toolbar, ToolbarButton, ToolbarGroup, ToolbarSeparator, toolbar as toolbarVariants };
