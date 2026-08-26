import {
  createInfiniteCanvasHandle,
  createInfiniteCanvasStore,
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

/**
 * One canvas document's live runtime: the store, the external observation handle, and the write
 * loop that carries edits back to the database.
 *
 * The caller keys this component subtree by canvas id, so a different canvas is a different React
 * subtree and cannot reuse this store — the disposal guarantee is structural rather than something
 * this hook has to police.
 *
 * The initial state is read once, on purpose. Once the store exists it is the live truth for that
 * canvas; a loader that re-runs afterwards is reporting what the database held before the edits
 * currently in the store, and adopting it would undo them.
 */

const saveCanvas = async (input: CanvasSaveInput<WindowKind>) => {
  const database = await import("../database/database.client");

  return database.saveCanvas(input);
};

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
