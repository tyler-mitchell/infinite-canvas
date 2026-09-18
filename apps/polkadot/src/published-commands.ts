import {
  getInfiniteCanvasContextualEntries,
  type InfiniteCanvasDispatch,
  type InfiniteCanvasContextualEntry,
  type InfiniteCanvasContextualCommand,
  type InfiniteCanvasState,
} from "@hyphened/infinite-canvas";

import { APP_ACTIONS } from "./app-actions";
import { getConnectorHotkeyActions } from "./canvas/connector-hotkeys";
import type { WindowKind } from "./canvas/window-registry";

const getPublishedCanvasCommands = (
  input: Readonly<{
    dispatch: InfiniteCanvasDispatch<WindowKind>;
    commands: readonly InfiniteCanvasContextualCommand[];
    projectId: string;
    state: InfiniteCanvasState<WindowKind>;
  }>,
): readonly InfiniteCanvasContextualEntry[] =>
  getInfiniteCanvasContextualEntries(input.state, {
    dispatch: input.dispatch,
    commands: input.commands.filter(
      (descriptor) => !Object.values(descriptor.command).some((value) => value === ""),
    ),
    hotkeyActions: getConnectorHotkeyActions(input.projectId),
  }).filter((entry) => !APP_ACTIONS.some((action) => action.id === entry.id));

export { getPublishedCanvasCommands };
