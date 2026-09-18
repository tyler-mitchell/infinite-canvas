import { createInfiniteCanvasStore, type InfiniteCanvasStore } from "@hyphened/infinite-canvas";
import { observable, syncState } from "@legendapp/state";
import PQueue from "p-queue";
import { useEffect, useState } from "react";

import { windowDefinitions, type WindowKind } from "./window-registry";

declare global {
  interface Window {
    /** This store exists only in development builds. */
    __canvas?: InfiniteCanvasStore<WindowKind>;
  }
}

// The route key controls the store lifetime. This hook reads the initial state once.
function useCanvasRuntime(
  canvas: Readonly<{
    id: string;
    revision: number;
    layout: unknown;
  }>,
) {
  const [runtime] = useState(() => {
    const revision$ = observable(canvas.revision);
    const saves = new PQueue({ concurrency: 1 });
    const controller = new AbortController();
    return createInfiniteCanvasStore<WindowKind>({
      document: canvas.layout,
      windowDefinitions,
      sync: {
        debounceSet: 250,
        set: ({ value, value$ }) =>
          saves.add(
            async () => {
              const database = await import("../database/database.client");
              try {
                const result = await database.saveCanvas({
                  canvasId: canvas.id,
                  layout: value,
                  revision: revision$.peek(),
                });
                revision$.set(result.revision);
                syncState(value$).error.set(undefined);
              } catch (error) {
                if (error instanceof Error && error.name === "CanvasRevisionConflictError")
                  controller.abort(error);
                throw error;
              }
            },
            { signal: controller.signal },
          ),
        onError: (error, { retry, setParams }) => {
          if (controller.signal.aborted) {
            retry.cancelRetry = true;
            if (setParams !== undefined) syncState(setParams.value$).isSyncEnabled.set(false);
          }
          console.warn("Canvas save failed", { canvasId: canvas.id, error });
        },
      },
    });
  });

  // Production builds do not expose the mutable canvas store.
  useEffect(() => {
    if (!import.meta.env.DEV) {
      return;
    }

    window.__canvas = runtime;

    return () => {
      delete window.__canvas;
    };
  }, [runtime]);

  useEffect(() => {
    const status$ = syncState(runtime.document$);
    status$.isSyncEnabled.set(true);
    return () => {
      status$.isSyncEnabled.set(false);
    };
  }, [runtime]);

  return { saveStatus$: syncState(runtime.document$), store: runtime };
}

export { useCanvasRuntime };
