import { observe } from "@legendapp/state";

import {
  DEFAULT_INFINITE_CANVAS_COMMAND_DESCRIPTORS,
  getAvailableInfiniteCanvasContextualCommands,
} from "./commands";
import {
  INFINITE_CANVAS_DOCUMENT_FIELDS,
  serializeInfiniteCanvasState,
  type InfiniteCanvasDocumentField,
} from "./persistence";
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
  /**
   * Watch the durable document — everything `serializeInfiniteCanvasState` writes down, and
   * nothing else. Returns a disposer.
   *
   * This exists because `subscribe` cannot express it. The store commits per field and never
   * replaces the root, and Legend State is explicitly not immutable, so a root read returns the
   * same object forever: `subscribe((state) => state, …)` compares that object to itself and
   * never fires. Selecting a fresh object instead fires forever. Neither is a viable way to
   * persist a canvas, and both fail silently — the first saves nothing, the second saves
   * constantly.
   *
   * Runtime churn is excluded by construction rather than by the caller filtering it: pans,
   * viewport resizes, snap previews, and history do not reach this listener at all. What remains
   * is a signal that means "the thing you would store has changed", which is what an external
   * store actually needs.
   */
  subscribeDocument: (
    listener: (document: InfiniteCanvasSerializedState<Kind>) => void,
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
    subscribeDocument: (listener) => {
      let hasPending = false;
      // One action commits several fields inside a batch, and each field notifies separately.
      // Collapsing on a microtask turns that into the one document change it actually was.
      const notify = () => {
        if (hasPending) {
          return;
        }

        hasPending = true;
        queueMicrotask(() => {
          hasPending = false;
          listener(serializeInfiniteCanvasState(getState()));
        });
      };
      const disposers = Object.keys(INFINITE_CANVAS_DOCUMENT_FIELDS).map((field) =>
        (
          store.state$[field as InfiniteCanvasDocumentField] as unknown as {
            onChange: (callback: () => void) => () => void;
          }
        ).onChange(notify),
      );

      return () => {
        for (const dispose of disposers) {
          dispose();
        }
      };
    },
  };
}

export { createInfiniteCanvasHandle };
export type { InfiniteCanvasHandle };
