import type { RegisterableHotkey } from "@tanstack/hotkeys";

import { getInfiniteCanvasContextualCommands } from "./commands";
import type { InfiniteCanvasHotkeyAction } from "./keyboard";
import type {
  InfiniteCanvasCommandDescriptor,
  InfiniteCanvasCommands,
  InfiniteCanvasContextualCommand,
  InfiniteCanvasState,
  InfiniteCanvasZoomPolicy,
} from "./types";

/** One list holding the canvas's verbs and the consumer's. */

/** A consumer verb, resolved against live state. */
type InfiniteCanvasContextualAction<Kind extends string = string> = Readonly<{
  description: string;
  enabled: boolean;
  hotkeys: readonly RegisterableHotkey[];
  id: string;
  label: string;
  run: (state: InfiniteCanvasState<Kind>) => void;
}>;

/** Consumer entries carry no `group`: the five are the framework's own taxonomy. */
type InfiniteCanvasContextualEntry<Kind extends string = string> =
  | (InfiniteCanvasContextualCommand & Readonly<{ source: "canvas" }>)
  | (InfiniteCanvasContextualAction<Kind> & Readonly<{ source: "consumer" }>);

/** A consumer verb sharing an id replaces the canvas command. Overriding is deliberate. */
function getInfiniteCanvasContextualEntries<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  options: Readonly<{
    actions?: readonly InfiniteCanvasHotkeyAction<Kind>[];
    commandDescriptors?: readonly InfiniteCanvasCommandDescriptor[];
    zoomPolicy?: InfiniteCanvasZoomPolicy;
  }> = {},
): readonly InfiniteCanvasContextualEntry<Kind>[] {
  const actions = options.actions ?? [];
  const claimed = new Set(actions.map((action) => action.id));

  return [
    ...getInfiniteCanvasContextualCommands(
      state,
      options.commandDescriptors,
      options.zoomPolicy,
    ).flatMap<InfiniteCanvasContextualEntry<Kind>>((command) =>
      claimed.has(command.id) ? [] : [{ ...command, source: "canvas" }],
    ),
    ...actions.map<InfiniteCanvasContextualEntry<Kind>>((action) => ({
      description: action.description,
      enabled: action.isEnabled?.(state) ?? true,
      hotkeys: action.hotkeys,
      id: action.id,
      label: action.label,
      run: action.run,
      source: "consumer",
    })),
  ];
}

/** Canvas commands go through `executeCommand`; consumer verbs must not. */
function runInfiniteCanvasContextualEntry<Kind extends string>(
  entry: InfiniteCanvasContextualEntry<Kind>,
  input: Readonly<{ actions: InfiniteCanvasCommands<Kind>; state: InfiniteCanvasState<Kind> }>,
): void {
  if (entry.source === "consumer") {
    entry.run(input.state);

    return;
  }

  input.actions.executeCommand(entry.command);
}

export { getInfiniteCanvasContextualEntries, runInfiniteCanvasContextualEntry };
export type { InfiniteCanvasContextualAction, InfiniteCanvasContextualEntry };
