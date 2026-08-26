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

declare global {
  interface Window {
    /** The live canvas, in development builds only. See the effect that assigns it. */
    __canvas?: InfiniteCanvasHandle<WindowKind>;
  }
}

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

  /*
   * The canvas, drivable from a console in development.
   *
   * The handle is the framework's own answer to "observe state, list what can be done, act" —
   * `getState`, `snapshot`, `getContextualCommands`, `commands`, `subscribe` — and its doc says it
   * exists so an agent or an E2E driver never has to reach into renderer internals. It was already
   * built here for persistence and simply never handed out.
   *
   * Every verification of this app so far has done the opposite: counting
   * `[data-infinite-canvas-window-id]` elements to ask how many windows there are, reading class
   * strings to ask whether something is selected. That is archaeology, it reports the DOM rather
   * than the canvas, and it has produced wrong answers — a connector was pronounced "still open"
   * because the element was mid-exit-animation, and a stale accessibility tree once made buttons
   * look like they had stopped being buttons.
   *
   * Development only. This is a debugging seam, not a public surface, and a global that lets
   * anything mutate the canvas has no business in a shipped build.
   */
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
