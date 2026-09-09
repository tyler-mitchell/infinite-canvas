import { Toolbar as ToolbarPrimitive } from "@base-ui/react/toolbar";
import { tv } from "tailwind-variants";

const toolbar = tv({
  slots: {
    /*
     * The HUD rail. It floats over the board, so it is bounded by a hairline rather than by a
     * lightness step — on this ground one surface against another separates by too little to see.
     */
    /*
     * Each part reads its own `data-orientation`, which Base UI already sets, rather than taking
     * the orientation as a variant. As a variant only the root ever received it, so a vertical
     * toolbar kept horizontal groups and upright dividers and the vertical rules were unreachable.
     *
     * A separator's orientation is the line's, not the rail's: a horizontal toolbar is divided by a
     * vertical rule, and Base UI marks it that way, so these read the right way round.
     */
    root: "inline-flex items-center gap-1 rounded-pk-pill border border-pk-line bg-pk-surface p-1 shadow-pk-card data-[orientation=vertical]:flex-col",
    group: "flex items-center gap-1 data-[orientation=vertical]:flex-col",
    /* `--pk-line-inner` is for a rule inside a card; on a raised rail it does not clear the fill. */
    separator:
      "flex-none self-center bg-pk-line data-[orientation=horizontal]:my-1 data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-4 data-[orientation=vertical]:mx-1 data-[orientation=vertical]:h-4 data-[orientation=vertical]:w-px",
  },
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
