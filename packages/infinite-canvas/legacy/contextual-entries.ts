import type { RegisterableHotkey } from "@tanstack/hotkeys";

import type { InfiniteCanvasHotkeyAction } from "./keyboard";
import type {
  InfiniteCanvasContextualCommand,
  InfiniteCanvasCommandGroup,
  InfiniteCanvasDispatch,
  InfiniteCanvasState,
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
  /** Preserves asynchronous command and consumer action results. */
  run: () => Promise<unknown> | void;
}>;

/** Binds commands and actions. An action with the same id overrides a command. */
function getInfiniteCanvasContextualEntries<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  options: Readonly<{
    dispatch: InfiniteCanvasDispatch<Kind>;
    commands: readonly InfiniteCanvasContextualCommand[];
    hotkeyActions?: readonly InfiniteCanvasHotkeyAction<Kind>[];
  }>,
): readonly InfiniteCanvasContextualEntry[] {
  const hotkeyActions = options.hotkeyActions ?? [];
  const claimed = new Set(hotkeyActions.map((action) => action.id));

  return [
    ...options.commands.flatMap<InfiniteCanvasContextualEntry>((command) =>
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
              run: () => options.dispatch(command.command),
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
