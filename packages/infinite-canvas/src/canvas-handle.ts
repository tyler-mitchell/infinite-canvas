import { observe } from "@legendapp/state";

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
  /**
   * Watch a slice of state. Returns a disposer.
   *
   * Selector-based rather than a bare `onChange`, because a bare one fires on every
   * camera tick and the caller ends up diffing anyway. Selecting an array or a
   * primitive is enough: the reducers return the *identical* array when they change
   * nothing, so `subscribe((state) => state.windows, ...)` fires exactly when the
   * windows change and never during a pan.
   *
   * Do not select a freshly-built object — `(state) => ({ ...state })`, or
   * `getInfiniteCanvasDocument(state)` — as the identity is new every read and the
   * listener would fire forever.
   */
  subscribe: <Value>(
    selector: (state: InfiniteCanvasState<Kind>) => Value,
    listener: (value: Value, previousValue: Value) => void,
  ) => () => void;
}>;

/**
 * Programmatic consumer contract over a canvas store: observe state, list
 * available actions, act — the shape agents, E2E drivers, and command
 * palettes need, without reaching into renderer internals.
 *
 * @experimental The handle surface may still grow (spatial queries) before it is
 * stabilized; the pieces it curates are themselves stable framework APIs.
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
    subscribe: (selector, listener) => {
      let previousValue = selector(getState());
      let hasPending = false;

      return observe(() => {
        // `.get()` inside `observe` is what registers the dependency; `.peek()`
        // would read the same value and subscribe to nothing.
        const value = selector(store.state$.get() as InfiniteCanvasState<Kind>);

        if (Object.is(value, previousValue) || hasPending) {
          return;
        }

        // The listener runs on a microtask, outside the tracking context. Called
        // inline, any observable it happened to read would be recorded as a
        // dependency of this observer and could re-trigger it — a subscription that
        // fires because someone looked at something is a very hard bug to find.
        // Batched framework commits collapse into one notification either way.
        hasPending = true;
        queueMicrotask(() => {
          const settledValue = selector(getState());
          const settledPrevious = previousValue;

          hasPending = false;
          previousValue = settledValue;

          if (!Object.is(settledValue, settledPrevious)) {
            listener(settledValue, settledPrevious);
          }
        });
      });
    },
  };
}

export { createInfiniteCanvasHandle };
export type { InfiniteCanvasHandle };
