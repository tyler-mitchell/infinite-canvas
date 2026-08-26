import {
  focusInfiniteCanvasCommandSurface,
  getInfiniteCanvasContextualCommands,
  getInfiniteCanvasWindowPresence,
  useInfiniteCanvasActions,
  useInfiniteCanvasDesktopPortalRoot,
  useInfiniteCanvasState,
  type InfiniteCanvasCommandGroup,
} from "@hyphened/infinite-canvas";
import { useObservable, useValue } from "@legendapp/state/react";
import { createHotkeyHandler, formatForDisplay } from "@tanstack/hotkeys";
import { useNavigate } from "@tanstack/react-router";
import {
  Ban,
  Columns3,
  CornerDownLeft,
  CornerUpRight,
  FilePlus2,
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
  Trash2,
  Undo2,
  Unlink2,
} from "lucide-react";
import { useEffect, type ComponentType, type ReactNode } from "react";
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

import { initialLayout } from "../canvas/canvas-document";
import { getSelectedRelations } from "../canvas/connector-geometry";
import type { WindowKind } from "../canvas/window-registry";
import type { CanvasSummary, NoteRecord, ProjectSummary } from "../database/database.client";
import * as database from "../database/operations";
import { openNewNote, openNoteWindow } from "../notes/open-note";
import { connectNotes, disconnectNotes, findRelation, relations$ } from "../notes/relations";

/**
 * One surface over three vocabularies: the windows on this canvas, what Polkadot can do, and what
 * the canvas can do right now.
 *
 * The canvas half is read from the framework rather than restated — `getInfiniteCanvasContextualCommands`
 * carries label, description, hotkeys, group, and enablement against live state, and
 * `getInfiniteCanvasWindowPresence` enumerates windows for navigation.
 *
 * `cmdk` owns filtering, ranking, roving focus, and the listbox roles; the Base UI dialog owns
 * modality and focus restore.
 */

const PALETTE_HOTKEY = "Mod+K";

/**
 * The dialog restores focus to whatever opened it, and a hotkey is not an element — so without
 * this, focus lands on `<body>` where every canvas shortcut is dead and nothing says why.
 *
 * A document query rather than the framework's `focusInfiniteCanvasCommandSurfaceFrom`, which
 * walks up from an element inside the canvas: this dialog is portalled to `<body>`, so at the
 * moment it closes there is no such element to walk from. Chrome that lives *in* the canvas — the
 * library rail — uses the framework verb instead.
 */
const returnFocusToCanvas = () => {
  focusInfiniteCanvasCommandSurface(
    document.querySelector<HTMLElement>("[data-infinite-canvas-command-scope='surface']"),
  );
};

/**
 * Substring, not fuzzy.
 *
 * cmdk's default scorer matches subsequences, so "undo" surfaced "Nudge Left", "Dock Up", and
 * "Focus Down" — every word containing u, n, d, o in order. Requiring each term to appear whole
 * costs nothing and stops the list from arguing with you. Earlier matches rank higher.
 */
const matchCommand = (value: string, search: string) => {
  const haystack = value.toLowerCase();
  const terms = search.toLowerCase().split(/\s+/).filter(Boolean);

  if (terms.length === 0) {
    return 1;
  }

  if (!terms.every((term) => haystack.includes(term))) {
    return 0;
  }

  return 1 / (1 + Math.min(...terms.map((term) => haystack.indexOf(term))));
};

/**
 * What a row is searchable by, with its own title always first.
 *
 * Rows used to carry a hand-written bag of synonyms as their whole search value, and nothing made
 * that bag contain the words printed on the row. "Cut the selected connection" was searchable as
 * "cut disconnect unlink connection edge", so typing the label you were reading returned "Nothing
 * matches that" — the one query a palette must never fail. Callers now supply only the synonyms
 * they want *added*; they cannot forget the title because they never write it.
 *
 * Title first also ranks it, since `matchCommand` scores by earliest match: a hit on what is
 * displayed beats a hit on a synonym.
 */
const searchValue = (parts: readonly (string | undefined)[]) => parts.filter(Boolean).join(" ");

/** The framework groups every command; the glyph follows that rather than being decoration. */
const GROUP_ICON: Record<InfiniteCanvasCommandGroup, ComponentType> = {
  canvas: Frame,
  edit: Undo2,
  selection: MousePointerSquareDashed,
  view: Move3d,
  window: SquareStack,
};

const palette = tv({
  slots: {
    description: "truncate text-[12px] text-[var(--ink-faint)]",
    footerHint: "flex items-center gap-1.5 text-[11px] text-[var(--ink-faint)]",
    footerIcon: "size-3",
    footerKey:
      "grid h-4 min-w-4 place-items-center rounded bg-[var(--surface-hover)] px-1 font-mono text-[10px] text-[var(--ink-muted)]",
    key: "grid h-5 min-w-5 place-items-center rounded-[5px] bg-[var(--surface-hover)] px-1.5 font-mono text-[10px] text-[var(--ink-muted)]",
    // `command-item-icon` is the hook Polkadot's stylesheet tints on the selected row.
    tile: "grid size-6 shrink-0 place-items-center rounded-[7px] bg-[var(--surface)] text-[var(--ink-faint)] transition-colors duration-100 [&_svg]:size-3.5",
    title: "shrink-0 text-[13px] text-[var(--ink)]",
    titleRow: "flex min-w-0 flex-1 items-baseline gap-2",
  },
});

export function CommandPalette({ projectId }: Readonly<{ projectId: string }>) {
  const isOpen$ = useObservable(false);
  const isOpen = useValue(isOpen$);

  useEffect(() => {
    const handleKeyDown = createHotkeyHandler(PALETTE_HOTKEY, (event) => {
      event.preventDefault();
      isOpen$.set(!isOpen$.peek());
    });

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen$]);

  const close = () => {
    isOpen$.set(false);
    returnFocusToCanvas();
  };
  const portalRoot = useInfiniteCanvasDesktopPortalRoot();

  return (
    <CommandDialog
      /*
       * Into the canvas's own portal root, not `<body>`.
       *
       * The framework's HUD band sits at a z-index of one billion, and Base UI portals a dialog to
       * `<body>` at 50 — so the palette opened *underneath* the library rail, with its left half
       * hidden behind an opaque panel. The desktop portal root exists for exactly this and says so:
       * "overlays that should escape the window entirely mount here: command palettes, modals, drag
       * ghosts." Bidding the dialog's z-index up against the framework's would have been a guess
       * that breaks the next time the band moves.
       */
      container={portalRoot}
      description="Search windows, actions, and canvas commands"
      filter={matchCommand}
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
      {/* Mounted only while open. `useInfiniteCanvasState` re-renders on every camera tick, and a
          palette nobody opened has no business reconciling while the user pans. */}
      {isOpen ? <PaletteContent onClose={close} projectId={projectId} /> : null}
    </CommandDialog>
  );
}

function Row({
  description,
  icon: Icon,
  keys,
  keywords,
  onSelect,
  title,
  trailing,
}: Readonly<{
  description?: string;
  icon: ComponentType;
  keys?: readonly string[];
  /** Words to find this row by *beyond* what it displays. The title is always searchable. */
  keywords?: string;
  onSelect: () => void;
  title: string;
  trailing?: ReactNode;
}>) {
  const styles = palette();

  return (
    <CommandItem onSelect={onSelect} value={searchValue([title, description, keywords])}>
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
  projectId,
}: Readonly<{ onClose: () => void; projectId: string }>) {
  const state = useInfiniteCanvasState<WindowKind>();
  const actions = useInfiniteCanvasActions<WindowKind>();
  const navigate = useNavigate();
  const canvases$ = useObservable<readonly CanvasSummary[]>([]);
  const projectList$ = useObservable<readonly ProjectSummary[]>([]);
  const notes$ = useObservable<readonly NoteRecord[]>([]);
  const query$ = useObservable("");
  const notes = useValue(notes$);
  const relations = useValue(relations$);
  const canvases = useValue(canvases$);
  const projectList = useValue(projectList$);
  const query = useValue(query$);
  const styles = palette();
  const windows = getInfiniteCanvasWindowPresence(state).windows;
  const activeWindow = windows.find((window) => window.isActive);
  const contextual = getInfiniteCanvasContextualCommands(state);
  const available = contextual.filter((command) => command.enabled);
  const unavailable = contextual.filter((command) => !command.enabled);

  // Loaded on open, which is the only time this component exists.
  useEffect(() => {
    void database.canvases.list(projectId).then((records) => {
      canvases$.set(records);
    });
    void database.projects.list().then((records) => {
      projectList$.set(records);
    });
    void database.notes.list(projectId).then((records) => {
      notes$.set(records);
    });
  }, [canvases$, notes$, projectId, projectList$]);

  /**
   * Notes with no window on this canvas.
   *
   * Closing the last window on a note does not delete it — the note is a record, the window was a
   * view of it — but until this, nothing could reach one again, so a note quietly became invisible
   * while staying in the database forever. The ones already on the canvas are omitted because they
   * appear above under Windows, where selecting them navigates rather than duplicates.
   */
  const openNoteIds = new Set(
    state.windows
      .map((window) => (window.data as { noteId?: string } | undefined)?.noteId)
      .filter((noteId) => noteId !== undefined),
  );
  const closedNotes = notes.filter((note) => !openNoteIds.has(note.id));

  /**
   * Connecting from the selection, which is the keyboard's way in.
   *
   * Dragging between two notes is the direct gesture and is what most people will use; this stays
   * because it is the only route that needs no pointer at all, and because selecting two windows is
   * something the canvas already does.
   */
  const selectedNoteIds = state.selection.windowIds
    .map(
      (windowId) =>
        (
          state.windows.find((window) => window.id === windowId)?.data as
            | { noteId?: string }
            | undefined
        )?.noteId,
    )
    .filter((noteId): noteId is string => noteId !== undefined);
  const connectedPair =
    selectedNoteIds.length === 2 &&
    selectedNoteIds[0] !== undefined &&
    selectedNoteIds[1] !== undefined
      ? findRelation(relations, selectedNoteIds[0], selectedNoteIds[1])
      : undefined;

  /*
   * A connector the pointer selected, which is a different question from two selected windows.
   *
   * Derived in `connector-geometry` rather than here, because the Backspace action asks the same
   * question and the two must not be able to answer it differently.
   */
  const selectedRelations = getSelectedRelations(state.selection, relations);

  const run = (perform: () => void) => () => {
    perform();
    onClose();
  };

  const openCanvas = (canvasId: string) => {
    void navigate({ params: { canvasId }, to: "/canvas/$canvasId" });
  };

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

        {windows.length === 0 ? null : (
          <CommandGroup heading="Windows">
            {windows.map((window) => (
              <Row
                icon={Frame}
                key={window.id}
                onSelect={run(() => {
                  actions.executeCommand({ type: "window.reveal", windowId: window.id });
                })}
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
                  openNoteWindow({ actions, noteId: note.id, state, title: note.title });
                })}
                keywords="note"
                title={note.title}
              />
            ))}
          </CommandGroup>
        )}

        {/* The surface the framework said was missing: `workspace.create` and `workspace.enter`
            are parameterized because a palette cannot invent which desktop, so this supplies the
            id. Desktops are subsets of one canvas, each remembering its own camera. */}
        {state.workspaces.length === 0 ? null : (
          <CommandGroup heading="Desktops">
            {state.workspaces.map((workspace) => (
              <Row
                icon={LayoutGrid}
                key={workspace.id}
                onSelect={run(() => {
                  actions.executeCommand({ type: "workspace.enter", workspaceId: workspace.id });
                })}
                keywords="desktop"
                title={workspace.title}
                trailing={
                  workspace.id === state.activeWorkspaceId ? (
                    <span className={styles.description()}>here</span>
                  ) : null
                }
              />
            ))}
            {/* A desktop you can make and enter but cannot put anything on is a desktop that stays
                empty. `workspace.moveActiveWindow` is parameterized like the rest, so the row
                carries the id — and the ones already holding this window are left out, since
                sending it where it is does nothing. */}
            {activeWindow === undefined
              ? null
              : state.workspaces
                  .filter((workspace) => !workspace.windowIds.includes(activeWindow.id))
                  .map((workspace) => (
                    <Row
                      icon={CornerUpRight}
                      key={`send-${workspace.id}`}
                      onSelect={run(() => {
                        actions.executeCommand({
                          type: "workspace.moveActiveWindow",
                          workspaceId: workspace.id,
                        });
                      })}
                      keywords="move window desktop"
                      title={`Send “${activeWindow.title}” to ${workspace.title}`}
                    />
                  ))}
            {state.activeWorkspaceId === null ? null : (
              <Row
                icon={Trash2}
                onSelect={run(() => {
                  actions.executeCommand({
                    type: "workspace.close",
                    workspaceId: state.activeWorkspaceId ?? "",
                  });
                })}
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
                  openCanvas(canvas.id);
                })}
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
                  // A project is entered through its most recent canvas, the same rule `/` uses.
                  void database.canvases.list(project.id).then(([first]) => {
                    if (first !== undefined) {
                      openCanvas(first.id);
                    }
                  });
                })}
                keywords="project"
                title={project.title}
              />
            ))}
          </CommandGroup>
        )}

        <CommandGroup heading="Actions">
          <Row
            icon={FilePlus2}
            onSelect={run(() => {
              void openNewNote({ actions, projectId, state });
            })}
            keywords="create"
            title="New note"
          />
          <Row
            icon={Columns3}
            onSelect={run(() => {
              void database.canvases
                .create({
                  layout: initialLayout,
                  projectId,
                  title: `Canvas ${canvases.length + 1}`,
                })
                .then((created) => {
                  openCanvas(created.id);
                });
            })}
            keywords="create"
            title="New canvas"
          />
          {selectedRelations.length === 0 ? null : (
            <Row
              icon={Unlink2}
              // The row is where you learn the key exists. A shortcut only reachable by pressing it
              // is a shortcut for the person who wrote it.
              keys={["⌫"]}
              onSelect={run(() => {
                for (const relation of selectedRelations) {
                  void disconnectNotes({
                    projectId,
                    source: relation.source,
                    target: relation.target,
                  });
                }
              })}
              keywords="disconnect unlink edge relation"
              title={
                selectedRelations.length === 1
                  ? "Cut the selected connection"
                  : `Cut ${String(selectedRelations.length)} selected connections`
              }
            />
          )}
          {selectedNoteIds.length === 2 ? (
            <Row
              icon={connectedPair === undefined ? Link2 : Unlink2}
              onSelect={run(() => {
                const [source, target] = selectedNoteIds;

                if (source === undefined || target === undefined) {
                  return;
                }

                void (connectedPair === undefined
                  ? connectNotes({ projectId, source, target })
                  : disconnectNotes({ projectId, source, target }));
              })}
              keywords={
                connectedPair === undefined ? "relate link edge" : "unrelate unlink cut edge"
              }
              title={
                connectedPair === undefined
                  ? "Connect the two selected notes"
                  : "Disconnect the two selected notes"
              }
            />
          ) : null}
          <Row
            icon={LayoutGrid}
            onSelect={run(() => {
              actions.executeCommand({
                title: `Desktop ${state.workspaces.length + 1}`,
                type: "workspace.create",
                workspaceId: globalThis.crypto.randomUUID(),
              });
            })}
            keywords="workspace create"
            title="New desktop"
          />
          <Row
            icon={FolderPlus}
            onSelect={run(() => {
              void database.projects
                .create({ layout: initialLayout, title: `Project ${projectList.length + 1}` })
                .then((created) => {
                  openCanvas(created.id);
                });
            })}
            keywords="create"
            title="New project"
          />
        </CommandGroup>

        <CommandGroup heading="Canvas">
          {available.map((command) => (
            <Row
              description={command.description}
              icon={GROUP_ICON[command.group]}
              key={command.id}
              keys={command.hotkeys.map((hotkey) => formatForDisplay(hotkey))}
              keywords={command.id}
              onSelect={run(() => {
                actions.executeCommand(command.command);
              })}
              title={command.label}
            />
          ))}
        </CommandGroup>

        {/* Greyed and inert, and only once something has been typed. Hiding them entirely would
            make the palette lie about what the canvas can do, and letting you run them would make
            it lie about what it can do now — but on an empty query most commands are unavailable,
            and seventy inert rows under your results is padding rather than teaching. */}
        {query.trim() === "" || unavailable.length === 0 ? null : (
          <CommandGroup heading="Unavailable right now">
            {unavailable.map((command) => (
              <CommandItem
                disabled
                key={command.id}
                value={searchValue([command.label, command.description, command.id])}
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
