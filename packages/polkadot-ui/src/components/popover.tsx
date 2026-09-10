import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import type { VariantProps } from "tailwind-variants";

import { tv } from "../tv.ts";
import { buttonVariants } from "./button.tsx";

const popover = tv({
  slots: {
    positioner: "z-50",
    popup:
      "z-50 flex max-h-(--available-height) w-[max-content] max-w-[min(92vw,300px)] origin-(--transform-origin) flex-col gap-2 overflow-y-auto rounded-pk-card border border-pk-line bg-pk-surface p-4 text-pk-ink shadow-pk-card outline-none [--pk-ring-seat:var(--pk-surface)] transition-[transform,opacity] duration-(--pk-duration-detail) ease-pk-swift data-ending-style:scale-[0.97] data-ending-style:opacity-0 data-starting-style:scale-[0.97] data-starting-style:opacity-0",
    title: "font-pk-sans text-pk-label text-pk-ink-dim",
    description: "font-pk-sans text-pk-body text-pk-ink-soft text-pretty",
  },
});

type WithClassName<T> = Omit<T, "className"> & { className?: string };

export type PopoverProps = PopoverPrimitive.Root.Props;

function Popover(props: PopoverProps) {
  return <PopoverPrimitive.Root {...props} />;
}

export type PopoverTriggerProps = WithClassName<PopoverPrimitive.Trigger.Props> &
  VariantProps<typeof buttonVariants>;

/**
 * The trigger is the button, which is how Base UI writes one and how the toolbar and the select
 * draw theirs. For a trigger that is not a button, pass `render` with its own `className`.
 */
function PopoverTrigger({ tone = "soft", size, className, ...props }: PopoverTriggerProps) {
  return (
    <PopoverPrimitive.Trigger
      data-slot="popover-trigger"
      className={buttonVariants({ tone, size, className })}
      {...props}
    />
  );
}

export type PopoverContentProps = WithClassName<PopoverPrimitive.Popup.Props> &
  Pick<PopoverPrimitive.Positioner.Props, "align" | "alignOffset" | "side" | "sideOffset">;

/**
 * Base UI's Portal, Positioner and Popup collapsed into one part, since the kit arranges the three
 * the same way every time. Placement props pass through to the positioner; the popup is bounded so
 * one long sentence cannot stretch it across the page.
 */
function PopoverContent({
  className,
  side = "bottom",
  sideOffset = 8,
  align = "center",
  alignOffset = 0,
  ...props
}: PopoverContentProps) {
  const styles = popover();

  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        className={styles.positioner()}
      >
        <PopoverPrimitive.Popup
          data-slot="popover-content"
          className={styles.popup({ className })}
          {...props}
        />
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  );
}

export type PopoverTitleProps = WithClassName<PopoverPrimitive.Title.Props>;

function PopoverTitle({ className, ...props }: PopoverTitleProps) {
  return (
    <PopoverPrimitive.Title
      data-slot="popover-title"
      className={popover().title({ className })}
      {...props}
    />
  );
}

export type PopoverDescriptionProps = WithClassName<PopoverPrimitive.Description.Props>;

function PopoverDescription({ className, ...props }: PopoverDescriptionProps) {
  return (
    <PopoverPrimitive.Description
      data-slot="popover-description"
      className={popover().description({ className })}
      {...props}
    />
  );
}

export type PopoverCloseProps = WithClassName<PopoverPrimitive.Close.Props> &
  VariantProps<typeof buttonVariants>;

/** A footer action, so it draws a button the same way the trigger does. */
function PopoverClose({ tone = "ghost", size = "sm", className, ...props }: PopoverCloseProps) {
  return (
    <PopoverPrimitive.Close
      data-slot="popover-close"
      className={buttonVariants({ tone, size, className })}
      {...props}
    />
  );
}

Popover.Trigger = PopoverTrigger;
Popover.Content = PopoverContent;
Popover.Title = PopoverTitle;
Popover.Description = PopoverDescription;
Popover.Close = PopoverClose;

export {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
  popover as popoverVariants,
};
