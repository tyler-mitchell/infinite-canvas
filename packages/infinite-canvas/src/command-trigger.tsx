"use client";

import { Button } from "@base-ui/react/button";
import { Menu } from "@base-ui/react/menu";
import { mergeProps } from "@base-ui/react/merge-props";
import { useValue } from "@legendapp/state/react";
import {
  DEFAULT_INFINITE_CANVAS_COMMAND_DESCRIPTORS,
  isInfiniteCanvasCommandEnabled,
  type CommandId,
} from "./commands";
import { useInfiniteCanvasActions, useInfiniteCanvasStore } from "./store";

export type CommandTriggerProps = Button.Props & Readonly<{ commandId: CommandId }>;
export type CommandMenuItemProps = Menu.Item.Props & Readonly<{ commandId: CommandId }>;

function useCommand(commandId: CommandId) {
  const store = useInfiniteCanvasStore();
  const actions = useInfiniteCanvasActions();
  const command = DEFAULT_INFINITE_CANVAS_COMMAND_DESCRIPTORS.find((item) => item.id === commandId);
  const enabled = useValue(
    () =>
      command !== undefined && isInfiniteCanvasCommandEnabled(store.state$.get(), command.command),
  );

  return {
    enabled,
    label: command?.label ?? commandId,
    description: command?.description,
    execute: () => {
      if (
        command !== undefined &&
        isInfiniteCanvasCommandEnabled(store.state$.peek(), command.command)
      )
        actions.executeCommand(command.command);
    },
  };
}

export function CommandTrigger({ commandId, disabled, ...props }: CommandTriggerProps) {
  const command = useCommand(commandId);
  return (
    <Button
      {...mergeProps<"button">(
        { title: command.description, children: command.label, onClick: command.execute },
        props,
      )}
      disabled={disabled || !command.enabled}
      data-slot="command-trigger"
      data-command-id={commandId}
      data-infinite-canvas-control="true"
    />
  );
}

export function CommandMenuItem({ commandId, disabled, ...props }: CommandMenuItemProps) {
  const command = useCommand(commandId);
  return (
    <Menu.Item
      {...mergeProps<"div">(
        { title: command.description, children: command.label, onClick: command.execute },
        props,
      )}
      disabled={disabled || !command.enabled}
      data-slot="command-menu-item"
      data-command-id={commandId}
      data-infinite-canvas-control="true"
    />
  );
}
