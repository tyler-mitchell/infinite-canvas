"use client";

import { Button } from "@base-ui/react/button";
import { Menu } from "@base-ui/react/menu";
import { mergeProps } from "@base-ui/react/merge-props";
import { useValue } from "@legendapp/state/react";
import type { InfiniteCanvasCommandId } from "./types";
import { useInfiniteCanvasStore } from "./react/store";

export type CommandTriggerProps = Button.Props & Readonly<{ commandId: InfiniteCanvasCommandId }>;
export type CommandMenuItemProps = Menu.Item.Props &
  Readonly<{ commandId: InfiniteCanvasCommandId }>;

function useCommand(commandId: InfiniteCanvasCommandId) {
  const store = useInfiniteCanvasStore();
  const command = useValue(() =>
    store.getContextualCommands({ includeDisabled: true }).find((item) => item.id === commandId),
  );

  return {
    enabled: command?.enabled ?? false,
    label: command?.label ?? commandId,
    description: command?.description,
    execute: () => {
      const current = store
        .getContextualCommands({ includeDisabled: true })
        .find((item) => item.id === commandId);

      if (current?.enabled === true) {
        return store.dispatch(current.command);
      }
    },
  };
}

export function CommandTrigger({ commandId, disabled, ...props }: CommandTriggerProps) {
  const command = useCommand(commandId);
  return (
    <Button
      {...mergeProps<typeof Button>(
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
      {...mergeProps<typeof Menu.Item>(
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
