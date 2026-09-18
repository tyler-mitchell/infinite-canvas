import {
  findInfiniteCanvasWindow,
  focusInfiniteCanvasCommandSurface,
  getInfiniteCanvasContextualEntries,
  getInfiniteCanvasGroupTitle,
  getInfiniteCanvasWindowGroup,
  getInfiniteCanvasWindowPresence,
  useInfiniteCanvasDispatch,
  useInfiniteCanvasDesktopPortalRoot,
  useInfiniteCanvasState,
  useInfiniteCanvasStore,
  type InfiniteCanvasCommandGroup,
  type InfiniteCanvasContextualEntry,
  getSelectedWindowIds,
} from "@hyphened/infinite-canvas";
import type { Observable } from "@legendapp/state";
import { useObservable, useValue } from "@legendapp/state/react";
import { createHotkeyHandler, formatForDisplay } from "@tanstack/hotkeys";
import { useLoaderData } from "@tanstack/react-router";
import {
  Archive,
  Ban,
  Columns3,
  CornerDownLeft,
  CornerUpRight,
  Eraser,
  FileText,
  FolderOpen,
  FolderPlus,
  Frame,
  LayoutGrid,
  Link2,
  MousePointerSquareDashed,
  Move3d,
  Search,
  SquareStack,
  Tag,
  Trash2,
  Undo2,
  Unlink2,
} from "lucide-react";
import { useCallback, useEffect, type ComponentType, type ReactNode } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandFooter,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "ui";
import { tv } from "ui/tv";

import { getSearchTerms, matchesSearchTerms } from "../text-search";
import { getActionIcon } from "./action-icons";
import { getConnectorHotkeyActions } from "../canvas/connector-hotkeys";
import { getSelectedRelations } from "../canvas/connector-geometry";
import { createCanvas } from "../workspace/create-canvas";
import { createDesktop } from "../workspace/create-desktop";
import { createProject } from "../workspace/create-project";
import { useGoToCanvas } from "../workspace/use-go-to-canvas";
import { useRefreshRoute } from "../workspace/use-refresh-route";
import { getProjectEntryCanvas } from "../projects/enter-project";
import { getContentWindowItemId, type WindowKind } from "../canvas/window-registry";
import type {
  CanvasSummary,
  ContentItemRecord,
  ContentRelation,
  ProjectSummary,
} from "../database/database.client";
import { APP_ACTIONS, getAppAction, isAppActionEnabled } from "../app-actions";
import * as database from "../database/operations";
import { openNoteWindow } from "../notes/open-note";
import { renameProjectItem } from "../content/rename-item";
import {
  archiveProjectItem,
  getProjectContentOfKind,
  loadProjectContent,
  projectContent$,
} from "../content/project-content";
import { undoableAction$, undoLastAction } from "../content/undoable-action";
import { recentNoteIds$, rememberNote } from "../notes/recent-notes";
import {
  connectItems,
  DEFAULT_RELATION_KIND,
  disconnectItems,
  findRelation,
  getRelationLabel,
  RELATION_KINDS,
  relations$,
  setRelationKind,
  setRelationLabel,
} from "../relations/relation-store";

const PALETTE_HOTKEY = "Mod+K";

const returnFocusToCanvas = () => {
  focusInfiniteCanvasCommandSurface(
    document.querySelector<HTMLElement>("[data-infinite-canvas-command-scope='surface']"),
  );
};

const matchCommand = (value: string, search: string, keywords?: readonly string[]) => {
  const haystack = (keywords ?? [value]).join(" ").toLowerCase();
  const terms = getSearchTerms(search);

  if (terms.length === 0) {
    return 1;
  }

  if (!matchesSearchTerms(haystack, terms)) {
    return 0;
  }

  return 1 / (1 + Math.min(...terms.map((term) => haystack.indexOf(term))));
};

const searchWords = (parts: readonly (string | undefined)[]) =>
  parts.filter((part): part is string => part !== undefined && part !== "");

type PalettePage =
  | Readonly<{ groupId: string; kind: "group"; title: string }>
  | Readonly<{ kind: "label"; relation: ContentRelation }>
  | Readonly<{ kind: "rename"; note: ContentItemRecord }>;

const GROUP_ICON: Record<InfiniteCanvasCommandGroup, ComponentType> = {
  component: Frame,
  canvas: Frame,
  edit: Undo2,
  selection: MousePointerSquareDashed,
  view: Move3d,
  window: SquareStack,
};

const entryIcon = (entry: InfiniteCanvasContextualEntry): ComponentType =>
  entry.group === undefined ? Unlink2 : GROUP_ICON[entry.group];

const palette = tv({
  slots: {
    description: "truncate text-[12px] text-[var(--ink-faint)]",
    footerHint: "flex items-center gap-1.5 text-[11px] text-[var(--ink-faint)]",
    footerIcon: "size-3",
    footerKey:
      "grid h-4 min-w-4 place-items-center rounded bg-[var(--surface-hover)] px-1 font-mono text-[10px] text-[var(--ink-muted)]",
    key: "grid h-5 min-w-5 place-items-center rounded-[5px] bg-[var(--surface-hover)] px-1.5 font-mono text-[10px] text-[var(--ink-muted)]",
    tile: "grid size-6 shrink-0 place-items-center rounded-[7px] bg-[var(--surface)] text-[var(--ink-faint)] transition-colors duration-100 [&_svg]:size-3.5",
    title: "shrink-0 text-[13px] text-[var(--ink)]",
    titleRow: "flex min-w-0 flex-1 items-baseline gap-2",
  },
});

export function CommandPalette({ projectId }: Readonly<{ projectId: string }>) {
  const isOpen$ = useObservable(false);
  const isOpen = useValue(isOpen$);
  const page$ = useObservable<PalettePage | null>(null);
  const page = useValue(page$);

  const close = useCallback(() => {
    isOpen$.set(false);
    page$.set(null);
    returnFocusToCanvas();
  }, [isOpen$, page$]);

  useEffect(() => {
    const handleKeyDown = createHotkeyHandler(PALETTE_HOTKEY, (event) => {
      event.preventDefault();

      if (isOpen$.peek()) {
        close();

        return;
      }

      isOpen$.set(true);
    });

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [close, isOpen$]);
  const portalRoot = useInfiniteCanvasDesktopPortalRoot();

  return (
    <CommandDialog
      container={portalRoot}
      description="Search windows, actions, and canvas commands"
      filter={page === null ? matchCommand : () => 1}
      onOpenChange={(open) => {
        if (open) {
          isOpen$.set(true);
        } else {
          close();
        }
      }}
      open={isOpen}
      title="Command palette"
    >
      {isOpen ? <PaletteContent onClose={close} page$={page$} projectId={projectId} /> : null}
    </CommandDialog>
  );
}

function Row({
  description,
  disabled,
  icon: Icon,
  id,
  keys,
  keywords,
  onSelect,
  title,
  trailing,
}: Readonly<{
  description?: string;
  disabled?: boolean;
  icon: ComponentType;
  id: string;
  keys?: readonly string[];
  keywords?: string;
  onSelect: () => void;
  title: string;
  trailing?: ReactNode;
}>) {
  const styles = palette();

  return (
    <CommandItem
      disabled={disabled}
      keywords={searchWords([title, description, keywords])}
      onSelect={onSelect}
      value={id}
    >
      <span className={styles.tile()} data-slot="command-item-icon">
        <Icon />
      </span>
      <span className={styles.titleRow()}>
        <span className={styles.title()}>{title}</span>
        {description === undefined ? null : (
          <span className={styles.description()}>{description}</span>
        )}
      </span>
      {keys === undefined || keys.length === 0 ? (
        trailing
      ) : (
        <CommandShortcut>
          {keys.map((key) => (
            <kbd className={styles.key()} key={key}>
              {key}
            </kbd>
          ))}
        </CommandShortcut>
      )}
    </CommandItem>
  );
}

function PaletteContent({
  onClose,
  page$,
  projectId,
}: Readonly<{
  onClose: () => void;
  page$: Observable<PalettePage | null>;
  projectId: string;
}>) {
  const page = useValue(page$);
  const state = useInfiniteCanvasState<WindowKind>();
  const store = useInfiniteCanvasStore<WindowKind>();
  const dispatch = useInfiniteCanvasDispatch<WindowKind>();
  const canvases$ = useObservable<readonly CanvasSummary[]>([]);
  const projectList$ = useObservable<readonly ProjectSummary[]>([]);
  const projectListing = useValue(projectContent$[projectId]);
  const query$ = useObservable("");
  const notes = getProjectContentOfKind({ kind: "note", listing: projectListing, projectId }) ?? [];
  const relations = useValue(relations$[projectId]) ?? [];
  const undoableAction = useValue(undoableAction$);
  const canvases = useValue(canvases$);
  const projectList = useValue(projectList$);
  const query = useValue(query$);
  const styles = palette();
  const connectionSubject = ((selected) => {
    const itemId = getContentWindowItemId(selected);

    return selected === null || itemId === null ? undefined : { itemId, title: selected.title };
  })(
    getSelectedWindowIds(state.selection).length === 1
      ? findInfiniteCanvasWindow(state, getSelectedWindowIds(state.selection)[0] ?? "")
      : null,
  );
  const windows = getInfiniteCanvasWindowPresence(state).windows;
  const activeWindow = windows.find((window) => window.isActive);
  const contextual = getInfiniteCanvasContextualEntries(state, {
    commands: store.getContextualCommands({ includeDisabled: true }),
    dispatch,
    hotkeyActions: getConnectorHotkeyActions(projectId),
  });
  const available = contextual.filter((command) => command.enabled);
  const unavailable = contextual.filter((command) => !command.enabled);

  useEffect(() => {
    void database.canvases.list(projectId).then((records) => {
      canvases$.set(records);
    });
    void database.projects.list().then((records) => {
      projectList$.set(records);
    });
    void loadProjectContent(projectId);
  }, [canvases$, projectId, projectList$]);

  const openNoteIds = new Set(
    state.windows
      .map((window) => getContentWindowItemId(window))
      .filter((itemId) => itemId !== null),
  );
  const recentIds = new Set(useValue(recentNoteIds$));
  const noteIdByWindowId = new Map(
    state.windows.flatMap((window) => {
      const itemId = getContentWindowItemId(window);

      return itemId === null ? [] : [[window.id, itemId] as const];
    }),
  );
  const isBrowsing = query.trim() === "";
  const closedNotes = notes
    .filter((note) => !openNoteIds.has(note.id))
    .filter((note) => !(isBrowsing && recentIds.has(note.id)));

  const visibleWindows = windows.filter((window) => {
    const noteId = noteIdByWindowId.get(window.id);

    return !(isBrowsing && noteId !== undefined && recentIds.has(noteId));
  });

  const recentNotes = isBrowsing
    ? [...recentIds]
        .map((noteId) => notes.find((note) => note.id === noteId))
        .filter((note) => note !== undefined)
    : [];

  const reachNote = (note: Readonly<{ id: string; title: string }>) => {
    rememberNote(note.id);
    openNoteWindow({ dispatch, noteId: note.id, state, title: note.title });
  };

  const activeStateWindow =
    state.activeWindowId === null ? null : findInfiniteCanvasWindow(state, state.activeWindowId);
  const activeNoteId = getContentWindowItemId(activeStateWindow) ?? undefined;
  const activeNote = notes.find((note) => note.id === activeNoteId);
  const activeGroup =
    state.activeWindowId === null
      ? undefined
      : getInfiniteCanvasWindowGroup(state, state.activeWindowId);

  const selectedNoteIds = getSelectedWindowIds(state.selection)
    .map((windowId) => {
      return getContentWindowItemId(findInfiniteCanvasWindow(state, windowId));
    })
    .filter((itemId): itemId is string => itemId !== null);
  const connectedPair =
    selectedNoteIds.length === 2 &&
    selectedNoteIds[0] !== undefined &&
    selectedNoteIds[1] !== undefined
      ? findRelation(relations, selectedNoteIds[0], selectedNoteIds[1])
      : undefined;
  const connectionClaim = connectedPair === undefined ? undefined : getRelationLabel(connectedPair);
  const disconnectPairTitle =
    connectionClaim === undefined
      ? "Disconnect the two selected notes"
      : `Disconnect the two selected notes — loses “${connectionClaim}”`;

  const selectedRelations = getSelectedRelations(state.selection, relations);

  const run = (perform: () => void) => () => {
    perform();
    onClose();
  };

  const openCanvas = useGoToCanvas();
  const refreshRoute = useRefreshRoute();
  const canvas = useLoaderData({ from: "/canvas/$canvasId" });

  if (page !== null) {
    const draft = query.trim();
    const spec =
      page.kind === "group"
        ? {
            commit: () => {
              dispatch({ groupId: page.groupId, title: draft, type: "group.setTitle" });
            },
            enabled: true,
            heading: "Group",
            icon: draft === "" ? Eraser : SquareStack,
            placeholder: "What is this group called?",
            title: draft === "" ? "Clear the name back to “Group”" : `Name this group “${draft}”`,
          }
        : page.kind === "label"
          ? {
              commit: () => {
                void setRelationLabel({ label: draft, projectId, relationId: page.relation.id });
              },
              enabled: true,
              heading: `Connection · ${page.relation.kind}`,
              icon: draft === "" ? Eraser : Tag,
              placeholder: "What does this connection say?",
              title:
                draft === ""
                  ? `Clear the label, leaving “${page.relation.kind}”`
                  : `Label this connection “${draft}”`,
            }
          : {
              commit: () => {
                void renameProjectItem({ dispatch, item: page.note, state, title: draft });
              },
              enabled: draft !== "",
              heading: "Note",
              icon: FileText,
              placeholder: "What is this note called?",
              title: draft === "" ? "A note needs a name" : `Rename to “${draft}”`,
            };

    return (
      <>
        <CommandInput
          autoFocus
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              page$.set(null);
              query$.set("");
            }
          }}
          onValueChange={(value) => {
            query$.set(value);
          }}
          placeholder={spec.placeholder}
          value={query}
        />
        <CommandList>
          <CommandGroup heading={spec.heading}>
            <Row
              disabled={!spec.enabled}
              icon={spec.icon}
              id="page-commit"
              onSelect={run(() => {
                spec.commit();
                page$.set(null);
                query$.set("");
              })}
              title={spec.title}
            />
          </CommandGroup>
        </CommandList>
        <CommandFooter>
          <span className={styles.footerHint()}>
            <kbd className={styles.footerKey()}>
              <CornerDownLeft />
            </kbd>
            Save
          </span>
          <span className={styles.footerHint()}>
            <kbd className={styles.footerKey()}>esc</kbd>
            Back
          </span>
        </CommandFooter>
      </>
    );
  }

  return (
    <>
      <CommandInput
        autoFocus
        onValueChange={(value) => {
          query$.set(value);
        }}
        placeholder="Search windows, actions, and commands…"
        value={query}
      />
      <CommandList>
        <CommandEmpty>Nothing matches that.</CommandEmpty>

        {recentNotes.length === 0 ? null : (
          <CommandGroup heading="Recent">
            {recentNotes.map((note) => (
              <Row
                icon={FileText}
                key={note.id}
                id={note.id}
                keywords="recent note"
                onSelect={run(() => {
                  reachNote(note);
                })}
                title={note.title}
                trailing={
                  openNoteIds.has(note.id) ? (
                    <span className={styles.description()}>open</span>
                  ) : null
                }
              />
            ))}
          </CommandGroup>
        )}

        {visibleWindows.length === 0 ? null : (
          <CommandGroup heading="Windows">
            {visibleWindows.map((window) => (
              <Row
                icon={Frame}
                key={window.id}
                onSelect={run(() => {
                  const noteId = noteIdByWindowId.get(window.id);

                  if (noteId !== undefined) {
                    rememberNote(noteId);
                  }

                  dispatch({ type: "window.reveal", windowId: window.id });
                })}
                id={window.id}
                keywords={`window ${window.kind}`}
                title={window.title}
                trailing={
                  window.isActive ? <span className={styles.description()}>active</span> : null
                }
              />
            ))}
          </CommandGroup>
        )}

        {closedNotes.length === 0 ? null : (
          <CommandGroup heading="Notes">
            {closedNotes.map((note) => (
              <Row
                icon={FileText}
                key={note.id}
                onSelect={run(() => {
                  reachNote(note);
                })}
                id={note.id}
                keywords="note"
                title={note.title}
              />
            ))}
          </CommandGroup>
        )}

        {state.workspaces.length === 0 ? null : (
          <CommandGroup heading="Desktops">
            {state.workspaces.map((workspace) => (
              <Row
                icon={LayoutGrid}
                key={workspace.id}
                onSelect={run(() => {
                  dispatch({ type: "workspace.enter", workspaceId: workspace.id });
                })}
                id={workspace.id}
                keywords="desktop"
                title={workspace.title}
                trailing={
                  workspace.id === state.activeWorkspaceId ? (
                    <span className={styles.description()}>here</span>
                  ) : null
                }
              />
            ))}
            {activeWindow === undefined
              ? null
              : state.workspaces
                  .filter((workspace) => !workspace.windowIds.includes(activeWindow.id))
                  .map((workspace) => (
                    <Row
                      icon={CornerUpRight}
                      key={`send-${workspace.id}`}
                      onSelect={run(() => {
                        dispatch({
                          type: "workspace.moveActiveWindow",
                          workspaceId: workspace.id,
                        });
                      })}
                      id={`send-to-${workspace.id}`}
                      keywords="move window desktop"
                      title={`Send “${activeWindow.title}” to ${workspace.title}`}
                    />
                  ))}
            {state.activeWorkspaceId === null ? null : (
              <Row
                icon={Trash2}
                onSelect={run(() => {
                  dispatch({
                    type: "workspace.close",
                    workspaceId: state.activeWorkspaceId ?? "",
                  });
                })}
                id="workspace-close"
                keywords="remove workspace"
                title="Close this desktop"
              />
            )}
          </CommandGroup>
        )}

        {canvases.length < 2 ? null : (
          <CommandGroup heading="Canvases">
            {canvases.map((canvas) => (
              <Row
                icon={Columns3}
                key={canvas.id}
                onSelect={run(() => {
                  void openCanvas({ canvasId: canvas.id });
                })}
                id={canvas.id}
                keywords="canvas"
                title={canvas.title}
              />
            ))}
          </CommandGroup>
        )}

        {projectList.length < 2 ? null : (
          <CommandGroup heading="Projects">
            {projectList.map((project) => (
              <Row
                icon={FolderOpen}
                key={project.id}
                onSelect={run(() => {
                  void getProjectEntryCanvas({
                    openProjectId: projectId,
                    projectId: project.id,
                  }).then((canvasId) => {
                    if (canvasId !== null) {
                      void openCanvas({ canvasId });
                    }
                  });
                })}
                id={project.id}
                keywords="project"
                title={project.title}
              />
            ))}
          </CommandGroup>
        )}

        <CommandGroup heading="Actions">
          {APP_ACTIONS.filter((action) => action.input === undefined).map((action) => {
            const context = {
              dispatch,
              canvasId: canvas.id,
              canvasTitle: canvas.title,
              goToCanvas: openCanvas,
              projectId,
              refreshRoute,
              state,
            };

            return (
              <Row
                description={action.description}
                disabled={!isAppActionEnabled(action, context)}
                icon={getActionIcon(action.id)}
                key={action.id}
                onSelect={run(() => {
                  void action.run(context);
                })}
                id={action.id}
                keywords="create list all"
                title={action.label}
              />
            );
          })}
          {connectionSubject === undefined ? null : (
            <Row
              icon={Link2}
              onSelect={run(() => {
                void getAppAction("collection.create.connectedTo")?.run(
                  {
                    dispatch,
                    canvasId: canvas.id,
                    canvasTitle: canvas.title,
                    goToCanvas: openCanvas,
                    projectId,
                    refreshRoute,
                    state,
                  },
                  { itemId: connectionSubject.itemId },
                );
              })}
              id="new-collection-connected"
              keywords="create list graph related"
              title={`Collection of what “${connectionSubject.title}” connects to`}
            />
          )}
          <Row
            icon={Columns3}
            onSelect={run(() => {
              void createCanvas({ projectId }).then((created) => {
                void openCanvas({ canvasId: created.id });
              });
            })}
            id="new-canvas"
            keywords="create"
            title="New canvas"
          />
          {selectedRelations.length === 0
            ? null
            : RELATION_KINDS.filter(
                (kind) => !selectedRelations.every((relation) => relation.kind === kind),
              ).map((kind) => (
                <Row
                  icon={kind === DEFAULT_RELATION_KIND ? Link2 : Tag}
                  key={kind}
                  id={`relation-kind-${kind}`}
                  keywords="mark kind meaning label edge relation"
                  onSelect={run(() => {
                    for (const relation of selectedRelations) {
                      void setRelationKind({ kind, projectId, relationId: relation.id });
                    }
                  })}
                  title={
                    kind === DEFAULT_RELATION_KIND
                      ? "Clear what this connection says"
                      : `Say this connection ${kind}`
                  }
                />
              ))}
          {activeNote === undefined ? null : (
            <Row
              icon={FileText}
              id="rename-note"
              keywords="rename title name note"
              onSelect={() => {
                page$.set({ kind: "rename", note: activeNote });
                query$.set(activeNote.title);
              }}
              title={`Rename “${activeNote.title}”…`}
            />
          )}
          {activeGroup === undefined || activeGroup === null ? null : (
            <Row
              icon={SquareStack}
              id="rename-group"
              keywords="rename title name group dock"
              onSelect={() => {
                page$.set({
                  groupId: activeGroup.id,
                  kind: "group",
                  title: getInfiniteCanvasGroupTitle(activeGroup, state.windows),
                });
                query$.set(activeGroup.title ?? "");
              }}
              title={
                activeGroup.title === null ? "Name this group…" : `Rename “${activeGroup.title}”…`
              }
            />
          )}
          {undoableAction === null ? null : (
            <Row
              icon={Undo2}
              id="undo-content-action"
              keywords="undo restore back revert mistake"
              onSelect={run(() => {
                void undoLastAction();
              })}
              title={undoableAction.describe}
            />
          )}
          {activeNote === undefined ? null : (
            <Row
              icon={Archive}
              id="archive-note"
              keywords="archive remove delete hide note"
              onSelect={run(() => {
                const windowId = state.windows.find(
                  (window) => getContentWindowItemId(window) === activeNote.id,
                )?.id;

                if (windowId !== undefined) {
                  dispatch({ type: "window.close", windowId });
                }

                void archiveProjectItem({ itemId: activeNote.id, projectId });
              })}
              title={`Archive “${activeNote.title}”`}
            />
          )}
          {selectedRelations.length === 1 && selectedRelations[0] !== undefined ? (
            <Row
              icon={Tag}
              id="label-connection"
              keywords="label name text say describe edge relation"
              onSelect={() => {
                const relation = selectedRelations[0];

                if (relation !== undefined) {
                  page$.set({ kind: "label", relation });
                  query$.set(relation.label ?? "");
                }
              }}
              title="Label this connection…"
            />
          ) : null}
          {selectedNoteIds.length === 2 ? (
            <Row
              icon={connectedPair === undefined ? Link2 : Unlink2}
              onSelect={run(() => {
                const [source, target] = selectedNoteIds;

                if (source === undefined || target === undefined) {
                  return;
                }

                void (connectedPair === undefined
                  ? connectItems({ projectId, source, target })
                  : disconnectItems({ projectId, source, target }));
              })}
              id="connect-selected-notes"
              keywords={
                connectedPair === undefined ? "relate link edge" : "unrelate unlink cut edge"
              }
              title={
                connectedPair === undefined ? "Connect the two selected notes" : disconnectPairTitle
              }
            />
          ) : null}
          <Row
            icon={LayoutGrid}
            onSelect={run(() => {
              createDesktop({
                dispatch,
                existingTitles: state.workspaces.map((workspace) => workspace.title),
              });
            })}
            id="new-desktop"
            keywords="workspace create"
            title="New desktop"
          />
          <Row
            icon={FolderPlus}
            onSelect={run(() => {
              void createProject().then((created) => {
                void openCanvas({ canvasId: created.id });
              });
            })}
            id="new-project"
            keywords="create"
            title="New project"
          />
        </CommandGroup>

        <CommandGroup heading="Canvas">
          {available.map((command) => (
            <Row
              description={command.description}
              icon={entryIcon(command)}
              key={command.id}
              keys={command.hotkeys.map((hotkey) => formatForDisplay(hotkey))}
              id={command.id}
              keywords={command.id}
              onSelect={run(command.run)}
              title={command.label}
            />
          ))}
        </CommandGroup>

        {query.trim() === "" || unavailable.length === 0 ? null : (
          <CommandGroup heading="Unavailable right now">
            {unavailable.map((command) => (
              <CommandItem
                disabled
                key={command.id}
                keywords={searchWords([command.label, command.description, command.id])}
                value={command.id}
              >
                <span className={styles.tile()}>
                  <Ban />
                </span>
                <span className={styles.titleRow()}>
                  <span className={styles.title()}>{command.label}</span>
                  <span className={styles.description()}>{command.description}</span>
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>

      <CommandFooter>
        <span className={styles.footerHint()}>
          <kbd className={styles.footerKey()}>
            <CornerDownLeft />
          </kbd>
          Run
        </span>
        <span className={styles.footerHint()}>
          <kbd className={styles.footerKey()}>↑</kbd>
          <kbd className={styles.footerKey()}>↓</kbd>
          Navigate
        </span>
        <span className={styles.footerHint()}>
          <kbd className={styles.footerKey()}>esc</kbd>
          Close
        </span>
        <span className={styles.footerHint()}>
          <Search className={styles.footerIcon()} />
          {windows.length + available.length + 1}
        </span>
      </CommandFooter>
    </>
  );
}
