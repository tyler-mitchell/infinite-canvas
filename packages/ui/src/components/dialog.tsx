"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import type { ComponentProps } from "react";
import { tv } from "tailwind-variants";

import { cn } from "../lib/utils";

/**
 * Modal dialogs, on Base UI.
 *
 * Focus trapping and restore, scroll locking, `aria-modal`, escape and outside-press dismissal,
 * and the title/description association all belong to the primitive.
 *
 * The footer separates by tone rather than by a rule: a hairline across a panel reads as a
 * wireframe of a dialog rather than a dialog, which is the same reason no surface here is
 * outlined.
 */
const dialog = tv({
  slots: {
    backdrop:
      "fixed inset-0 isolate z-50 bg-black/40 duration-150 supports-backdrop-filter:backdrop-blur-sm data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
    content:
      "fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 overflow-hidden rounded-xl bg-popover p-4 text-sm text-popover-foreground shadow-2xl duration-150 outline-none sm:max-w-md data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
    description: "text-sm leading-relaxed text-balance text-muted-foreground",
    footer:
      "-mx-4 -mb-4 flex flex-col-reverse gap-2 bg-background/40 p-4 sm:flex-row sm:justify-end",
    header: "flex flex-col gap-2",
    title: "text-base leading-none font-medium",
  },
});

function Dialog({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogContent({ children, className, ...props }: DialogPrimitive.Popup.Props) {
  const styles = dialog();

  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop className={styles.backdrop()} data-slot="dialog-backdrop" />
      <DialogPrimitive.Popup
        className={cn(styles.content(), className)}
        data-slot="dialog-content"
        {...props}
      >
        {children}
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  );
}

function DialogDescription({ className, ...props }: DialogPrimitive.Description.Props) {
  const styles = dialog();

  return (
    <DialogPrimitive.Description
      className={cn(styles.description(), className)}
      data-slot="dialog-description"
      {...props}
    />
  );
}

function DialogFooter({ className, ...props }: ComponentProps<"div">) {
  const styles = dialog();

  return <div className={cn(styles.footer(), className)} data-slot="dialog-footer" {...props} />;
}

function DialogHeader({ className, ...props }: ComponentProps<"div">) {
  const styles = dialog();

  return <div className={cn(styles.header(), className)} data-slot="dialog-header" {...props} />;
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  const styles = dialog();

  return (
    <DialogPrimitive.Title
      className={cn(styles.title(), className)}
      data-slot="dialog-title"
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
};
