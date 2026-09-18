import {
  createInfiniteCanvasEdgeTargetResolver,
  getInfiniteCanvasGroupTitle,
  InfiniteCanvas,
  type InfiniteCanvasOverlayReadContext,
  type CanvasToolsContext,
} from "@hyphened/infinite-canvas";
import { InfiniteCanvasCompositorSurface } from "@hyphened/infinite-canvas/scene";
import { useObservable, useValue } from "@legendapp/state/react";
import { PanelLeft, Plus } from "lucide-react";
import { useCallback, useEffect } from "react";
import { Button } from "ui";
import { tv } from "ui/tv";

import { CanvasConflictNotice } from "../canvas/canvas-conflict-notice";
import type { Observable, ObservableSyncState } from "@legendapp/state";
import { CANVAS_CHROME } from "../canvas/chrome";
import { createCanvasDropPolicy, type CanvasDropPayload } from "../canvas/drop-policy";
import { ConnectorDraft } from "../canvas/connector-draft";
import { getConnectorEdgeTargets } from "../canvas/connector-geometry";
import { getConnectorHotkeyActions } from "../canvas/connector-hotkeys";
import { ConnectorLayer } from "../canvas/connector-layer";
import { EmptyProjectInvitation } from "../canvas/empty-project";
import { useCanvasRuntime } from "../canvas/use-canvas-runtime";
import type { WindowKind } from "../canvas/window-registry";
import { CanvasHud } from "../hud/canvas-hud";
import { BOTTOM_INSET, TOP_INSET } from "../hud/chrome-insets";
import { CommandPalette } from "../hud/command-palette";
import { useHudOccluders } from "../hud/hud-occluders";
import { Minimap } from "../hud/minimap";
import { TourControl } from "../hud/tour-control";
import { LibraryRail, RAIL_INSET } from "../library/library-rail";
import { FLOATING_SURFACE } from "../material";
import { getAppTools } from "../app-tools";
import { useGoToCanvas } from "./use-go-to-canvas";
import { useRefreshRoute } from "./use-refresh-route";
import { openNewNote } from "../notes/open-note";
import { loadRelations, relations$ } from "../relations/relation-store";
import { SavedViewMenu } from "../views/saved-view-menu";
import { CanvasSwitcher } from "./canvas-switcher";
import { DesktopSwitcher } from "./desktop-switcher";
import { ProjectSwitcher } from "./project-switcher";

type LoadedCanvas = Readonly<{
  id: string;
  projectId: string;
  projectTitle: string;
  revision: number;
  layout: unknown;
  title: string;
}>;

const workspace = tv({
  slots: {
    brand: "flex min-w-0 items-center gap-1.5 pr-1 pl-1.5",
    divider: "mx-1 h-4 w-px bg-[var(--border)]",
    rail: `flex min-w-0 items-center gap-1 rounded-[var(--radius-pill)] ${FLOATING_SURFACE} p-1 shadow-[var(--lift-2)]`,
    root: "relative h-dvh min-h-0 overflow-hidden bg-[var(--ground)]",
    // Fixed chrome strings, so they hold their line and let the canvas title shrink instead.
    status:
      "flex shrink-0 items-center gap-2 rounded-[var(--radius-pill)] py-1 pr-3 pl-2.5 text-[11px] tracking-[-0.005em] whitespace-nowrap transition-colors duration-200 ease-[var(--ease-swift)]",
    statusIndicator: "size-1.5 shrink-0 rounded-full bg-current",
  },
  variants: {
    saveStatus: {
      error: { status: "text-[var(--danger)]" },
      ready: { status: "text-[var(--ink-faint)]" },
      starting: { status: "text-[var(--ink-faint)]" },
    },
  },
});

function IdentityRail({
  canvas,
  canvasId,
  libraryOpen,
  onToggleLibrary,
  projectId,
  projectTitle,
  saveStatus$,
  title,
}: Readonly<{
  canvas: InfiniteCanvasOverlayReadContext<WindowKind>;
  canvasId: string;
  libraryOpen: boolean;
  onToggleLibrary: () => void;
  projectId: string;
  projectTitle: string;
  saveStatus$: Observable<ObservableSyncState>;
  title: string;
}>) {
  const saveStatus = useValue(saveStatus$);
  const error =
    saveStatus.error?.name === "CanvasRevisionConflictError"
      ? "Changes are not being saved"
      : saveStatus.error?.message;
  const progress = saveStatus.isSetting ? "starting" : "ready";
  const status = error === undefined ? progress : "error";
  const message = error ?? (saveStatus.isSetting ? "Saving locally" : "Local canvas saved");
  const styles = workspace({ saveStatus: status });

  return (
    <div className={styles.rail()}>
      {/* The label names the action, so aria-pressed is not used. */}
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
      <div className={styles.status()} data-save-status={status}>
        <span className={styles.statusIndicator()} />
        {message}
      </div>
      <span className={styles.divider()} />
      <Button
        onClick={() => {
          void openNewNote({ dispatch: canvas.dispatch, projectId, state: canvas.state });
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
  const saveError = useValue(runtime.saveStatus$.error);
  const goToCanvas = useGoToCanvas();
  const refreshRoute = useRefreshRoute();
  const tools = (context: CanvasToolsContext<WindowKind>) =>
    getAppTools({
      development: import.meta.env.DEV,
      projectId: canvas.projectId,
      getContextualCommands: () => context.getContextualCommands({ includeDisabled: true }),
      createContext: () => ({
        dispatch: context.dispatch,
        canvasId: canvas.id,
        canvasTitle: canvas.title,
        goToCanvas,
        projectId: canvas.projectId,
        refreshRoute,
        state: context.getState(),
      }),
    });
  const library$ = useObservable(true);
  const libraryOpen = useValue(library$);
  // Stable, so the memoized rail does not re-render on every canvas state change.
  const closeLibrary = useCallback(() => {
    library$.set(false);
  }, [library$]);
  // HUD surfaces report the rectangles they cover.
  const occluders = useHudOccluders();
  // The minimap starts open and returns its camera space when closed.
  const minimap$ = useObservable(true);
  const minimapOpen = useValue(minimap$);
  const styles = workspace();
  const hotkeyActions = getConnectorHotkeyActions(canvas.projectId);
  const dropPolicy = createCanvasDropPolicy(canvas.projectId);

  useEffect(() => {
    void loadRelations(canvas.projectId);
  }, [canvas.projectId]);

  return (
    <main className={styles.root()}>
      <InfiniteCanvas.Provider store={runtime.store}>
        <InfiniteCanvas.Viewport<WindowKind, CanvasDropPayload>
          tools={tools}
          chrome={CANVAS_CHROME}
          /* A drop policy enables the native drag bridge. */
          dropPolicy={dropPolicy}
          /* Camera commands avoid the full-edge HUD insets. */
          viewportInsets={{
            /* Corner HUD uses viewportOccluders instead of full-edge insets. */
            bottom: BOTTOM_INSET,
            left: libraryOpen ? RAIL_INSET : 0,
            top: TOP_INSET,
          }}
          /* Each HUD surface reports its covered rectangle. */
          viewportOccluders={occluders}
          /* Consumer hotkeys extend the canvas keymap. */
          hotkeyActions={hotkeyActions}
          // Settled connectors draw below windows.
          renderUnderlay={() => <ConnectorLayer projectId={canvas.projectId} />}
          /* The compositor paints under the DOM plane; without WebGPU it mounts nothing. */
          sceneSurface={InfiniteCanvasCompositorSurface}
          spatialTargetResolvers={[
            createInfiniteCanvasEdgeTargetResolver<WindowKind>({
              id: "note-relations",
              targets: (context) =>
                getConnectorEdgeTargets(context.state, relations$[canvas.projectId].peek() ?? []),
            }),
          ]}
          /* The dock restores minimized windows. Other duplicate controls stay hidden. */
          hud={{
            cameraControls: true,
            minimizedDock: true,
            pointerModeControls: false,
            statusCard: false,
            zoomControls: true,
          }}
          /* Tab groups omit duplicate labels. Named and split groups keep labels. */
          groupLabel={({ group, windows }) =>
            group.title === null && group.tree.kind === "container" && group.tree.layout !== "split"
              ? ""
              : getInfiniteCanvasGroupTitle(group, windows)
          }
          renderOverlay={(context) => (
            <>
              {/* Shown only before the project holds its first item. */}
              <EmptyProjectInvitation
                projectId={canvas.projectId}
                onCreate={() => {
                  void openNewNote({
                    dispatch: context.dispatch,
                    projectId: canvas.projectId,
                    state: context.state,
                  });
                }}
              />
              {/* The active connector draft draws above windows. */}
              <ConnectorDraft projectId={canvas.projectId} />
              {/* This component registers WebMCP tools and renders nothing. */}
              <CanvasHud
                commandPalette={<CommandPalette projectId={canvas.projectId} />}
                conflict={
                  saveError?.name === "CanvasRevisionConflictError" ? (
                    <CanvasConflictNotice
                      canvasTitle={canvas.title}
                      store={runtime.store}
                      projectId={canvas.projectId}
                    />
                  ) : null
                }
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
                /* Hidden until two connected notes exist, because nothing else has an order. */
                tour={<TourControl projectId={canvas.projectId} />}
                library={
                  libraryOpen ? (
                    <LibraryRail onCollapse={closeLibrary} projectId={canvas.projectId} />
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
                    saveStatus$={runtime.saveStatus$}
                    title={canvas.title}
                  />
                }
              />
            </>
          )}
          title={canvas.title}
        />
      </InfiniteCanvas.Provider>
    </main>
  );
}
