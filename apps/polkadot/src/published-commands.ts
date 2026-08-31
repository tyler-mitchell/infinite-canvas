import {
  DEFAULT_INFINITE_CANVAS_COMMAND_DESCRIPTORS,
  getInfiniteCanvasContextualEntries,
  type InfiniteCanvasCommands,
  type InfiniteCanvasContextualEntry,
  type InfiniteCanvasState,
} from "@hyphened/infinite-canvas";

import { APP_ACTIONS } from "./app-actions";
import { getConnectorHotkeyActions } from "./canvas/connector-hotkeys";
import type { WindowKind } from "./canvas/window-registry";

const OFFERABLE_DESCRIPTORS = DEFAULT_INFINITE_CANVAS_COMMAND_DESCRIPTORS.filter(
  (descriptor) => !Object.values(descriptor.command).some((value) => value === ""),
);

const getPublishedCanvasCommands = (
  input: Readonly<{
    actions: InfiniteCanvasCommands<WindowKind>;
    projectId: string;
    state: InfiniteCanvasState<WindowKind>;
  }>,
): readonly InfiniteCanvasContextualEntry[] =>
  getInfiniteCanvasContextualEntries(input.state, {
    actions: input.actions,
    commandDescriptors: OFFERABLE_DESCRIPTORS,
    hotkeyActions: getConnectorHotkeyActions(input.projectId),
  }).filter((entry) => !APP_ACTIONS.some((action) => action.id === entry.id));

export { getPublishedCanvasCommands };
