import { useObservable, useValue } from "@legendapp/state/react";
import {
  InfiniteCanvas,
  createInfiniteCanvasHandle,
  createInfiniteCanvasState,
  createInfiniteCanvasStore,
  createInfiniteCanvasWindow,
  defineInfiniteCanvasWindowRegistry,
  getInfiniteCanvasWindowData,
  getInfiniteCanvasWindowPlacementRect,
  getVisibleWorldRect,
  normalizeInfiniteCanvasStateForWindowRegistry,
  parseInfiniteCanvasState,
  serializeInfiniteCanvasState,
  type InfiniteCanvasOverlayReadContext,
} from "@hyphened/infinite-canvas";
import { type } from "arktype";
import { useEffect, useState } from "react";
import { Button } from "ui";
import { tv } from "ui/tv";

import {
  startCanvasPersistence,
  type CanvasPersistenceStatus,
  type CanvasSaveInput,
} from "../canvas/canvas-persistence";

type WindowKind = "note";

const NoteWindowData = type({ text: "string" });
type NoteWindowData = typeof NoteWindowData.infer;

type WindowData = Readonly<{
  note: NoteWindowData;
}>;

type DatabaseAdmission = Readonly<{
  message: string;
  status: "error" | "ready" | "starting";
}>;

const noteWindow = tv({
  slots: {
    body: "grid gap-3 p-5 text-sm leading-6 text-white/68",
    explanation: "text-white/38",
    summary: "grid h-full place-items-center p-3 text-center text-xs text-white/60",
  },
});

const workspace = tv({
  slots: {
    brand: "flex items-center gap-2.5",
    brandMark:
      "grid size-7 place-items-center rounded-lg border border-white/10 bg-white/6 font-mono text-[11px] text-white/72",
    brandSubtitle: "text-[10px] text-white/36",
    brandTitle: "text-[13px] font-medium tracking-wide text-white/88",
    controls: "pointer-events-auto flex items-center gap-1.5",
    header:
      "pointer-events-none absolute inset-x-0 top-0 z-80 flex h-13 items-center justify-between border-b border-white/7 bg-[#08090b]/78 px-3 backdrop-blur-xl",
    library:
      "pointer-events-auto absolute top-16 bottom-3 left-3 z-70 w-56 rounded-xl border border-white/8 bg-[#0b0d10]/88 p-3 shadow-2xl backdrop-blur-xl",
    libraryDescription:
      "mt-3 rounded-lg border border-white/7 bg-white/3 p-3 text-xs leading-5 text-white/48",
    libraryLabel: "px-1 text-[10px] font-medium tracking-[0.16em] text-white/34 uppercase",
    root: "h-dvh min-h-0 overflow-hidden pt-13",
    status: "mr-1 flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px]",
    statusIndicator: "size-1.5 rounded-full bg-current",
  },
  variants: {
    databaseStatus: {
      error: {
        status: "border-red-300/14 bg-red-300/5 text-red-200/58",
      },
      ready: {
        status: "border-emerald-300/12 bg-emerald-300/4 text-emerald-200/52",
      },
      starting: {
        status: "border-white/7 bg-white/3 text-white/45",
      },
    },
  },
});

const noteSize = { height: 240, width: 360 } as const;
const noteMinimumSize = { height: 160, width: 240 } as const;

/**
 * The engine is loaded on demand rather than at module scope.
 *
 * It is an 11 MB WebAssembly binary, and the canvas must paint before it resolves — the shell,
 * the framework runtime, and every window render without it. A static import would put the whole
 * engine on the critical path of the first frame for no benefit.
 */
const openCanvas = async (initialLayout: object) => {
  const database = await import("../database/database.client");

  return database.openDefaultCanvas(initialLayout);
};

const saveCanvas = async (input: CanvasSaveInput<WindowKind>) => {
  const database = await import("../database/database.client");

  return database.saveCanvas(input);
};

function getPersistenceAdmission(status: CanvasPersistenceStatus): DatabaseAdmission {
  if (status.status === "error") {
    return {
      message: status.error instanceof Error ? status.error.message : "Local save failed",
      status: "error",
    };
  }

  return status.status === "saving"
    ? { message: "Saving locally", status: "starting" }
    : { message: "Local canvas saved", status: "ready" };
}

const windowDefinitions = defineInfiniteCanvasWindowRegistry<WindowKind, WindowData>({
  note: {
    kind: "note",
    overflowY: "auto",
    renderBody: ({ window }) => {
      const styles = noteWindow();
      const data = getInfiniteCanvasWindowData(window, NoteWindowData.allows);

      return (
        <article className={styles.body()}>
          <p>{data?.text ?? "This note's saved data is invalid."}</p>
          <p className={styles.explanation()}>
            This window is live React DOM inside the headless infinite-canvas runtime.
          </p>
        </article>
      );
    },
    renderSummary: ({ window }) => {
      const styles = noteWindow();

      return <div className={styles.summary()}>{window.title}</div>;
    },
    textSelection: "native",
    wheelBehavior: "native-scroll",
  },
});

const initialState = createInfiniteCanvasState<WindowKind>({
  camera: { center: { x: 0, y: 0 }, zoom: 1 },
  windows: [
    createInfiniteCanvasWindow<WindowKind, WindowData["note"]>({
      data: {
        text: "Polkadot now has a real TanStack Start shell, a parent-owned canvas store, and a typed window registry.",
      },
      id: "welcome",
      kind: "note",
      minSize: { height: 180, width: 280 },
      rect: { height: 280, width: 440, x: -220, y: -140 },
      title: "Polkadot",
    }),
  ],
});
const initialLayout = serializeInfiniteCanvasState(initialState);

function WorkspaceOverlay({
  canvas,
  databaseAdmission,
}: Readonly<{
  canvas: InfiniteCanvasOverlayReadContext<WindowKind>;
  databaseAdmission: DatabaseAdmission;
}>) {
  const chrome$ = useObservable({ railOpen: true });
  const railOpen = useValue(chrome$.railOpen);
  const styles = workspace({ databaseStatus: databaseAdmission.status });

  return (
    <>
      <header className={styles.header()}>
        <div className={styles.brand()}>
          <div className={styles.brandMark()}>P</div>
          <div>
            <div className={styles.brandTitle()}>Polkadot</div>
            <div className={styles.brandSubtitle()}>Spatial workspace</div>
          </div>
        </div>
        <div className={styles.controls()}>
          <div className={styles.status()} data-database-status={databaseAdmission.status}>
            <span className={styles.statusIndicator()} />
            {databaseAdmission.message}
          </div>
          <Button
            onClick={() => {
              chrome$.railOpen.set(!chrome$.railOpen.peek());
            }}
            size="sm"
            variant="ghost"
          >
            {railOpen ? "Hide library" : "Show library"}
          </Button>
          <Button
            disabled={databaseAdmission.status !== "ready"}
            onClick={() => {
              const state = canvas.state;
              const ordinal = state.windows.length + 1;
              const offset = ((ordinal - 1) % 6) * 28;
              const baseRect = getInfiniteCanvasWindowPlacementRect(
                getVisibleWorldRect(state.camera, state.viewport, 0),
                "center",
                noteSize,
                noteMinimumSize,
              );

              canvas.actions.openWindow(
                createInfiniteCanvasWindow<WindowKind, WindowData["note"]>({
                  data: {
                    text: "A new spatial note. Editing and durable content arrive in the first product slice.",
                  },
                  id: globalThis.crypto.randomUUID(),
                  kind: "note",
                  minSize: noteMinimumSize,
                  rect: {
                    ...baseRect,
                    x: baseRect.x + offset,
                    y: baseRect.y + offset,
                  },
                  title: `Untitled ${ordinal}`,
                }),
              );
            }}
            size="sm"
          >
            New note
          </Button>
        </div>
      </header>
      {railOpen ? (
        <aside className={styles.library()}>
          <div className={styles.libraryLabel()}>Library</div>
          <div className={styles.libraryDescription()}>
            Content, assets, search, and saved views will live here. The canvas remains the work
            area.
          </div>
        </aside>
      ) : null}
    </>
  );
}

export function WorkspaceCanvas() {
  const [store] = useState(() => createInfiniteCanvasStore(initialState));
  const [handle] = useState(() => createInfiniteCanvasHandle(store));
  const runtime$ = useObservable<DatabaseAdmission>({
    message: "Opening local database",
    status: "starting",
  });
  const databaseAdmission = useValue(runtime$);
  const styles = workspace();

  useEffect(() => {
    const lifecycle: { disposed: boolean; stopPersistence?: () => void } = { disposed: false };

    void openCanvas(initialLayout)
      .then((canvas) => {
        if (lifecycle.disposed) {
          return;
        }

        const hydratedState = parseInfiniteCanvasState(canvas.layout, initialState);

        if (hydratedState === null) {
          throw new Error("The saved canvas layout is invalid");
        }

        const normalizedState = normalizeInfiniteCanvasStateForWindowRegistry(
          hydratedState,
          windowDefinitions,
        );

        if (normalizedState === null) {
          throw new Error("The saved canvas has no registered window kinds");
        }

        store.commands.hydrate(normalizedState);
        lifecycle.stopPersistence = startCanvasPersistence({
          canvasId: canvas.id,
          handle,
          onStatus: (status) => {
            runtime$.set(getPersistenceAdmission(status));
          },
          revision: canvas.revision,
          save: saveCanvas,
        });
        runtime$.set({ message: "Local canvas saved", status: "ready" });
      })
      .catch((error: unknown) => {
        if (!lifecycle.disposed) {
          runtime$.set({
            message: error instanceof Error ? error.message : "Local database failed",
            status: "error",
          });
        }
      });

    return () => {
      lifecycle.disposed = true;
      lifecycle.stopPersistence?.();
    };
  }, [handle, runtime$, store]);

  return (
    <main className={styles.root()}>
      <InfiniteCanvas.Provider store={store}>
        <InfiniteCanvas.Viewport<WindowKind>
          hud={false}
          renderOverlay={(canvas) => (
            <WorkspaceOverlay canvas={canvas} databaseAdmission={databaseAdmission} />
          )}
          title="Polkadot workspace"
          windowDefinitions={windowDefinitions}
        />
      </InfiniteCanvas.Provider>
    </main>
  );
}
