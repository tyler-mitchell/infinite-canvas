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

/** One list holding the canvas's verbs and the consumer's, each already bound to run. */
type InfiniteCanvasContextualEntry = Readonly<{
  description: string;
  enabled: boolean;
  /** Absent on a consumer verb: the five groups are the framework's own taxonomy. */
  group?: InfiniteCanvasCommandGroup;
  hotkeys: readonly RegisterableHotkey[];
  id: string;
  label: string;
  run: () => void;
}>;

/**
 * A consumer verb sharing an id replaces the canvas command. Overriding is deliberate.
 *
 * Takes the dispatcher so a caller never decides how to invoke: a canvas verb routes through the
 * reducer and a consumer verb does not, and that is this function's to know rather than every
 * surface's to branch on.
 */
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
      run: () => action.run(state),
    })),
  ];
}

export { getInfiniteCanvasContextualEntries };
export type { InfiniteCanvasContextualEntry };
