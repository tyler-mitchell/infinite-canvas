import { Toolbar as ToolbarPrimitive } from "@base-ui/react/toolbar";
import { tv } from "tailwind-variants";

const toolbar = tv({
  slots: {
    /*
     * The HUD rail. It floats over the board, so it is bounded by a hairline rather than by a
     * lightness step — on this ground one surface against another separates by too little to see.
     */
    root: "inline-flex items-center gap-1 rounded-pk-pill border border-pk-line bg-pk-surface p-1 shadow-pk-card",
    group: "flex items-center gap-1",
    /* `--pk-line-inner` is for a rule inside a card; on a raised rail it does not clear the fill. */
    separator: "mx-1 h-4 w-px flex-none self-center bg-pk-line",
  },
  variants: {
    orientation: {
      horizontal: {},
      vertical: { root: "flex-col", group: "flex-col", separator: "mx-0 my-1 h-px w-4" },
    },
  },
  defaultVariants: { orientation: "horizontal" },
});

type WithClassName<T> = Omit<T, "className"> & { className?: string };

export type ToolbarProps = WithClassName<ToolbarPrimitive.Root.Props>;

/**
 * A toolbar is one tab stop with arrow-key movement between its controls, which is what separates
 * a rail from a row of buttons: a keyboard reaches the whole rail without tabbing through it.
 */
function Toolbar({ orientation = "horizontal", className, ...props }: ToolbarProps) {
  return (
    <ToolbarPrimitive.Root
      data-slot="toolbar"
      orientation={orientation}
      className={toolbar({ orientation }).root({ className })}
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

export type ToolbarButtonProps = ToolbarPrimitive.Button.Props;

/**
 * Takes `render` rather than styling itself, so the rail's buttons are the kit's Button and the
 * toolbar contributes only the roving-focus behaviour.
 */
function ToolbarButton(props: ToolbarButtonProps) {
  return <ToolbarPrimitive.Button data-slot="toolbar-button" {...props} />;
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
