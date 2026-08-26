import {
  focusInfiniteCanvasCommandSurfaceFrom,
  useInfiniteCanvasActions,
  useInfiniteCanvasState,
} from "@hyphened/infinite-canvas";
import { useObservable, useValue } from "@legendapp/state/react";
import { ChevronRight, Link2, PanelLeftClose, Plus, Search } from "lucide-react";
import { useEffect } from "react";
import { Button } from "ui";
import { tv } from "ui/tv";

import type { WindowKind } from "../canvas/window-registry";
import type { NoteRecord } from "../database/database.client";
import * as database from "../database/operations";
import { renameNote } from "../notes/note-store";
import { openNewNote, openNoteWindow } from "../notes/open-note";
import { relations$ } from "../notes/relations";

/**
 * Everything in this project, and how it is joined together.
 *
 * The launcher already opens a closed note, so a rail that only listed notes would be a worse
 * palette that is always on screen. Its case is the three things a modal cannot do: browsing
 * without knowing what you want, seeing how notes relate rather than one at a time, and staying
 * put while you work against it.
 *
 * The third one is why this reserves space through `viewportInsets` rather than floating over the
 * canvas. A panel a camera cannot see is a panel the canvas keeps putting windows behind.
 *
 * Composed, not restated: `getInfiniteCanvasWindowPresence` says which notes are already on the
 * canvas, `window.reveal` goes to one wherever it is — including another desktop — and
 * `openNoteWindow` places one that has no window. None of that is re-derived here.
 */

const RAIL_WIDTH = 264;

/** The rail's own width plus the margins its anchor sits in, which is what the camera must avoid. */
const RAIL_INSET = RAIL_WIDTH + 24;

const rail = tv({
  slots: {
    body: "min-h-0 flex-1 overflow-y-auto overscroll-contain px-1.5 pb-1.5",
    /** Indented past the parent's gutter, so a connection reads as belonging to the row above it. */
    connection:
      "flex w-full items-center gap-2 rounded-[var(--radius-sm)] py-1 pr-2 pl-5 text-left text-[12px] text-[var(--ink-muted)] transition-colors duration-100 ease-[var(--ease-swift)] hover:bg-[var(--surface-hover)] hover:text-[var(--ink)]",
    connectionTitle: "min-w-0 truncate",
    /** Sized and weighted exactly like the title it replaces, so committing does not jump. */
    editor:
      "min-w-0 flex-1 rounded-[var(--radius-sm)] bg-[var(--surface-raised)] px-1 py-1.5 text-[12.5px] text-[var(--ink)] outline-none inset-ring-1 inset-ring-[var(--accent)]",
    count:
      "flex shrink-0 items-center gap-1 rounded-[var(--radius-sm)] px-1 py-0.5 font-mono text-[10px] tabular-nums text-[var(--ink-faint)] transition-colors duration-100 ease-[var(--ease-swift)] hover:bg-[var(--surface-raised)] hover:text-[var(--ink-muted)]",
    countIcon: "size-3",
    disclosure:
      "size-3 shrink-0 transition-transform duration-150 ease-[var(--ease-swift)] motion-reduce:transition-none",
    empty: "px-3 py-8 text-center text-[12px] text-[var(--ink-faint)]",
    /**
     * A fixed leading column, whether or not there is a dot in it.
     *
     * Rendering the dot only when a note is open shifted every closed note's title left by the
     * dot plus its gap, so the list had two left edges and read as ragged. The gutter is the
     * column; presence is what happens to be in it.
     */
    gutter: "flex w-2 shrink-0 justify-center",
    header: "flex items-center gap-1 px-1.5 pt-1.5 pb-1",
    heading: "flex-1 pl-1.5 text-[12px] font-medium tracking-[-0.005em] text-[var(--ink-muted)]",
    presence: "size-1.5 rounded-full bg-[var(--accent)]",
    root: "flex w-[264px] flex-col rounded-[var(--radius-lg)] bg-[var(--surface)] shadow-[var(--lift-2)] inset-ring-1 inset-ring-[var(--edge-light)] backdrop-blur-2xl",
    /** The whole row lights up, though the reach target and the disclosure are separate controls. */
    row: "group flex w-full items-center gap-2 rounded-[var(--radius-sm)] pr-1 pl-1.5 transition-colors duration-100 ease-[var(--ease-swift)] hover:bg-[var(--surface-hover)]",
    search:
      "min-w-0 flex-1 bg-transparent text-[12px] text-[var(--ink)] outline-none placeholder:text-[var(--ink-faint)]",
    searchIcon: "size-3.5 shrink-0 text-[var(--ink-faint)]",
    searchRow:
      "mx-1.5 mb-1.5 flex items-center gap-2 rounded-[var(--radius-sm)] bg-[var(--surface-raised)] px-2 py-1.5",
    // `text-left` is not cosmetic: a button centres its text, so without it the titles floated in
    // the middle of the rail and the list had no left edge at all.
    title:
      "min-w-0 flex-1 truncate py-1.5 text-left text-[12.5px] transition-colors duration-100 ease-[var(--ease-swift)]",
    total: "px-1 font-mono text-[10px] tabular-nums text-[var(--ink-faint)]",
  },
  variants: {
    expanded: {
      true: { disclosure: "rotate-90" },
    },
    open: {
      false: { title: "text-[var(--ink-muted)] group-hover:text-[var(--ink)]" },
      // A note already on the canvas is present rather than a destination, and reads brighter.
      true: { title: "text-[var(--ink)]" },
    },
  },
});

/**
 * One note's neighbours, by id.
 *
 * Undirected, because a user who connected two notes did not choose a direction — the same
 * reasoning `findRelation` uses, and the reason both ends are collected here rather than only
 * `target`.
 */
function getNeighbourIds(
  relations: readonly Readonly<{ source: string; target: string }>[],
  noteId: string,
): readonly string[] {
  return relations.flatMap((relation) =>
    relation.source === noteId
      ? [relation.target]
      : relation.target === noteId
        ? [relation.source]
        : [],
  );
}

export function LibraryRail({
  onCollapse,
  projectId,
}: Readonly<{ onCollapse: () => void; projectId: string }>) {
  const actions = useInfiniteCanvasActions<WindowKind>();
  const state = useInfiniteCanvasState<WindowKind>();
  const notes$ = useObservable<readonly NoteRecord[]>([]);
  const query$ = useObservable("");
  const expanded$ = useObservable<string | null>(null);
  /** The note being renamed, and the text so far. `null` when nothing is being edited. */
  const editing$ = useObservable<Readonly<{ id: string; title: string }> | null>(null);

  const notes = useValue(notes$);
  const query = useValue(query$);
  const expanded = useValue(expanded$);
  const editing = useValue(editing$);
  const relations = useValue(relations$);
  const styles = rail();

  useEffect(() => {
    void database.notes.list(projectId).then((listed) => {
      notes$.set(listed);
    });
  }, [notes$, projectId]);

  /**
   * Which note each window is showing, in one pass.
   *
   * `getInfiniteCanvasWindowPresence` is the framework's enumeration and the palette's source, but
   * it reports identity and mode rather than payload — so it cannot answer "which note is this
   * window showing", which is the only question the rail has. Reading `windows` directly is the
   * honest route rather than looking each id back up through presence to reach the same array.
   *
   * `state.windows` rather than the active desktop's subset on purpose: a note open on another
   * desktop is open, and `window.reveal` can reach it.
   */
  const windowIdByNoteId = new Map(
    state.windows.flatMap((window) => {
      const data = window.data as Readonly<{ noteId?: string }> | undefined;

      return data?.noteId === undefined ? [] : [[data.noteId, window.id] as const];
    }),
  );
  const openNoteIds = new Set(windowIdByNoteId.keys());

  const terms = query.trim().toLowerCase();
  const visible =
    terms === "" ? notes : notes.filter((note) => note.title.toLowerCase().includes(terms));

  /**
   * Reach a note wherever it is.
   *
   * `window.reveal` is one verb for what used to be three — switch to the desktop that admits it,
   * restore it if minimized, focus it, move the camera — and it exists because composing those by
   * hand went wrong in exactly the way that is invisible: navigating to a window another desktop
   * hid panned the camera to a rect nothing renders.
   */
  const reach = (from: HTMLElement, noteId: string, title: string) => {
    const windowId = windowIdByNoteId.get(noteId);

    if (windowId === undefined) {
      openNoteWindow({ actions, noteId, state, title });
    } else {
      actions.executeCommand({ type: "window.reveal", windowId });
    }

    /*
     * Give the keyboard back.
     *
     * Every canvas hotkey fires only for events inside the command surface, so a rail button that
     * takes focus and keeps it leaves focus on `<body>` — where `Mod+K` and every shortcut are
     * silently dead and nothing on screen says why. Found by driving this: after reaching a note
     * from the rail, the palette would not open.
     */
    focusInfiniteCanvasCommandSurfaceFrom(from);
  };

  /**
   * Rename, committed to the same writer that owns typing.
   *
   * The list updates immediately rather than after a re-read: the record is already correct here,
   * and a rename that visibly lags the keystroke that made it reads as a save that might not have
   * happened. `setWindowTitle` keeps any window showing this note in step, which is what stops a
   * renamed note from carrying its old name at far zoom and in the accessible name.
   */
  const commitRename = (note: NoteRecord, title: string) => {
    const next = title.trim();

    editing$.set(null);

    if (next === "" || next === note.title) {
      return;
    }

    renameNote(note, next, { read: database.notes.read, save: database.notes.save });
    notes$.set(
      notes.map((candidate) =>
        candidate.id === note.id ? { ...candidate, title: next } : candidate,
      ),
    );

    const windowId = windowIdByNoteId.get(note.id);

    if (windowId !== undefined) {
      actions.setWindowTitle({ title: next, windowId });
    }
  };

  /**
   * Create where you are already looking.
   *
   * The identity rail can make a note too, but from here you watch it join the list you are
   * browsing — and land in rename, because a note called "Untitled 4" is a note you have to come
   * back to.
   */
  const create = async () => {
    await openNewNote({ actions, projectId, state });
    notes$.set(await database.notes.list(projectId));
  };

  return (
    <div className={styles.root()}>
      <div className={styles.header()}>
        <span className={styles.heading()}>Library</span>
        {/* The count is the answer to "is this everything?", which a list alone never gives. */}
        <span className={styles.total()}>{notes.length}</span>
        <Button
          aria-label="New note"
          onClick={() => {
            void create();
          }}
          size="icon-sm"
          title="New note"
          variant="ghost"
        >
          <Plus />
        </Button>
        <Button aria-label="Collapse library" onClick={onCollapse} size="icon-sm" variant="ghost">
          <PanelLeftClose />
        </Button>
      </div>
      <div className={styles.searchRow()}>
        <Search className={styles.searchIcon()} />
        <input
          className={styles.search()}
          onChange={(event) => {
            query$.set(event.target.value);
          }}
          placeholder="Search notes…"
          type="search"
          value={query}
        />
      </div>
      <div className={styles.body()}>
        {visible.length === 0 ? (
          <p className={styles.empty()}>
            {notes.length === 0 ? "No notes yet." : "Nothing matches that."}
          </p>
        ) : (
          visible.map((note) => {
            const neighbours = getNeighbourIds(relations, note.id);
            const isExpanded = expanded === note.id;

            return (
              <div key={note.id}>
                <div className={styles.row()}>
                  <span className={styles.gutter()}>
                    {openNoteIds.has(note.id) ? <span className={styles.presence()} /> : null}
                  </span>
                  {editing?.id === note.id ? (
                    /*
                     * The thing a palette row cannot host.
                     *
                     * Enter commits and Escape abandons, which are the two answers; blur commits
                     * too, because clicking away from a field you have typed into and losing it is
                     * the behaviour nobody expects. `stopPropagation` on keys so the canvas does
                     * not read this as its own shortcuts while a name is being typed.
                     */
                    <input
                      autoFocus
                      className={styles.editor()}
                      onBlur={() => {
                        commitRename(note, editing.title);
                      }}
                      onChange={(event) => {
                        editing$.set({ id: note.id, title: event.target.value });
                      }}
                      onKeyDown={(event) => {
                        event.stopPropagation();

                        if (event.key === "Enter") {
                          commitRename(note, editing.title);
                        }

                        if (event.key === "Escape") {
                          editing$.set(null);
                        }
                      }}
                      value={editing.title}
                    />
                  ) : (
                    <button
                      className={styles.title({ open: openNoteIds.has(note.id) })}
                      // Double-click to rename, the way every sidebar in every file manager does.
                      // A visible pencil on every row would be five affordances competing for the
                      // width the titles need.
                      onDoubleClick={() => {
                        editing$.set({ id: note.id, title: note.title });
                      }}
                      onClick={(event) => {
                        reach(event.currentTarget, note.id, note.title);
                      }}
                      type="button"
                    >
                      {note.title}
                    </button>
                  )}
                  {neighbours.length === 0 ? null : (
                    <button
                      aria-expanded={isExpanded}
                      aria-label={`${String(neighbours.length)} connected`}
                      className={styles.count()}
                      onClick={() => {
                        expanded$.set(isExpanded ? null : note.id);
                      }}
                      type="button"
                    >
                      <ChevronRight className={rail({ expanded: isExpanded }).disclosure()} />
                      <Link2 className={styles.countIcon()} />
                      {neighbours.length}
                    </button>
                  )}
                </div>
                {/*
                  The thing a modal cannot do: an edge whose other end is not open is invisible on
                  the canvas, and reaching it here costs one click rather than a search you can
                  only run if you already know the name.
                */}
                {isExpanded
                  ? neighbours.map((neighbourId) => {
                      const neighbour = notes.find((candidate) => candidate.id === neighbourId);

                      return neighbour === undefined ? null : (
                        <button
                          className={styles.connection()}
                          key={neighbourId}
                          onClick={(event) => {
                            reach(event.currentTarget, neighbour.id, neighbour.title);
                          }}
                          type="button"
                        >
                          <span className={styles.gutter()}>
                            {openNoteIds.has(neighbour.id) ? (
                              <span className={styles.presence()} />
                            ) : null}
                          </span>
                          <span className={styles.connectionTitle()}>{neighbour.title}</span>
                        </button>
                      );
                    })
                  : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export { RAIL_INSET };
