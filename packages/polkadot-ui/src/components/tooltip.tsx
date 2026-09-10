import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import { tv } from "../tv.ts";

const tooltip = tv({
  slots: {
    positioner: "z-50",
    popup:
      "z-50 max-w-[min(92vw,260px)] origin-(--transform-origin) rounded-pk-chip border border-pk-line bg-pk-surface px-[9px] py-1.5 font-pk-mono text-pk-mono-sm text-pk-ink-muted shadow-pk-card transition-[transform,opacity] duration-(--pk-duration-detail) ease-pk-swift data-ending-style:scale-[0.97] data-ending-style:opacity-0 data-starting-style:scale-[0.97] data-starting-style:opacity-0",
  },
});

export type TooltipProviderProps = TooltipPrimitive.Provider.Props;

/**
 * One provider around a group of tooltips: the first waits `delay`, and the rest open at once
 * while the pointer stays inside the group.
 */
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

export type TooltipContentProps = Omit<TooltipPrimitive.Popup.Props, "className"> &
  Pick<TooltipPrimitive.Positioner.Props, "align" | "alignOffset" | "side" | "sideOffset"> & {
    className?: string;
  };

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
          className={styles.popup({ className })}
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
