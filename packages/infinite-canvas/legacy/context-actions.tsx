import { ContextMenu } from "@base-ui/react/context-menu";
import { Menu } from "@base-ui/react/menu";
import { useValue } from "@legendapp/state/react";
import type { ReactElement } from "react";
import { CommandMenuItem } from "./command-trigger";
import { useInfiniteCanvasIcons } from "./icons";
import { useInfiniteCanvasStore } from "./react/store";
import { isSelectionTargetSelected } from "./selection";
import type { InfiniteCanvasStore } from "./store";
import type { ContextMenuPolicy, InfiniteCanvasCommandId, TransformTarget } from "./types";

const commands: Readonly<Record<TransformTarget["type"], readonly InfiniteCanvasCommandId[]>> = {
  group: [
    "group.setLayout.split",
    "group.setLayout.tabs",
    "group.setLayout.accordion",
    "group.setLayout.masonry",
    "group.flipAxis",
    "group.equalizeChildren",
    "group.dissolve",
  ],
  window: [
    "selection.group",
    "window.undock",
    "activeWindow.togglePinned",
    "activeWindow.toggleMaximized",
    "selection.minimize",
    "selection.close",
  ],
};

function selectContextTarget({
  store,
  target,
}: Readonly<{ store: InfiniteCanvasStore; target: TransformTarget }>) {
  const state = store.getState();
  if (!isSelectionTargetSelected(state.selection, target))
    store.dispatch({
      type: "selection.replace",
      targets: [target.type === "group" ? { ...target, kind: "group" } : target],
    });
}

function ActionItems({
  target,
  policy,
}: Readonly<{ target: TransformTarget; policy?: ContextMenuPolicy }>) {
  const store = useInfiniteCanvasStore();
  const items = useValue(() =>
    store
      .getContextualCommands({ includeDisabled: policy?.showDisabled ?? true })
      .filter(
        (command) =>
          (policy?.commands ?? commands[target.type]).includes(command.id) ||
          (policy?.commands === undefined &&
            command.group === "component" &&
            target.type === "window"),
      ),
  );
  return (
    <>
      {items.map(({ id }) => (
        <CommandMenuItem key={id} commandId={id} />
      ))}
    </>
  );
}

export function WindowContextMenu({
  children,
  windowId,
  policy,
}: Readonly<{
  children: ReactElement;
  windowId: string;
  policy?: ContextMenuPolicy | false;
}>) {
  const store = useInfiniteCanvasStore();
  if (policy === false) return children;
  const target = { type: "window", id: windowId } as const;
  return (
    <ContextMenu.Root
      onOpenChange={(open) => {
        if (open) selectContextTarget({ store, target });
      }}
    >
      <ContextMenu.Trigger render={children} />
      <ContextMenu.Portal>
        <ContextMenu.Positioner data-slot="context-actions-positioner">
          <ContextMenu.Popup
            data-slot="context-actions"
            aria-label={policy?.label ?? "Window actions"}
          >
            <ActionItems target={target} policy={policy} />
          </ContextMenu.Popup>
        </ContextMenu.Positioner>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}

export function GroupActionMenu({
  groupId,
  policy,
}: Readonly<{ groupId: string; policy?: ContextMenuPolicy | false }>) {
  const store = useInfiniteCanvasStore();
  const { actions: ActionsIcon } = useInfiniteCanvasIcons();
  if (policy === false) return null;
  const target = { type: "group", id: groupId } as const;
  return (
    <Menu.Root
      onOpenChange={(open) => {
        if (open) selectContextTarget({ store, target });
      }}
    >
      <Menu.Trigger
        data-slot="group-actions-trigger"
        data-infinite-canvas-control="true"
        aria-label={policy?.label ?? "Group actions"}
      >
        <ActionsIcon />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner data-slot="context-actions-positioner" sideOffset={4}>
          <Menu.Popup data-slot="context-actions" aria-label={policy?.label ?? "Group actions"}>
            <ActionItems target={target} policy={policy} />
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
