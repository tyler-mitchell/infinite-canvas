import {
  createInfiniteCanvasEdgeTargetResolver,
  getInfiniteCanvasGroupTitle,
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
import { BOTTOM_INSET, TOP_INSET } from "../hud/chrome-insets";
import { CommandPalette } from "../hud/command-palette";
import { useHudOccluders } from "../hud/hud-occluders";
import { Minimap } from "../hud/minimap";
import { LibraryRail, RAIL_INSET } from "../library/library-rail";
import { FLOATING_SURFACE } from "../material";
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
    rail: `flex items-center gap-1 rounded-[var(--radius-pill)] ${FLOATING_SURFACE} p-1 shadow-[var(--lift-2)]`,
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
      {/*
        The way back when the rail is collapsed, and a second way out while it is open.

        No `aria-pressed`, for the reason the rail's own view toggle lost it: the name here is the
        action, so a state claim beside it contradicts it. With the library showing, this read
        "Hide library, toggle button, pressed" — announcing that hiding is engaged while the library
        is on screen. A name that already says what pressing does needs no second opinion about it.
      */}
      <Button
        aria-label={libraryOpen ? "Hide library" : "Show library"}
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
            /*
             * Only what genuinely spans an edge. The map used to be in this number as a full-width
             * band, because an inset is one number per edge and a corner has no other way to be
             * said — 168 of 900 pixels reserved for a box covering about 1% of them. It declares
             * its own rect through `viewportOccluders` now.
             *
             * **And so it no longer belongs here at all.** This kept `minimapOpen ? 64 : 56`, the
             * last 8px of that old arrangement, and the framework's HUD insets itself by this
             * number — so opening or closing the map moved the framework's own zoom rail 8px.
             * Measured across a toggle: the rail's top edge sat at 122px from the bottom with the
             * map open and 114px with it closed. Chrome that twitches when an unrelated panel opens
             * is the tell that two things are sharing one number.
             */
            bottom: BOTTOM_INSET,
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
          /*
           * A tab strip already names the members, so the frame above it says nothing.
           *
           * Over tabs the composed title is the strip's own list, one row higher: seen on a
           * two-member tabbed group reading "Untitled 1 & Untitled 2" directly above tabs reading
           * "Untitled 1" and "Untitled 2".
           *
           * **This said the names "appear nowhere else" over a split, and that is false.** Every
           * kind shows its own title inside its pane — a note in its first field, the others in the
           * chrome header — and the LOD summary keeps showing it as the panes shrink. Driven at
           * 128%, 66% and 34% on a three-pane split: the member titles are legible at all three and
           * the frame label repeats them throughout.
           *
           * The split case is kept anyway, for the reason the false one was standing in for: the
           * label names the *cluster*, which no member title does, and it is sized in screen units
           * so it stays the one legible name as the panes fall away. What it repeats over a split is
           * one member's name plus a count; what it repeated over tabs was the whole list verbatim.
           *
           * A group somebody *named* keeps its label in every layout. The name is then a fact about
           * the group rather than a restatement of its contents, and it is the only place that fact
           * appears.
           */
          groupLabel={({ group, windows }) =>
            group.title === null && group.tree.kind === "container" && group.tree.layout !== "split"
              ? ""
              : getInfiniteCanvasGroupTitle(group, windows)
          }
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
