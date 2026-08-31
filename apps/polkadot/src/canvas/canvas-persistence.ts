import type {
  InfiniteCanvasHandle,
  InfiniteCanvasSerializedState,
} from "@hyphened/infinite-canvas";
import { AsyncQueuer, Debouncer } from "@tanstack/pacer";

type CanvasSaveInput<Kind extends string = string> = Readonly<{
  canvasId: string;
  layout: InfiniteCanvasSerializedState<Kind>;
  revision: number;
}>;

type CanvasSaveResult = Readonly<{ revision: number }>;

type CanvasPersistenceStatus =
  | Readonly<{ status: "saved" }>
  | Readonly<{ status: "saving" }>
  | Readonly<{ error: unknown; status: "error" }>
  // A conflict stops writes until the user selects a recovery action.
  | Readonly<{ status: "conflict" }>;

// Match by name to keep the WebAssembly engine out of this module.
function isRevisionConflict(error: unknown) {
  return error instanceof Error && error.name === "CanvasRevisionConflictError";
}

function startCanvasPersistence<Kind extends string>(
  input: Readonly<{
    canvasId: string;
    handle: InfiniteCanvasHandle<Kind>;
    onStatus: (status: CanvasPersistenceStatus) => void;
    revision: number;
    save: (input: CanvasSaveInput<Kind>) => Promise<CanvasSaveResult>;
  }>,
) {
  const lifecycle: {
    conflicted: boolean;
    disposed: boolean;
    revision: number;
  } = {
    conflicted: false,
    disposed: false,
    revision: input.revision,
  };
  const saves = new AsyncQueuer<InfiniteCanvasSerializedState<Kind>>(
    async (layout) => {
      if (lifecycle.disposed) {
        return;
      }

      input.onStatus({ status: "saving" });
      const result = await input.save({
        canvasId: input.canvasId,
        layout,
        revision: lifecycle.revision,
      });
      lifecycle.revision = result.revision;
    },
    {
      onError: (error) => {
        if (lifecycle.disposed) {
          return;
        }

        // A stale revision cannot recover through retries.
        if (isRevisionConflict(error)) {
          lifecycle.conflicted = true;
          saveDebouncer.cancel();
          saves.clear();
          input.onStatus({ status: "conflict" });

          return;
        }

        input.onStatus({ error, status: "error" });
      },
      onSuccess: (_result, _layout, queue) => {
        if (!lifecycle.disposed && queue.store.state.size === 0) {
          input.onStatus({ status: "saved" });
        }
      },
    },
  );
  const saveDebouncer = new Debouncer(
    (layout: InfiniteCanvasSerializedState<Kind>) => {
      saves.addItem(layout);
    },
    { wait: 250 },
  );

  // The root keeps its identity. Subscribe to document changes.
  const unsubscribe = input.handle.subscribeDocument((document) => {
    // Keep the subscription active so recovery can copy the latest state.
    if (lifecycle.conflicted) {
      return;
    }

    saveDebouncer.maybeExecute(document);
  });

  return () => {
    lifecycle.disposed = true;
    unsubscribe();
    saveDebouncer.cancel();
    saves.stop();
    saves.clear();
  };
}

export { startCanvasPersistence };
export type { CanvasPersistenceStatus, CanvasSaveInput, CanvasSaveResult };
