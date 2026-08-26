import { useInfiniteCanvasActions, useInfiniteCanvasState } from "@hyphened/infinite-canvas";
import { useObservable, useValue } from "@legendapp/state/react";
import { ChevronRight, Link2, PanelLeftClose, Search } from "lucide-react";
import { useEffect } from "react";
import { Button } from "ui";
import { tv } from "ui/tv";

import type { WindowKind } from "../canvas/window-registry";
import type { NoteRecord } from "../database/database.client";
import * as database from "../database/operations";
import { openNoteWindow } from "../notes/open-note";
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
    connection:
      "flex w-full items-center gap-2 rounded-[var(--radius-sm)] py-1 pr-2 pl-7 text-left text-[12px] text-[var(--ink-muted)] transition-colors duration-100 ease-[var(--ease-swift)] hover:bg-[var(--surface-hover)] hover:text-[var(--ink)]",
    count:
      "flex shrink-0 items-center gap-1 font-mono text-[10px] tabular-nums text-[var(--ink-faint)]",
    countIcon: "size-3",
    disclosure:
      "size-3 shrink-0 text-[var(--ink-faint)] transition-transform duration-150 ease-[var(--ease-swift)]",
    empty: "px-3 py-6 text-center text-[12px] text-[var(--ink-faint)]",
    header: "flex items-center gap-1 px-1.5 pt-1.5 pb-1",
    heading: "flex-1 pl-1.5 text-[12px] font-medium tracking-[-0.005em] text-[var(--ink-muted)]",
    presence: "size-1.5 shrink-0 rounded-full bg-[var(--accent)]",
    root: "flex w-[264px] flex-col rounded-[var(--radius-lg)] bg-[var(--surface)] shadow-[var(--lift-2)] inset-ring-1 inset-ring-[var(--edge-light)] backdrop-blur-2xl",
    row: "flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-1.5 py-1.5 text-left transition-colors duration-100 ease-[var(--ease-swift)] hover:bg-[var(--surface-hover)]",
    search:
      "min-w-0 flex-1 bg-transparent text-[12px] text-[var(--ink)] outline-none placeholder:text-[var(--ink-faint)]",
    searchIcon: "size-3.5 shrink-0 text-[var(--ink-faint)]",
    searchRow:
      "mx-1.5 mb-1 flex items-center gap-2 rounded-[var(--radius-sm)] bg-[var(--surface-raised)] px-2 py-1.5",
    title: "min-w-0 flex-1 truncate text-[12.5px] text-[var(--ink)]",
  },
  variants: {
    open: {
      // A note already on the canvas reads as present rather than as a destination.
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

  const notes = useValue(notes$);
  const query = useValue(query$);
  const expanded = useValue(expanded$);
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
  const reach = (noteId: string, title: string) => {
    const windowId = windowIdByNoteId.get(noteId);

    if (windowId === undefined) {
      openNoteWindow({ actions, noteId, state, title });

      return;
    }

    actions.executeCommand({ type: "window.reveal", windowId });
  };

  return (
    <div className={styles.root()}>
      <div className={styles.header()}>
        <span className={styles.heading()}>Library</span>
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
                  {openNoteIds.has(note.id) ? <span className={styles.presence()} /> : null}
                  <button
                    className={styles.title({ open: openNoteIds.has(note.id) })}
                    onClick={() => {
                      reach(note.id, note.title);
                    }}
                    type="button"
                  >
                    {note.title}
                  </button>
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
                      <ChevronRight
                        className={styles.disclosure()}
                        style={{ transform: isExpanded ? "rotate(90deg)" : undefined }}
                      />
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
                          onClick={() => {
                            reach(neighbour.id, neighbour.title);
                          }}
                          type="button"
                        >
                          {openNoteIds.has(neighbour.id) ? (
                            <span className={styles.presence()} />
                          ) : null}
                          {neighbour.title}
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
