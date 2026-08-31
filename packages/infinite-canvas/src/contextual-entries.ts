import type { RegisterableHotkey } from "@tanstack/hotkeys";

import { getInfiniteCanvasContextualCommands } from "./commands";
import type { InfiniteCanvasHotkeyAction } from "./keyboard";
import type {
  InfiniteCanvasCommandDescriptor,
  InfiniteCanvasCommandGroup,
  InfiniteCanvasCommands,
  InfiniteCanvasState,
  InfiniteCanvasZoomPolicy,
} from "./types";

/** One bound list of canvas commands and consumer actions. */
type InfiniteCanvasContextualEntry = Readonly<{
  description: string;
  enabled: boolean;
  /** Canvas command group. Consumer actions have no group. */
  group?: InfiniteCanvasCommandGroup;
  hotkeys: readonly RegisterableHotkey[];
  id: string;
  label: string;
  /** Returns a consumer action promise when the action supplies one. */
  run: () => Promise<void> | void;
}>;

/** Binds commands and actions. An action with the same id overrides a command. */
function getInfiniteCanvasContextualEntries<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  options: Readonly<{
    actions: InfiniteCanvasCommands<Kind>;
    commandDescriptors?: readonly InfiniteCanvasCommandDescriptor[];
    hotkeyActions?: readonly InfiniteCanvasHotkeyAction<Kind>[];
    zoomPolicy?: InfiniteCanvasZoomPolicy;
  }>,
): readonly InfiniteCanvasContextualEntry[] {
  const hotkeyActions = options.hotkeyActions ?? [];
  const claimed = new Set(hotkeyActions.map((action) => action.id));

  return [
    ...getInfiniteCanvasContextualCommands(
      state,
      options.commandDescriptors,
      options.zoomPolicy,
    ).flatMap<InfiniteCanvasContextualEntry>((command) =>
      claimed.has(command.id)
        ? []
        : [
            {
              description: command.description,
              enabled: command.enabled,
              group: command.group,
              hotkeys: command.hotkeys,
              id: command.id,
              label: command.label,
              run: () => options.actions.executeCommand(command.command),
            },
          ],
    ),
    ...hotkeyActions.map<InfiniteCanvasContextualEntry>((action) => ({
      description: action.description,
      enabled: action.isEnabled?.(state) ?? true,
      hotkeys: action.hotkeys,
      id: action.id,
      label: action.label,
      // Preserve action promises for callers that track completion.
      run: () => action.run(state),
    })),
  ];
}

export { getInfiniteCanvasContextualEntries };
export type { InfiniteCanvasContextualEntry };
