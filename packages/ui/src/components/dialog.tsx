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
    /*
     * Transitions, not `animate-in` / `animate-out`.
     *
     * Those utilities come from an animation plugin this workspace does not install, so every one
     * of them — `animate-in`, `fade-out-0`, `zoom-out-95` — compiled to nothing. That looked
     * harmless, since a dialog appearing instantly is only a missing flourish. It was not harmless:
     * Base UI holds a closing popup mounted until its exit animation finishes, and an exit
     * animation that never starts never finishes.
     *
     * The result was a dialog stuck at `data-closed` with `data-ending-style` for as long as you
     * left it — measured at twelve seconds and still mounted — and, far worse, its **backdrop**
     * stuck with it at full opacity and `pointer-events: auto`. A zero-height dialog is invisible;
     * an invisible full-screen backdrop swallows every click in the application.
     *
     * `opacity` and `scale` under the same `data-` variants are real properties, so the transition
     * actually runs and `transitionend` actually fires. `data-starting-style` is what Base UI sets
     * for one frame on entry, which is what gives the transition somewhere to come from.
     */
    /*
     * `data-closed:pointer-events-none` is the load-bearing part, not the fade.
     *
     * A closed dialog must stop taking input the instant it is closed, whether or not it has
     * finished leaving. Without this, a dismissed palette left a full-screen backdrop at
     * `pointer-events: auto` over the whole application — `elementFromPoint` at the centre of the
     * viewport returned the backdrop, so every click in the app went nowhere. Invisible and
     * inert are different things, and only one of them is safe.
     *
     * It is written as a state rule rather than a cleanup because it cannot then depend on the
     * exit completing. That is what went wrong before: the popup's mount was tied to an animation
     * that never ran, so anything else tied to the same moment never happened either.
     */
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

/**
 * `container` is forwarded because Base UI portals to `<body>` by default, and a host that stacks
 * its own chrome high enough will paint over a modal that landed there. Passing the host's own
 * portal root is the fix — raising the dialog's z-index instead only starts a bidding war.
 */
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
