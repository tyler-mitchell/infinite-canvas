"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import type { ComponentProps } from "react";
import { tv } from "tailwind-variants";

import { cn } from "../lib/utils";

/** Base UI owns modal behavior and accessibility. */
const dialog = tv({
  slots: {
    // CSS transitions must finish before Base UI unmounts closed dialogs.
    // `pointer-events-none` makes a closed backdrop inert before unmount.
    backdrop:
      "fixed inset-0 isolate z-50 bg-black/40 transition-opacity duration-150 supports-backdrop-filter:backdrop-blur-sm data-closed:pointer-events-none data-closed:opacity-0 data-starting-style:opacity-0",
    content:
      "fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 overflow-hidden rounded-xl bg-popover p-4 text-sm text-popover-foreground shadow-2xl transition-[opacity,scale] duration-150 outline-none sm:max-w-md data-closed:pointer-events-none data-closed:scale-95 data-closed:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0",
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

/** A host portal target prevents its chrome from covering the dialog. */
function DialogContent({
  children,
  className,
  container,
  ...props
}: DialogPrimitive.Popup.Props & Pick<DialogPrimitive.Portal.Props, "container">) {
  const styles = dialog();

  return (
    <DialogPrimitive.Portal container={container}>
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
