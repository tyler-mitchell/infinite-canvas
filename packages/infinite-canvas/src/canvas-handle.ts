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
  /** Commands for the shared mutation path. */
  commands: InfiniteCanvasCommands<Kind>;
  /** Enabled command descriptors for the current state. */
  getContextualCommands: () => readonly InfiniteCanvasContextualCommand[];
  /** Returns live shared state. The caller must not mutate it. */
  getState: () => InfiniteCanvasState<Kind>;
  /** Returns a JSON-safe persistence snapshot. */
  snapshot: () => InfiniteCanvasSerializedState<Kind>;
  /** Watches a value by identity. Fresh objects notify on each read. Returns a disposer. */
  subscribe: <Value>(
    selector: (state: InfiniteCanvasState<Kind>) => Value,
    listener: (value: Value, previousValue: Value) => void,
  ) => () => void;
  /** Watches persisted document changes and returns a disposer. */
  subscribeDocument: (
    listener: (document: InfiniteCanvasSerializedState<Kind>) => void,
  ) => () => void;
}>;

/**
 * Programmatic API for one canvas store.
 * @experimental
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
        // `.get()` registers the observer dependency.
        const value = selector(store.state$.get() as InfiniteCanvasState<Kind>);

        if (Object.is(value, previousValue) || hasPending) {
          return;
        }

        // Run the listener outside tracking and collapse batched field notifications.
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
