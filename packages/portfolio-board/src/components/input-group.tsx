import type { ComponentProps } from "react";
import type { VariantProps } from "tailwind-variants";

import { tv } from "../tv.ts";
import { Button, type ButtonProps } from "./button.tsx";
import { Input } from "./input.tsx";
import { Textarea } from "./textarea.tsx";

const inputGroup = tv({
  slots: {
    root: "group/input-group relative flex w-full min-w-0 items-center rounded-pk-control border border-transparent bg-pk-ink/[0.06] outline-none transition-[color,background-color,border-color] duration-(--pk-duration-hover) ease-pk-swift has-[>textarea]:h-auto has-[[data-slot=input-group-control]:focus-visible]:ring-2 has-[[data-slot=input-group-control]:focus-visible]:ring-pk-accent/50 has-[[data-slot=input-group-control]:focus-visible]:ring-offset-2 has-[[data-slot=input-group-control]:focus-visible]:ring-offset-(color:--pk-ring-seat) hover:border-pk-line",
    addon:
      "flex cursor-text items-center justify-center text-pk-ink-dim select-none [&_svg]:pointer-events-none [&_svg]:size-3.5",
    button: "shadow-none",
    text: "flex items-center text-pk-meta text-pk-ink-dim [&_svg]:pointer-events-none",
    control:
      "flex-1 border-transparent bg-transparent hover:border-transparent focus-visible:ring-0 focus-visible:ring-offset-0",
  },
  variants: {
    align: {
      "inline-start": { addon: "order-first pl-2.5" },
      "inline-end": { addon: "order-last pr-2.5" },
      "block-start": { addon: "order-first w-full justify-start px-2.5 pt-2" },
      "block-end": { addon: "order-last w-full justify-start px-2.5 pb-2" },
    },
    size: {
      xs: { button: "h-5 gap-1 px-1.5 text-pk-micro" },
      sm: { button: "h-6 gap-1.5 px-2 text-pk-label" },
      "icon-xs": { button: "size-5 p-0" },
      "icon-sm": { button: "size-6 p-0" },
    },
  },
  defaultVariants: { align: "inline-start", size: "xs" },
});

type WithClassName<T> = Omit<T, "className"> & { className?: string };

export type InputGroupProps = ComponentProps<"div">;

function InputGroup({ className, ...props }: InputGroupProps) {
  return (
    <div
      role="group"
      data-slot="input-group"
      className={inputGroup().root({ className })}
      {...props}
    />
  );
}

export type InputGroupAddonProps = ComponentProps<"div"> &
  Pick<VariantProps<typeof inputGroup>, "align">;

/** A click on the addon focuses the control, unless it landed on a button of its own. */
function InputGroupAddon({ className, align = "inline-start", ...props }: InputGroupAddonProps) {
  return (
    <div
      role="group"
      data-slot="input-group-addon"
      data-align={align}
      className={inputGroup({ align }).addon({ className })}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("button") !== null) return;
        event.currentTarget.parentElement?.querySelector("input")?.focus();
      }}
      {...props}
    />
  );
}

export type InputGroupButtonProps = Omit<ButtonProps, "size"> &
  Pick<VariantProps<typeof inputGroup>, "size">;

function InputGroupButton({
  className,
  tone = "ghost",
  size = "xs",
  ...props
}: InputGroupButtonProps) {
  return (
    <Button
      data-size={size}
      tone={tone}
      size="sm"
      className={inputGroup({ size }).button({ className })}
      {...props}
    />
  );
}

export type InputGroupTextProps = ComponentProps<"span">;

function InputGroupText({ className, ...props }: InputGroupTextProps) {
  return <span className={inputGroup().text({ className })} {...props} />;
}

export type InputGroupInputProps = WithClassName<ComponentProps<typeof Input>>;

function InputGroupInput({ className, ...props }: InputGroupInputProps) {
  return (
    <Input
      data-slot="input-group-control"
      className={inputGroup().control({ className })}
      {...props}
    />
  );
}

export type InputGroupTextareaProps = WithClassName<ComponentProps<typeof Textarea>>;

function InputGroupTextarea({ className, ...props }: InputGroupTextareaProps) {
  return (
    <Textarea
      data-slot="input-group-control"
      className={inputGroup().control({ className: `resize-none ${className ?? ""}` })}
      {...props}
    />
  );
}

export {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
  InputGroupInput,
  InputGroupTextarea,
  inputGroup as inputGroupVariants,
};
