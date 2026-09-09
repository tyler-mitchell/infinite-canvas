import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import { tv } from "tailwind-variants";

import { slotClass } from "../lib/slot-class.ts";

const tooltip = tv({
  slots: {
    positioner: "z-50",
    /*
     * Metadata, so it is set in mono. The scale-in is small on purpose: a tooltip that grows is a
     * tooltip that draws the eye away from what the pointer is already on.
     */
    popup:
      "z-50 origin-(--transform-origin) rounded-pk-chip border border-pk-line bg-pk-surface-raised px-[9px] py-[6px] font-pk-mono text-[10.5px] leading-[1.4] text-pk-ink-muted shadow-pk-card transition-[transform,opacity] duration-(--pk-duration-detail) ease-pk-swift data-ending-style:scale-[0.97] data-ending-style:opacity-0 data-starting-style:scale-[0.97] data-starting-style:opacity-0",
  },
});

export type TooltipProviderProps = TooltipPrimitive.Provider.Props;

function TooltipProvider({ delay = 240, ...props }: TooltipProviderProps) {
  return <TooltipPrimitive.Provider data-slot="tooltip-provider" delay={delay} {...props} />;
}

export type TooltipProps = TooltipPrimitive.Root.Props;

function Tooltip(props: TooltipProps) {
  return <TooltipPrimitive.Root {...props} />;
}

export type TooltipTriggerProps = TooltipPrimitive.Trigger.Props;

function TooltipTrigger(props: TooltipTriggerProps) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

export interface TooltipContentProps
  extends
    TooltipPrimitive.Popup.Props,
    Pick<TooltipPrimitive.Positioner.Props, "align" | "alignOffset" | "side" | "sideOffset"> {}

function TooltipContent({
  className,
  side = "top",
  sideOffset = 6,
  align = "center",
  alignOffset = 0,
  ...props
}: TooltipContentProps) {
  const styles = tooltip();

  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        className={styles.positioner()}
      >
        <TooltipPrimitive.Popup
          data-slot="tooltip-content"
          className={slotClass(styles.popup(), className)}
          {...props}
        />
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  );
}

Tooltip.Trigger = TooltipTrigger;
Tooltip.Content = TooltipContent;
Tooltip.Provider = TooltipProvider;

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger, tooltip as tooltipVariants };
