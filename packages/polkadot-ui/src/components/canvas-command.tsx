import { CommandTrigger, CommandMenuItem, type CommandTriggerProps, type CommandMenuItemProps } from "@hyphened/infinite-canvas";
import type { VariantProps } from "tailwind-variants";
import { buttonVariants } from "./button.tsx";
import { menuVariants } from "./menu.tsx";

export type CanvasCommandProps = Omit<CommandTriggerProps, "className"> & VariantProps<typeof buttonVariants> & { className?: string };

export function CanvasCommand({ tone, size, className, ...props }: CanvasCommandProps) {
  return <CommandTrigger {...props} className={buttonVariants({ tone, size, className })} />;
}

export type CanvasCommandItemProps = Omit<CommandMenuItemProps, "className"> & { className?: string };
export function CanvasCommandItem({ className, ...props }: CanvasCommandItemProps) {
  return <CommandMenuItem {...props} className={menuVariants().item({ className })} />;
}

CanvasCommand.Item = CanvasCommandItem;
