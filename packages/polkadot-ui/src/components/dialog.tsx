import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import type { VariantProps } from "tailwind-variants";

import { tv } from "../tv.ts";
import { buttonVariants } from "./button.tsx";

const dialog = tv({
  slots: {
    backdrop:
      "fixed inset-0 z-50 bg-pk-scrim/66 transition-opacity duration-(--pk-duration-detail) ease-pk-swift data-ending-style:opacity-0 data-starting-style:opacity-0",
    popup:
      "fixed top-1/2 left-1/2 z-50 flex w-[min(92vw,440px)] -translate-x-1/2 -translate-y-1/2 flex-col gap-3 rounded-pk-card border border-pk-line bg-pk-surface p-5 text-pk-ink shadow-pk-card outline-none transition-[transform,opacity] duration-(--pk-duration-detail) ease-pk-swift data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0",
    title: "font-pk-sans text-pk-title text-pk-ink-bright",
    description: "font-pk-sans text-pk-body text-pk-ink-soft text-pretty",
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
 * Backdrop and popup in one part, modal and centred. `Dialog.Footer` is a real part rather than a
 * layout each consumer rebuilds, so actions align the same way in every dialog.
 */
function DialogContent({ className, ...props }: DialogContentProps) {
  const styles = dialog();

  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop data-slot="dialog-backdrop" className={styles.backdrop()} />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={styles.popup({ className })}
        {...props}
      />
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
