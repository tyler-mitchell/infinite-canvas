import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import type { VariantProps } from "tailwind-variants";

import { MOTION } from "../motion.ts";
import { tv } from "../tv.ts";
import { buttonVariants } from "./button.tsx";

const dialog = tv({
  slots: {
    backdrop: `fixed inset-0 z-50 bg-pk-scrim/66 ${MOTION.scrim}`,
    /*
     * Base UI's own container for the popup, and the window it is centred in. Centring makes the
     * popup a grid item, which keeps a minimum as wide as its longest unbreakable word, so a word
     * with nothing to break on pushed the dialog 132px past a 320px screen. The minimum below is
     * what holds it to the window; wrapping the words alone does not, because a word that can
     * break still counts its whole length towards that minimum.
     */
    viewport: "fixed inset-0 z-50 grid place-items-center overflow-y-auto p-4",
    popup: `flex w-full max-w-[440px] min-w-0 flex-col gap-3 rounded-pk-card border border-pk-line bg-pk-surface p-5 text-pk-ink shadow-pk-card outline-none [--pk-ring-seat:var(--pk-surface)] ${MOTION.overlay}`,
    title: "font-pk-sans text-pk-title break-words text-pk-ink-bright",
    description: "font-pk-sans text-pk-body break-words text-pk-ink-soft text-pretty",
    footer: "mt-1 flex items-center justify-end gap-2",
  },
});

type WithClassName<T> = Omit<T, "className"> & { className?: string };

export type DialogProps = DialogPrimitive.Root.Props;

function Dialog(props: DialogProps) {
  return <DialogPrimitive.Root {...props} />;
}

export type DialogTriggerProps = WithClassName<DialogPrimitive.Trigger.Props> &
  VariantProps<typeof buttonVariants>;

/**
 * The trigger is the button, which is how Base UI writes one and how the toolbar and the select
 * draw theirs. For a trigger that is not a button, pass `render` with its own `className`.
 */
function DialogTrigger({ tone = "soft", size, className, ...props }: DialogTriggerProps) {
  return (
    <DialogPrimitive.Trigger
      data-slot="dialog-trigger"
      className={buttonVariants({ tone, size, className })}
      {...props}
    />
  );
}

export type DialogContentProps = WithClassName<DialogPrimitive.Popup.Props>;

/**
 * Backdrop, viewport and popup in one part, modal and centred. `Dialog.Footer` is a real part
 * rather than a layout each consumer rebuilds, so actions align the same way in every dialog.
 *
 * The viewport is what scrolls, which is the first of the two arrangements Base UI documents. A
 * dialog taller than the window keeps its own shape and moves through the window, so its actions
 * arrive at the end of it rather than under a bar. The popup centres in a grid instead of being
 * placed by hand, so nothing here restates what the library already does.
 */
function DialogContent({ className, ...props }: DialogContentProps) {
  const styles = dialog();

  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop data-slot="dialog-backdrop" className={styles.backdrop()} />
      <DialogPrimitive.Viewport data-slot="dialog-viewport" className={styles.viewport()}>
        <DialogPrimitive.Popup
          data-slot="dialog-content"
          className={styles.popup({ className })}
          {...props}
        />
      </DialogPrimitive.Viewport>
    </DialogPrimitive.Portal>
  );
}

export type DialogTitleProps = WithClassName<DialogPrimitive.Title.Props>;

function DialogTitle({ className, ...props }: DialogTitleProps) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={dialog().title({ className })}
      {...props}
    />
  );
}

export type DialogDescriptionProps = WithClassName<DialogPrimitive.Description.Props>;

function DialogDescription({ className, ...props }: DialogDescriptionProps) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={dialog().description({ className })}
      {...props}
    />
  );
}

export type DialogCloseProps = WithClassName<DialogPrimitive.Close.Props> &
  VariantProps<typeof buttonVariants>;

/** A footer action, so it draws a button the same way the trigger does. */
function DialogClose({ tone = "ghost", size, className, ...props }: DialogCloseProps) {
  return (
    <DialogPrimitive.Close
      data-slot="dialog-close"
      className={buttonVariants({ tone, size, className })}
      {...props}
    />
  );
}

export type DialogFooterProps = React.ComponentProps<"div">;

function DialogFooter({ className, ...props }: DialogFooterProps) {
  return <div data-slot="dialog-footer" className={dialog().footer({ className })} {...props} />;
}

Dialog.Trigger = DialogTrigger;
Dialog.Content = DialogContent;
Dialog.Title = DialogTitle;
Dialog.Description = DialogDescription;
Dialog.Footer = DialogFooter;
Dialog.Close = DialogClose;

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
  dialog as dialogVariants,
};
