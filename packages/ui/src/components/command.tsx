"use client";

import { Command as CommandPrimitive } from "cmdk";
import type { ComponentProps } from "react";
import { tv } from "tailwind-variants";

import { cn } from "../lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./dialog";

/**
 * A command surface on `cmdk`, presented through the Base UI dialog.
 *
 * Filtering, ranking, roving focus, and the combobox/listbox roles belong to `cmdk`; modality,
 * focus trap and restore, and dismissal belong to the dialog. What is here is styling.
 */
const command = tv({
  slots: {
    dialogContent: "gap-0 overflow-hidden p-0 sm:max-w-xl",
    empty: "py-10 text-center text-sm text-muted-foreground",
    footer: "flex items-center gap-4 px-4 py-2.5",
    group:
      "overflow-hidden px-2 pb-1 text-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:tracking-[0.06em] [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:uppercase",
    input:
      "flex h-13 w-full bg-transparent text-[15px] tracking-[-0.01em] outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
    inputRow: "flex items-center gap-2.5 px-4",
    item: "group/command-item relative flex cursor-default items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm outline-hidden select-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0",
    list: "max-h-[22rem] scroll-py-2 overflow-x-hidden overflow-y-auto pb-2",
    root: "flex w-full flex-col overflow-hidden bg-transparent text-popover-foreground",
    separator: "mx-2 my-1 h-px bg-border",
    shortcut: "ml-auto flex shrink-0 items-center gap-1",
  },
});

function Command({ className, ...props }: ComponentProps<typeof CommandPrimitive>) {
  const styles = command();

  return (
    <CommandPrimitive className={cn(styles.root(), className)} data-slot="command" {...props} />
  );
}

/**
 * `description` is required, not optional: the dialog announces itself, and a palette that opens
 * with no accessible description is a modal a screen reader cannot explain.
 */
function CommandDialog({
  children,
  className,
  description,
  onOpenChange,
  open,
  title,
}: Readonly<{
  children: React.ReactNode;
  className?: string;
  description: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: string;
}>) {
  const styles = command();

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className={cn(styles.dialogContent(), className)}>
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">{description}</DialogDescription>
        <Command>{children}</Command>
      </DialogContent>
    </Dialog>
  );
}

function CommandInput({ className, ...props }: ComponentProps<typeof CommandPrimitive.Input>) {
  const styles = command();

  return (
    <div className={styles.inputRow()} data-slot="command-input-row">
      <CommandPrimitive.Input
        className={cn(styles.input(), className)}
        data-slot="command-input"
        {...props}
      />
    </div>
  );
}

function CommandList({ className, ...props }: ComponentProps<typeof CommandPrimitive.List>) {
  const styles = command();

  return (
    <CommandPrimitive.List
      className={cn(styles.list(), className)}
      data-slot="command-list"
      {...props}
    />
  );
}

function CommandEmpty({ className, ...props }: ComponentProps<typeof CommandPrimitive.Empty>) {
  const styles = command();

  return (
    <CommandPrimitive.Empty
      className={cn(styles.empty(), className)}
      data-slot="command-empty"
      {...props}
    />
  );
}

function CommandGroup({ className, ...props }: ComponentProps<typeof CommandPrimitive.Group>) {
  const styles = command();

  return (
    <CommandPrimitive.Group
      className={cn(styles.group(), className)}
      data-slot="command-group"
      {...props}
    />
  );
}

function CommandItem({ className, ...props }: ComponentProps<typeof CommandPrimitive.Item>) {
  const styles = command();

  return (
    <CommandPrimitive.Item
      className={cn(styles.item(), className)}
      data-slot="command-item"
      {...props}
    />
  );
}

function CommandSeparator({
  className,
  ...props
}: ComponentProps<typeof CommandPrimitive.Separator>) {
  const styles = command();

  return (
    <CommandPrimitive.Separator
      className={cn(styles.separator(), className)}
      data-slot="command-separator"
      {...props}
    />
  );
}

function CommandShortcut({ className, ...props }: ComponentProps<"span">) {
  const styles = command();

  return (
    <span className={cn(styles.shortcut(), className)} data-slot="command-shortcut" {...props} />
  );
}

/** The hint bar. Most of what makes a launcher feel finished is telling you what the keys do. */
function CommandFooter({ className, ...props }: ComponentProps<"div">) {
  const styles = command();

  return <div className={cn(styles.footer(), className)} data-slot="command-footer" {...props} />;
}

export {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandFooter,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
};
