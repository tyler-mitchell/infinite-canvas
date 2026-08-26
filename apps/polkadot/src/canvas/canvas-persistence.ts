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

  // `subscribeDocument` rather than `subscribe`: the store commits per field and never replaces
  // the root, so selecting the root state compares an object to itself and never fires — this
  // loop wrote nothing at all until that was found. The document subscription also excludes
  // pans, viewport resizes, and snap previews, so nothing here has to filter runtime churn.
  //
  // A drag needs no guard either. The debounce is trailing, so continuous movement produces no
  // write until it settles, and then exactly one.
  const unsubscribe = input.handle.subscribeDocument((document) => {
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
