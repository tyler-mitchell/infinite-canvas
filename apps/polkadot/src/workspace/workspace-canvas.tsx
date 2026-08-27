import {
  createInfiniteCanvasEdgeTargetResolver,
  InfiniteCanvas,
  type InfiniteCanvasOverlayReadContext,
  type InfiniteCanvasState,
} from "@hyphened/infinite-canvas";
import { useObservable, useValue } from "@legendapp/state/react";
import { PanelLeft, Plus } from "lucide-react";
import { useEffect, useMemo } from "react";
import { Button } from "ui";
import { tv } from "ui/tv";

import { CanvasConflictNotice } from "../canvas/canvas-conflict-notice";
import type { CanvasPersistenceStatus } from "../canvas/canvas-persistence";
import { CANVAS_CHROME } from "../canvas/chrome";
import { createCanvasDropPolicy, type CanvasDropPayload } from "../canvas/drop-policy";
import { ConnectorDraft } from "../canvas/connector-draft";
import { getConnectorEdgeTargets } from "../canvas/connector-geometry";
import { getConnectorHotkeyActions } from "../canvas/connector-hotkeys";
import { ConnectorLayer } from "../canvas/connector-layer";
import { useCanvasRuntime } from "../canvas/use-canvas-runtime";
import { windowDefinitions, type WindowKind } from "../canvas/window-registry";
import { CanvasHud } from "../hud/canvas-hud";
import { CommandPalette } from "../hud/command-palette";
import { useHudOccluders } from "../hud/hud-occluders";
import { Minimap, MINIMAP_INSET } from "../hud/minimap";
import { LibraryRail, RAIL_INSET } from "../library/library-rail";
import { ModelContextTools } from "../model-context";
import { openNewNote } from "../notes/open-note";
import { loadRelations, relations$ } from "../relations/relation-store";
import { SavedViewMenu } from "../views/saved-view-menu";
import { CanvasSwitcher } from "./canvas-switcher";
import { DesktopSwitcher } from "./desktop-switcher";
import { ProjectSwitcher } from "./project-switcher";

type SaveAdmission = Readonly<{
  message: string;
  status: "error" | "ready" | "starting";
}>;

type LoadedCanvas = Readonly<{
  droppedKinds?: readonly string[];
  id: string;
  projectId: string;
  projectTitle: string;
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
    brand: "flex items-center gap-1.5 pr-1 pl-1.5",
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

/**
 * What this app's own chrome covers, per edge.
 *
 * The library rail is the obvious one, but it is not the only one: the identity rail sits along
 * the top and the zoom and selection rails along the bottom, and until they were named here the
 * camera centred content underneath them and the offscreen indicators projected their ring onto
 * an edge that has a pill rail sitting on it — an arrow appeared behind the "New note" button.
 *
 * Declaring one edge and forgetting the others is the same bug as declaring none, just quieter.
 */
const TOP_INSET = 56;
const BOTTOM_INSET = 56;

function getSaveAdmission(status: CanvasPersistenceStatus): SaveAdmission {
  /*
   * A conflict says what is true of the work, not what the database said.
   *
   * The raw error — "Canvas canvas_document:main changed after revision 396" — names a record and
   * a number, and a person reading it cannot tell whether anything of theirs is at risk. What is
   * actually true is that nothing they do from now on is being written down, and that is the
   * sentence the pill should carry. The notice beside it says what to do about it.
   */
  if (status.status === "conflict") {
    return { message: "Changes are not being saved", status: "error" };
  }

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
  canvasId,
  libraryOpen,
  onToggleLibrary,
  projectId,
  projectTitle,
  saveAdmission,
  title,
}: Readonly<{
  canvas: InfiniteCanvasOverlayReadContext<WindowKind>;
  canvasId: string;
  libraryOpen: boolean;
  onToggleLibrary: () => void;
  projectId: string;
  projectTitle: string;
  saveAdmission: SaveAdmission;
  title: string;
}>) {
  const styles = workspace({ saveStatus: saveAdmission.status });

  return (
    <div className={styles.rail()}>
      {/* The way back when the rail is collapsed, and a second way out while it is open. */}
      <Button
        aria-label={libraryOpen ? "Hide library" : "Show library"}
        aria-pressed={libraryOpen}
        onClick={onToggleLibrary}
        size="icon-sm"
        title={libraryOpen ? "Hide library" : "Show library"}
        variant="ghost"
      >
        <PanelLeft />
      </Button>
      <span className={styles.divider()} />
      <div className={styles.brand()}>
        <ProjectSwitcher projectId={projectId} projectTitle={projectTitle} />
        <CanvasSwitcher canvasId={canvasId} projectId={projectId} title={title} />
        <DesktopSwitcher />
        <SavedViewMenu canvasId={canvasId} />
      </div>
      <span className={styles.divider()} />
      <div className={styles.status()} data-save-status={saveAdmission.status}>
        <span className={styles.statusIndicator()} />
        {saveAdmission.message}
      </div>
      <span className={styles.divider()} />
      <Button
        onClick={() => {
          void openNewNote({ actions: canvas.actions, projectId, state: canvas.state });
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

/**
 * Connectors, as things the pointer can land on.
 *
 * Registered once at module scope rather than rebuilt per render: it reads its targets from a
 * callback, so the resolver itself never goes stale, and the viewport memoizes on this array's
 * identity. `relations$.peek()` rather than a subscription because the callback runs *during* a
 * pointer event, when the current value is what matters and a re-render is not.
 *
 * This is what makes a connector selectable at all. The framework turns a resolved edge into a
 * selection target on pointerdown — with modifier handling — so clicking one is the framework's
 * own selection model rather than anything invented here.
 */
const spatialTargetResolvers = [
  createInfiniteCanvasEdgeTargetResolver<WindowKind>({
    id: "note-relations",
    targets: (context) => getConnectorEdgeTargets(context.state, relations$.peek()),
  }),
];

export function WorkspaceCanvas({ canvas }: Readonly<{ canvas: LoadedCanvas }>) {
  const runtime = useCanvasRuntime(canvas);
  const library$ = useObservable(true);
  const libraryOpen = useValue(library$);
  // What the HUD's floating surfaces are covering, each measured from its own element.
  const occluders = useHudOccluders();
  /**
   * Open by default, and refundable.
   *
   * The map costs real camera room — it is the one surface here whose inset is worth arguing with
   * — so it is closable, and closing it hands the band straight back. Open by default because a
   * canvas affordance nobody discovers is one nobody has, and this is the only surface that
   * answers "what shape is my canvas".
   */
  const minimap$ = useObservable(true);
  const minimapOpen = useValue(minimap$);
  const styles = workspace();
  // Memoized because the viewport re-registers its keymap whenever this array's identity changes,
  // and a fresh array every render would tear down and rebuild thirty-odd chords per frame.
  const hotkeyActions = useMemo(
    () => getConnectorHotkeyActions(canvas.projectId),
    [canvas.projectId],
  );
  // Memoized for the same reason as the keymap: the viewport rebinds its native drag listeners
  // whenever this object's identity changes, and a fresh one every render would tear them down and
  // re-attach them mid-drag.
  const dropPolicy = useMemo(() => createCanvasDropPolicy(canvas.projectId), [canvas.projectId]);

  useEffect(() => {
    void loadRelations(canvas.projectId);
  }, [canvas.projectId]);

  return (
    <main className={styles.root()}>
      <InfiniteCanvas.Provider store={runtime.store}>
        <InfiniteCanvas.Viewport<WindowKind, CanvasDropPayload>
          chrome={CANVAS_CHROME}
          /*
           * Drag a picture in from the desktop and it lands where you let go.
           *
           * Passing this is also what switches the framework's native-drag bridge on at all — it
           * stays inert without a policy, so a canvas that was never told what a file means leaves
           * the browser's own handling alone.
           */
          dropPolicy={dropPolicy}
          /*
           * What the library rail is covering, so the camera stops aiming behind it.
           *
           * Without this, `view.fit`, `view.fitSelection` and `window.reveal` all centre on the
           * middle of the element — which is under the panel — and the rail would be a surface
           * that fights every camera command while looking finished.
           */
          viewportInsets={{
            // Only what genuinely spans an edge. The map used to be in this number as a full-width
            // band, because an inset is one number per edge and a corner has no other way to be
            // said — 168 of 900 pixels reserved for a box covering about 1% of them. It declares
            // its own rect through `viewportOccluders` now.
            bottom: minimapOpen ? MINIMAP_INSET : BOTTOM_INSET,
            left: libraryOpen ? RAIL_INSET : 0,
            top: TOP_INSET,
          }}
          /*
           * The chrome that sits *inside* the canvas rather than bracketing it.
           *
           * Each surface measures itself and reports its rect, so this is what is actually covered
           * rather than a second copy of the layout that positions it. Framing still aims at the
           * whole content region — a corner should not shrink what the camera fills — while
           * placement steps around the real shape.
           */
          viewportOccluders={occluders}
          /*
           * Backspace and Delete, for the one thing on this canvas the framework cannot name.
           *
           * Added to the canvas keymap rather than replacing it — the framework leaves both chords
           * unclaimed and takes consumer verbs alongside its own, so undo, the arrows, and the fits
           * all keep working. Scoping is the framework's too, which is why Backspace inside a note
           * still deletes a character.
           */
          hotkeyActions={hotkeyActions}
          // Beneath the windows: a connector should pass under the note it joins, not across it.
          renderUnderlay={() => <ConnectorLayer />}
          spatialTargetResolvers={spatialTargetResolvers}
          /*
           * The dock is on because minimizing was otherwise a one-way door.
           *
           * The window chrome has always offered Minimize, and `mode: "minimized"` is what it set —
           * but with no dock, nothing on the canvas said where the window went. The only route back
           * was a library rail row, which is incidental (it reveals the *note*, not the window) and
           * absent entirely when the rail is collapsed. A control that hides something with no
           * visible way to get it back is a trapdoor, not a feature.
           *
           * `minimizedDock: false` sat here uncommented while every other line in this object was
           * argued for, which is what marks it as an unexamined default rather than a decision.
           *
           * `pointerModeControls` and `statusCard` stay off deliberately: this app has one pointer
           * mode and says its save state in the identity rail, so both would be chrome restating
           * something already on screen.
           */
          hud={{
            cameraControls: true,
            minimizedDock: true,
            pointerModeControls: false,
            statusCard: false,
            zoomControls: true,
          }}
          renderOverlay={(context) => (
            <>
              {/*
                Above the windows, unlike `ConnectorLayer`. A settled connector belongs to the
                scene and passes under the note it joins; a line being dragged is the thing you
                are looking at.
              */}
              <ConnectorDraft projectId={canvas.projectId} />
              {/* Renders nothing; registers the app's verbs for an agent. Inert without WebMCP. */}
              <ModelContextTools projectId={canvas.projectId} />
              <CanvasHud
                commandPalette={<CommandPalette projectId={canvas.projectId} />}
                conflict={
                  runtime.saveStatus.status === "conflict" ? (
                    <CanvasConflictNotice
                      canvasTitle={canvas.title}
                      handle={runtime.handle}
                      projectId={canvas.projectId}
                    />
                  ) : null
                }
                droppedKinds={canvas.droppedKinds}
                libraryInset={libraryOpen ? RAIL_INSET : 0}
                minimap={
                  <Minimap
                    onClose={() => {
                      minimap$.set(false);
                    }}
                    onOpen={() => {
                      minimap$.set(true);
                    }}
                    open={minimapOpen}
                  />
                }
                library={
                  libraryOpen ? (
                    <LibraryRail
                      onCollapse={() => {
                        library$.set(false);
                      }}
                      projectId={canvas.projectId}
                    />
                  ) : null
                }
                identity={
                  <IdentityRail
                    canvas={context}
                    canvasId={canvas.id}
                    libraryOpen={libraryOpen}
                    onToggleLibrary={() => {
                      library$.set(!libraryOpen);
                    }}
                    projectId={canvas.projectId}
                    projectTitle={canvas.projectTitle}
                    saveAdmission={getSaveAdmission(runtime.saveStatus)}
                    title={canvas.title}
                  />
                }
              />
            </>
          )}
          title={canvas.title}
          windowDefinitions={windowDefinitions}
        />
      </InfiniteCanvas.Provider>
    </main>
  );
}
