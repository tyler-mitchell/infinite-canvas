import {
  createInfiniteCanvasHandle,
  createInfiniteCanvasStore,
  type InfiniteCanvasHandle,
  type InfiniteCanvasState,
} from "@hyphened/infinite-canvas";
import { useObservable, useValue } from "@legendapp/state/react";
import { useEffect, useState } from "react";

import {
  startCanvasPersistence,
  type CanvasPersistenceStatus,
  type CanvasSaveInput,
} from "./canvas-persistence";
import type { WindowKind } from "./window-registry";

declare global {
  interface Window {
    /** This handle exists only in development builds. */
    __canvas?: InfiniteCanvasHandle<WindowKind>;
  }
}

const saveCanvas = async (input: CanvasSaveInput<WindowKind>) => {
  const database = await import("../database/database.client");

  return database.saveCanvas(input);
};

// The route key controls the store lifetime. This hook reads the initial state once.
function useCanvasRuntime(
  canvas: Readonly<{
    id: string;
    revision: number;
    state: InfiniteCanvasState<WindowKind>;
  }>,
) {
  const [runtime] = useState(() => {
    const store = createInfiniteCanvasStore(canvas.state);

    return { handle: createInfiniteCanvasHandle(store), store };
  });
  const saveStatus$ = useObservable<CanvasPersistenceStatus>({ status: "saved" });
  const saveStatus = useValue(saveStatus$);

  // Production builds do not expose the mutable canvas handle.
  useEffect(() => {
    if (!import.meta.env.DEV) {
      return;
    }

    window.__canvas = runtime.handle;

    return () => {
      delete window.__canvas;
    };
  }, [runtime.handle]);

  useEffect(
    () =>
      startCanvasPersistence({
        canvasId: canvas.id,
        handle: runtime.handle,
        onStatus: (status) => {
          saveStatus$.set(status);
        },
        revision: canvas.revision,
        save: saveCanvas,
      }),
    [canvas.id, canvas.revision, runtime.handle, saveStatus$],
  );

  return { handle: runtime.handle, saveStatus, store: runtime.store };
}

export { useCanvasRuntime };
