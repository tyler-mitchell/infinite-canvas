import {
  focusInfiniteCanvasCommandSurface,
  getInfiniteCanvasContextualCommands,
  getInfiniteCanvasWindowPresence,
  useInfiniteCanvasActions,
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

/** The dialog restores focus to whatever opened it, and a hotkey is not an element — so without
 * this, focus lands on `<body>` where every canvas shortcut is dead and nothing says why. */
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

  return (
    <CommandDialog
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
  onSelect,
  title,
  trailing,
  value,
}: Readonly<{
  description?: string;
  icon: ComponentType;
  keys?: readonly string[];
  onSelect: () => void;
  title: string;
  trailing?: ReactNode;
  value: string;
}>) {
  const styles = palette();

  return (
    <CommandItem onSelect={onSelect} value={value}>
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
   * Connecting works on the selection, not on a new gesture.
   *
   * Selecting two windows is something the canvas already does, so the first way to author an edge
   * costs no new interaction. Drag-to-connect is a gesture sprint of its own.
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
                  // A minimized window has no rect to fly to, so restore before navigating.
                  if (window.mode === "minimized") {
                    actions.restoreWindow(window.id);
                  }

                  actions.focusWindow(window.id);
                  actions.navigateToWindow({ windowId: window.id });
                })}
                title={window.title}
                trailing={
                  window.isActive ? <span className={styles.description()}>active</span> : null
                }
                value={`window ${window.title} ${window.kind}`}
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
                title={note.title}
                value={`note ${note.title}`}
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
                title={workspace.title}
                trailing={
                  workspace.id === state.activeWorkspaceId ? (
                    <span className={styles.description()}>here</span>
                  ) : null
                }
                value={`desktop ${workspace.title}`}
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
                title="Close this desktop"
                value="close remove desktop workspace"
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
                title={canvas.title}
                value={`canvas ${canvas.title}`}
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
                title={project.title}
                value={`project ${project.title}`}
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
            title="New note"
            value="new note create"
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
            title="New canvas"
            value="new canvas create"
          />
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
              title={
                connectedPair === undefined
                  ? "Connect the two selected notes"
                  : "Disconnect the two selected notes"
              }
              value={
                connectedPair === undefined
                  ? "connect relate link notes"
                  : "disconnect unrelate unlink notes"
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
            title="New desktop"
            value="new desktop workspace create"
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
            title="New project"
            value="new project create"
          />
        </CommandGroup>

        <CommandGroup heading="Canvas">
          {available.map((command) => (
            <Row
              description={command.description}
              icon={GROUP_ICON[command.group]}
              key={command.id}
              keys={command.hotkeys.map((hotkey) => formatForDisplay(hotkey))}
              onSelect={run(() => {
                actions.executeCommand(command.command);
              })}
              title={command.label}
              value={`${command.label} ${command.description} ${command.id}`}
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
              <CommandItem disabled key={command.id} value={`${command.label} ${command.id}`}>
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
          <Search className="size-3" />
          {windows.length + available.length + 1}
        </span>
      </CommandFooter>
    </>
  );
}
