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

import { NoteWindowBody } from "../notes/note-window";
import type { NoteGateway } from "../notes/note-store";
import {
  startCanvasPersistence,
  type CanvasPersistenceStatus,
  type CanvasSaveInput,
} from "../canvas/canvas-persistence";

type WindowKind = "note";

const NoteWindowData = type({ noteId: "string" });
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
    summary:
      "grid h-full place-items-center px-4 text-center text-[12px] leading-[1.5] text-[var(--ink-faint)]",
  },
});

/**
 * The database, as the note layer sees it.
 *
 * Passed to the window body rather than imported by it, so the body stays renderable without
 * pulling an 11 MB WebAssembly engine into a test or a summary.
 */
const noteGateway: NoteGateway = {
  read: async (noteId) => (await import("../database/database.client")).readNote(noteId),
  save: async (input) => (await import("../database/database.client")).saveNote(input),
};

/**
 * The shell.
 *
 * Every surface here floats: a lighter fill than the ground, a layered shadow, and a single
 * hairline of light along the top edge standing in for a specular. Nothing is outlined. The
 * chrome is a pill rail rather than a full-width bar, so the canvas runs edge to edge underneath
 * and the workspace reads as the product with controls resting on it.
 */
const workspace = tv({
  slots: {
    brand: "flex items-center gap-2.5 pr-1 pl-1.5",
    brandMark:
      "grid size-6 place-items-center rounded-[7px] bg-[var(--accent)] font-mono text-[11px] font-semibold text-[var(--primary-foreground)]",
    brandTitle: "text-[13px] font-medium tracking-[-0.01em] text-[var(--ink)]",
    controls: "pointer-events-auto flex items-center gap-1",
    divider: "mx-1 h-4 w-px bg-[var(--border)]",
    header:
      "pointer-events-none absolute inset-x-0 top-0 z-80 flex items-start justify-between p-3",
    library:
      "pointer-events-auto absolute top-18 bottom-4 left-4 z-70 w-60 rounded-[14px] bg-[var(--surface)] p-1.5 shadow-[var(--lift-2)] inset-ring-1 inset-ring-[var(--edge-light)] backdrop-blur-2xl",
    libraryDescription: "px-2.5 pb-2 text-[12px] leading-[1.65] text-[var(--ink-faint)]",
    libraryLabel:
      "px-2.5 pt-2 pb-1.5 font-mono text-[10px] tracking-[0.14em] text-[var(--ink-faint)] uppercase",
    rail: "pointer-events-auto flex items-center gap-1 rounded-[var(--radius-pill)] bg-[var(--surface)] p-1 shadow-[var(--lift-2)] inset-ring-1 inset-ring-[var(--edge-light)] backdrop-blur-2xl",
    root: "relative h-dvh min-h-0 overflow-hidden bg-[var(--ground)]",
    status:
      "flex items-center gap-2 rounded-[var(--radius-pill)] py-1 pr-3 pl-2.5 text-[11px] tracking-[-0.005em] transition-colors duration-200 ease-[var(--ease-swift)]",
    statusIndicator: "size-1.5 rounded-full bg-current",
  },
  variants: {
    databaseStatus: {
      error: { status: "text-[var(--danger)]" },
      ready: { status: "text-[var(--ink-faint)]" },
      starting: { status: "text-[var(--ink-faint)]" },
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

const createNoteRecord = async (input: Readonly<{ text: string; title: string }>) => {
  const database = await import("../database/database.client");

  return database.createNote(input);
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
      const data = getInfiniteCanvasWindowData(window, NoteWindowData.allows);

      return data == null ? (
        <div className={noteWindow().summary()}>This window is not bound to a note.</div>
      ) : (
        <NoteWindowBody gateway={noteGateway} noteId={data.noteId} />
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
      // Seeded by `fn::open_default_canvas`, so the layout references a record that exists.
      data: { noteId: "content_item:welcome" },
      id: "welcome",
      kind: "note",
      minSize: { height: 180, width: 280 },
      rect: { height: 300, width: 460, x: -230, y: -150 },
      title: "Welcome",
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
        <div className={styles.rail()}>
          <div className={styles.brand()}>
            <div className={styles.brandMark()}>P</div>
            <div className={styles.brandTitle()}>Polkadot</div>
          </div>
          <span className={styles.divider()} />
          <div className={styles.status()} data-database-status={databaseAdmission.status}>
            <span className={styles.statusIndicator()} />
            {databaseAdmission.message}
          </div>
        </div>
        <div className={styles.controls()}>
          <div className={styles.rail()}>
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

                void createNoteRecord({ text: "", title: `Untitled ${ordinal}` }).then(
                  (created) => {
                    canvas.actions.openWindow(
                      createInfiniteCanvasWindow<WindowKind, WindowData["note"]>({
                        data: { noteId: created.id },
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
                  },
                );
              }}
              size="sm"
            >
              New note
            </Button>
          </div>
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
