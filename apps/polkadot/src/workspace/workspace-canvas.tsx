import {
  InfiniteCanvas,
  createInfiniteCanvasWindow,
  getInfiniteCanvasWindowPlacementRect,
  getVisibleWorldRect,
  type InfiniteCanvasOverlayReadContext,
  type InfiniteCanvasState,
} from "@hyphened/infinite-canvas";
import { Plus } from "lucide-react";
import { Button } from "ui";
import { tv } from "ui/tv";

import type { CanvasPersistenceStatus } from "../canvas/canvas-persistence";
import { useCanvasRuntime } from "../canvas/use-canvas-runtime";
import { windowDefinitions, type WindowData, type WindowKind } from "../canvas/window-registry";
import { CanvasHud } from "../hud/canvas-hud";

type SaveAdmission = Readonly<{
  message: string;
  status: "error" | "ready" | "starting";
}>;

type LoadedCanvas = Readonly<{
  droppedKinds?: readonly string[];
  id: string;
  revision: number;
  state: InfiniteCanvasState<WindowKind>;
  title: string;
}>;

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
    divider: "mx-1 h-4 w-px bg-[var(--border)]",
    rail: "flex items-center gap-1 rounded-[var(--radius-pill)] bg-[var(--surface)] p-1 shadow-[var(--lift-2)] inset-ring-1 inset-ring-[var(--edge-light)] backdrop-blur-2xl",
    root: "relative h-dvh min-h-0 overflow-hidden bg-[var(--ground)]",
    status:
      "flex items-center gap-2 rounded-[var(--radius-pill)] py-1 pr-3 pl-2.5 text-[11px] tracking-[-0.005em] transition-colors duration-200 ease-[var(--ease-swift)]",
    statusIndicator: "size-1.5 rounded-full bg-current",
  },
  variants: {
    saveStatus: {
      error: { status: "text-[var(--danger)]" },
      ready: { status: "text-[var(--ink-faint)]" },
      starting: { status: "text-[var(--ink-faint)]" },
    },
  },
});

const noteSize = { height: 240, width: 360 } as const;
const noteMinimumSize = { height: 160, width: 240 } as const;

const createNoteRecord = async (input: Readonly<{ text: string; title: string }>) => {
  const database = await import("../database/database.client");

  return database.createNote(input);
};

function getSaveAdmission(status: CanvasPersistenceStatus): SaveAdmission {
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

/**
 * Identity: which canvas this is, and whether the work is safe.
 *
 * The save state lives beside the canvas's name rather than in its own corner because it answers a
 * question about *this canvas*, and separating them makes the user assemble that relationship.
 */
function IdentityRail({
  canvas,
  saveAdmission,
  title,
}: Readonly<{
  canvas: InfiniteCanvasOverlayReadContext<WindowKind>;
  saveAdmission: SaveAdmission;
  title: string;
}>) {
  const styles = workspace({ saveStatus: saveAdmission.status });

  return (
    <div className={styles.rail()}>
      <div className={styles.brand()}>
        <div className={styles.brandMark()}>P</div>
        <div className={styles.brandTitle()}>{title}</div>
      </div>
      <span className={styles.divider()} />
      <div className={styles.status()} data-save-status={saveAdmission.status}>
        <span className={styles.statusIndicator()} />
        {saveAdmission.message}
      </div>
      <span className={styles.divider()} />
      <Button
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

          void createNoteRecord({ text: "", title: `Untitled ${ordinal}` }).then((created) => {
            canvas.actions.openWindow(
              createInfiniteCanvasWindow<WindowKind, WindowData["note"]>({
                data: { noteId: created.id },
                id: globalThis.crypto.randomUUID(),
                kind: "note",
                minSize: noteMinimumSize,
                rect: { ...baseRect, x: baseRect.x + offset, y: baseRect.y + offset },
                title: `Untitled ${ordinal}`,
              }),
            );
          });
        }}
        size="sm"
        variant="ghost"
      >
        <Plus />
        New note
      </Button>
    </div>
  );
}

export function WorkspaceCanvas({ canvas }: Readonly<{ canvas: LoadedCanvas }>) {
  const runtime = useCanvasRuntime(canvas);
  const styles = workspace();

  return (
    <main className={styles.root()}>
      <InfiniteCanvas.Provider store={runtime.store}>
        <InfiniteCanvas.Viewport<WindowKind>
          hud={{
            cameraControls: true,
            minimizedDock: false,
            pointerModeControls: false,
            statusCard: false,
            zoomControls: true,
          }}
          renderOverlay={(context) => (
            <CanvasHud
              droppedKinds={canvas.droppedKinds}
              identity={
                <IdentityRail
                  canvas={context}
                  saveAdmission={getSaveAdmission(runtime.saveStatus)}
                  title={canvas.title}
                />
              }
            />
          )}
          title={canvas.title}
          windowDefinitions={windowDefinitions}
        />
      </InfiniteCanvas.Provider>
    </main>
  );
}
