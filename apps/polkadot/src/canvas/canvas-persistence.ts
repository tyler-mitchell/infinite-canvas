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
  /**
   * The write loop has stopped, and only a decision restarts it.
   *
   * Separate from `error` because the two need opposite handling. A failed write is transient —
   * the revision this loop holds is still the newest one, so the next edit enqueues a save that
   * can succeed, and the status heals itself. A conflict means the document moved underneath us,
   * so the held revision is permanently stale and **every** later save carries the same doomed
   * number.
   *
   * That was the defect this state exists to end: the loop reported `error`, kept the stale
   * revision, and went on refusing every write for the rest of the session behind a small red
   * pill. Verified by driving it — two document edits after a conflict, and the status never left
   * `error` on the same revision. Everything done after that point was lost on reload.
   */
  | Readonly<{ status: "conflict" }>;

/**
 * Matched by `name` rather than by `instanceof`.
 *
 * `CanvasRevisionConflictError` lives in `database.client`, and importing that module here would
 * pull the eleven-megabyte WebAssembly engine into the write loop — the exact cost `operations.ts`
 * exists to defer. The class declares `override readonly name` as a literal, so the name is a
 * stated contract rather than a coincidence of minification.
 */
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

        /*
         * A conflict stops the loop instead of retrying into it.
         *
         * The held revision cannot advance from here — only the write that succeeds advances it,
         * and no write will. Leaving the loop running meant every subsequent edit enqueued another
         * save carrying the same stale number, so the queue did steady work that could only fail.
         * Stopping is not giving up: it is what makes the state legible to the surface that has to
         * offer a way out, and what stops the app from looking busy while saving nothing.
         */
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

  // `subscribeDocument` rather than `subscribe`: the store commits per field and never replaces
  // the root, so selecting the root state compares an object to itself and never fires — this
  // loop wrote nothing at all until that was found. The document subscription also excludes
  // pans, viewport resizes, and snap previews, so nothing here has to filter runtime churn.
  //
  // A drag needs no guard either. The debounce is trailing, so continuous movement produces no
  // write until it settles, and then exactly one.
  const unsubscribe = input.handle.subscribeDocument((document) => {
    // Still subscribed while conflicted, deliberately: the surface offering recovery reads the
    // live document to fork it, and unsubscribing would freeze what it could offer to save.
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
