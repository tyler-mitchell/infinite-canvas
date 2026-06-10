import {
  DEFAULT_INFINITE_CANVAS_COMMAND_DESCRIPTORS,
  getAvailableInfiniteCanvasContextualCommands,
} from "./commands";
import { serializeInfiniteCanvasState } from "./persistence";
import type { InfiniteCanvasStore } from "./store";
import type {
  InfiniteCanvasCommandDescriptor,
  InfiniteCanvasCommands,
  InfiniteCanvasContextualCommand,
  InfiniteCanvasSerializedState,
  InfiniteCanvasState,
} from "./types";

type InfiniteCanvasHandle<Kind extends string = string> = Readonly<{
  /** The full typed command facade — the same single mutation path used by pointer, keyboard, and UI. */
  commands: InfiniteCanvasCommands<Kind>;
  /** Enabled command descriptors for the current state: "what can be done right now". */
  getContextualCommands: () => readonly InfiniteCanvasContextualCommand[];
  /** Live state read (structurally shared; do not mutate). */
  getState: () => InfiniteCanvasState<Kind>;
  /** JSON-safe snapshot via the persistence serializer. */
  snapshot: () => InfiniteCanvasSerializedState<Kind>;
}>;

/**
 * Programmatic consumer contract over a canvas store: observe state, list
 * available actions, act — the shape agents, E2E drivers, and command
 * palettes need, without reaching into renderer internals.
 *
 * @experimental The handle surface may grow (change subscription, spatial
 * queries) before it is stabilized; the pieces it curates are themselves
 * stable framework APIs.
 */
function createInfiniteCanvasHandle<Kind extends string>(
  store: InfiniteCanvasStore<Kind>,
  commandDescriptors: readonly InfiniteCanvasCommandDescriptor[] = DEFAULT_INFINITE_CANVAS_COMMAND_DESCRIPTORS,
): InfiniteCanvasHandle<Kind> {
  const getState = () => store.state$.peek() as InfiniteCanvasState<Kind>;

  return {
    commands: store.commands,
    getContextualCommands: () =>
      getAvailableInfiniteCanvasContextualCommands(getState(), commandDescriptors),
    getState,
    snapshot: () => serializeInfiniteCanvasState(getState()),
  };
}

export { createInfiniteCanvasHandle };
export type { InfiniteCanvasHandle };
