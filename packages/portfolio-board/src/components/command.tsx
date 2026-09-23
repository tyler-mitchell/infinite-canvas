import { Command as CommandPrimitive } from "cmdk";
import type { ComponentProps, ReactNode } from "react";

import { tv } from "../tv.ts";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./dialog.tsx";
import { InputGroup, InputGroupAddon } from "./input-group.tsx";

const command = tv({
  slots: {
    root: "flex size-full flex-col overflow-hidden",
    dialogContent: "w-full max-w-[560px] gap-0 overflow-hidden p-0",
    inputWrapper: "border-b border-pk-line p-2",
    inputGroup: "border-transparent bg-transparent hover:border-transparent",
    input:
      "h-9 w-full flex-1 bg-transparent px-2 font-pk-sans text-pk-control text-pk-ink-bright outline-hidden placeholder:text-pk-ink-faint disabled:cursor-not-allowed disabled:opacity-50",
    inputIcon: "size-3.5 shrink-0 text-pk-ink-dim",
    list: "max-h-[320px] overflow-x-hidden overflow-y-auto p-1",
    empty: "py-6 text-center text-pk-item text-pk-ink-dim",
    group:
      "[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-pk-micro [&_[cmdk-group-heading]]:tracking-[0.06em] [&_[cmdk-group-heading]]:text-pk-ink-faint [&_[cmdk-group-heading]]:uppercase",
    separator: "-mx-1 my-1 h-px bg-pk-line",
    item: "group/command-item relative flex cursor-default items-center gap-2 rounded-pk-inner px-2 py-1.5 text-pk-item text-pk-ink outline-hidden select-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 data-[selected=true]:bg-pk-surface-inner data-[selected=true]:text-pk-ink-bright [&_svg]:pointer-events-none [&_svg]:shrink-0",
    indicator:
      "ml-auto size-3.5 opacity-0 group-has-data-[slot=command-shortcut]/command-item:hidden group-data-[checked=true]/command-item:opacity-100",
    shortcut: "ml-auto text-pk-meta tracking-widest text-pk-ink-faint",
    hidden: "sr-only",
  },
});

type WithClassName<T> = Omit<T, "className"> & { className?: string };

export type CommandProps = WithClassName<ComponentProps<typeof CommandPrimitive>>;

function Command({ className, ...props }: CommandProps) {
  return (
    <CommandPrimitive data-slot="command" className={command().root({ className })} {...props} />
  );
}

export type CommandDialogProps = Omit<ComponentProps<typeof Dialog>, "children"> & {
  title?: string;
  description?: string;
  className?: string;
  children: ReactNode;
};

function CommandDialog({
  title = "Command Palette",
  description = "Search for a command to run...",
  children,
  className,
  ...props
}: CommandDialogProps) {
  return (
    <Dialog {...props}>
      <DialogContent className={command().dialogContent({ className })}>
        <DialogTitle className={command().hidden()}>{title}</DialogTitle>
        <DialogDescription className={command().hidden()}>{description}</DialogDescription>
        {children}
      </DialogContent>
    </Dialog>
  );
}

export type CommandInputProps = WithClassName<ComponentProps<typeof CommandPrimitive.Input>>;

function CommandInput({ className, ...props }: CommandInputProps) {
  const styles = command();

  return (
    <div data-slot="command-input-wrapper" className={styles.inputWrapper()}>
      <InputGroup className={styles.inputGroup()}>
        <CommandPrimitive.Input
          data-slot="command-input"
          className={styles.input({ className })}
          {...props}
        />
        <InputGroupAddon>
          <svg viewBox="0 0 12 12" fill="none" aria-hidden="true" className={styles.inputIcon()}>
            <circle cx="5.2" cy="5.2" r="3.3" stroke="currentColor" strokeWidth="1.4" />
            <path
              d="M7.7 7.7 10.4 10.4"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
        </InputGroupAddon>
      </InputGroup>
    </div>
  );
}

export type CommandListProps = WithClassName<ComponentProps<typeof CommandPrimitive.List>>;

function CommandList({ className, ...props }: CommandListProps) {
  return (
    <CommandPrimitive.List
      data-slot="command-list"
      className={command().list({ className })}
      {...props}
    />
  );
}

export type CommandEmptyProps = WithClassName<ComponentProps<typeof CommandPrimitive.Empty>>;

function CommandEmpty({ className, ...props }: CommandEmptyProps) {
  return (
    <CommandPrimitive.Empty
      data-slot="command-empty"
      className={command().empty({ className })}
      {...props}
    />
  );
}

export type CommandGroupProps = WithClassName<ComponentProps<typeof CommandPrimitive.Group>>;

function CommandGroup({ className, ...props }: CommandGroupProps) {
  return (
    <CommandPrimitive.Group
      data-slot="command-group"
      className={command().group({ className })}
      {...props}
    />
  );
}

export type CommandSeparatorProps = WithClassName<
  ComponentProps<typeof CommandPrimitive.Separator>
>;

function CommandSeparator({ className, ...props }: CommandSeparatorProps) {
  return (
    <CommandPrimitive.Separator
      data-slot="command-separator"
      className={command().separator({ className })}
      {...props}
    />
  );
}

export type CommandItemProps = WithClassName<ComponentProps<typeof CommandPrimitive.Item>>;

/** The indicator marks a checked item, and stands down for an item that shows a shortcut. */
function CommandItem({ className, children, ...props }: CommandItemProps) {
  const styles = command();

  return (
    <CommandPrimitive.Item
      data-slot="command-item"
      className={styles.item({ className })}
      {...props}
    >
      {children}
      <svg viewBox="0 0 12 12" fill="none" aria-hidden="true" className={styles.indicator()}>
        <path
          d="M2.5 6.2 4.8 8.5 9.5 3.5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </CommandPrimitive.Item>
  );
}

export type CommandShortcutProps = WithClassName<ComponentProps<"span">>;

function CommandShortcut({ className, ...props }: CommandShortcutProps) {
  return (
    <span data-slot="command-shortcut" className={command().shortcut({ className })} {...props} />
  );
}

export {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
  command as commandVariants,
};
