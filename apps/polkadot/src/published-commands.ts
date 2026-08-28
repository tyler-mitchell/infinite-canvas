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

/**
 * A descriptor whose command carries an empty string is a template waiting for an argument —
 * `{ type: "workspace.enter", workspaceId: "" }`. Published as it stands it would act on a
 * workspace called "", which is not a refusal a caller could understand.
 */
const OFFERABLE_DESCRIPTORS = DEFAULT_INFINITE_CANVAS_COMMAND_DESCRIPTORS.filter(
  (descriptor) => !Object.values(descriptor.command).some((value) => value === ""),
);

/**
 * Which canvas verbs this app offers a caller that cannot see the screen.
 *
 * The merged list rather than the framework's alone, so a consumer verb reaches a caller and not
 * only the palette.
 */
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
  }).filter(
    // A framework id this app has already wrapped stays the app's: two tools under one name is a
    // caller's problem rather than a subtlety.
    (entry) => !APP_ACTIONS.some((action) => action.id === entry.id),
  );

export { getPublishedCanvasCommands };
