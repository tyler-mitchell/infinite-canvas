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
  | Readonly<{ error: unknown; status: "error" }>;

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
    disposed: boolean;
    revision: number;
  } = {
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
        if (!lifecycle.disposed) {
          input.onStatus({ error, status: "error" });
        }
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

  const unsubscribe = input.handle.subscribe(
    (state) => state,
    (state) => {
      if (state.interaction === null) {
        saveDebouncer.maybeExecute(input.handle.snapshot());
      }
    },
  );

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
