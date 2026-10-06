import {
  CommandTrigger,
  CommandMenuItem,
  type CommandTriggerProps,
  type CommandMenuItemProps,
} from "@hyphened/infinite-canvas/react";
import type { VariantProps } from "tailwind-variants";
import { buttonVariants } from "./button.tsx";
import { menuVariants } from "./menu.tsx";

export type CanvasCommandProps<Input = unknown> = Omit<CommandTriggerProps<Input>, "className"> &
  VariantProps<typeof buttonVariants> & { className?: string };

export function CanvasCommand<Input>({
  tone,
  size,
  className,
  ...props
}: CanvasCommandProps<Input>) {
  return <CommandTrigger {...props} className={buttonVariants({ tone, size, className })} />;
}

export type CanvasCommandItemProps<Input = unknown> = Omit<
  CommandMenuItemProps<Input>,
  "className"
> & { className?: string };
export function CanvasCommandItem<Input>({ className, ...props }: CanvasCommandItemProps<Input>) {
  return <CommandMenuItem {...props} className={menuVariants().item({ className })} />;
}

CanvasCommand.Item = CanvasCommandItem;
