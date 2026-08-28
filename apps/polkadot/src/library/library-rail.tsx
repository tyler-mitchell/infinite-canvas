import {
  focusInfiniteCanvasCommandSurfaceFrom,
  useInfiniteCanvasActions,
  useInfiniteCanvasAnnounce,
  useInfiniteCanvasState,
} from "@hyphened/infinite-canvas";
import { useObservable, useValue } from "@legendapp/state/react";
import {
  Archive,
  ArchiveRestore,
  ChevronRight,
  Link2,
  PanelLeftClose,
  Plus,
  Search,
  Unlink2,
} from "lucide-react";
import { useEffect } from "react";
import { Button } from "ui";
import { tv } from "ui/tv";

import { openItemWindow } from "../canvas/open-item";
import { getContentWindowItemId, type WindowKind } from "../canvas/window-registry";
import { getListableKind } from "../collections/listable-kinds";
import type { ContentItemRecord } from "../database/database.client";
import { content } from "../database/operations";
import { FLOATING_SURFACE } from "../material";
import { openNewNote } from "../notes/open-note";
import { renameProjectItem } from "../content/rename-item";
import { matchesContentSearch } from "../content/searchable-text";
import {
  archiveProjectItem,
  getProjectContent,
  loadProjectContent,
  projectContent$,
  restoreProjectItem,
} from "../content/project-content";
import { ConnectionRemovalDialog } from "../relations/connection-removal-dialog";
import {
  disconnectItems,
  findRelation,
  getRelationLabel,
  relations$,
} from "../relations/relation-store";

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
      "flex min-w-0 flex-1 items-center gap-2 py-1 pl-5 text-left text-[12px] text-[var(--ink-muted)] transition-colors duration-100 ease-[var(--ease-swift)] group-hover/connection:text-[var(--ink)]",
    /**
     * What the connection says, when it says anything.
     *
     * The kind is shown here and not on the note rows above, because a label belongs to the edge
     * rather than to either end. `relates` renders as nothing at all: it is the default and means
     * only "these belong together", which the row already says by existing — the same rule the
     * connector on the canvas follows, so the two surfaces never disagree about what is worth
     * saying.
     */
    connectionKind: "shrink-0 truncate text-[10.5px] text-[var(--ink-faint)] italic",
    /**
     * The hover target is the whole row, not the reach button inside it.
     *
     * `group/connection` is named rather than bare because these rows sit inside the note row's own
     * `group`, and an unnamed nested group would make hovering anywhere on a note reveal the cut
     * control on every connection beneath it.
     */
    connectionRow:
      "group/connection flex w-full items-center rounded-[var(--radius-sm)] pr-1 transition-colors duration-100 ease-[var(--ease-swift)] hover:bg-[var(--surface-hover)]",
    connectionTitle: "min-w-0 truncate",
    /**
     * `rowAction`, but listening to the connection row's own group.
     *
     * It cannot reuse `rowAction`: that reveals on the unnamed `group`, which is the note row —
     * and a connection row is a *sibling* of the note row, not a child of it. So `group-hover:`
     * inside one has no ancestor group to match and would never fire, leaving a control that is
     * permanently invisible and reachable only by keyboard. Caught by reading the tree rather than
     * by the typecheck, which had nothing to say about it.
     */
    connectionAction:
      "shrink-0 rounded-[var(--radius-sm)] p-1 text-[var(--ink-faint)] opacity-0 transition-opacity duration-100 ease-[var(--ease-swift)] group-hover/connection:opacity-100 hover:text-[var(--danger)] focus-visible:opacity-100",
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
    kindGlyph: "size-3.5 shrink-0 text-[var(--ink-faint)]",
    heading: "flex-1 pl-1.5 text-[12px] font-medium tracking-[-0.005em] text-[var(--ink-muted)]",
    presence: "size-1.5 rounded-full bg-[var(--accent)]",
    root: `flex w-[264px] flex-col rounded-[var(--radius-lg)] ${FLOATING_SURFACE} shadow-[var(--lift-2)]`,
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
    /**
     * Arrives on approach rather than sitting on every row.
     *
     * Five permanent glyphs down the side would compete for the width the titles need, and a row
     * is mostly read rather than acted on. Focus reveals it too, so it is reachable without a
     * pointer.
     */
    rowAction:
      "shrink-0 rounded-[var(--radius-sm)] p-1 text-[var(--ink-faint)] opacity-0 transition-opacity duration-100 ease-[var(--ease-swift)] group-hover:opacity-100 hover:text-[var(--ink)] focus-visible:opacity-100",
    rowActionIcon: "size-3",
    /** A quiet switch between two lists rather than a mode the rail announces. */
    viewToggle:
      "rounded-[var(--radius-sm)] px-1.5 py-0.5 text-[11px] text-[var(--ink-faint)] transition-colors duration-100 ease-[var(--ease-swift)] hover:bg-[var(--surface-hover)] hover:text-[var(--ink)]",
  },
  variants: {
    expanded: {
      true: { disclosure: "rotate-90" },
    },
    /**
     * In the archive the control cannot wait for a pointer.
     *
     * `rowAction` hides until hover because a library row is mostly read, and the row itself is what
     * you press to open the note — the glyph is a second, lesser action. An archived row is neither:
     * it is not a button, nothing opens, and restoring is the only thing it offers. Measured at
     * `opacity: 0`, so the archive presented a list of names with no visible way to act on any of
     * them, and none at all on a touch device.
     */
    rowMode: {
      archived: { rowAction: "opacity-100" },
      reachable: {},
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
  return relations.flatMap((relation) => {
    if (relation.source === noteId) {
      return [relation.target];
    }

    return relation.target === noteId ? [relation.source] : [];
  });
}

/** What kind a row is, since the rail lists all of them and a title alone does not say. */
function KindGlyph({ kind }: Readonly<{ kind: string }>) {
  const Icon = getListableKind(kind)?.icon;
  const styles = rail();

  return Icon === undefined ? null : <Icon className={styles.kindGlyph()} />;
}

export function LibraryRail({
  onCollapse,
  projectId,
}: Readonly<{ onCollapse: () => void; projectId: string }>) {
  const actions = useInfiniteCanvasActions<WindowKind>();
  const state = useInfiniteCanvasState<WindowKind>();
  /**
   * The archived list, which is this component's alone.
   *
   * The reachable list is not: it lives in `project-notes` because several things create and
   * archive notes and the rail is only one of them. Archived notes have exactly one reader and one
   * writer, both here, so a shared authority would be ceremony — and folding them into the same
   * observable would give it two meanings, which is the confusion the heading guard below exists to
   * prevent. `null` until a read answers; see `emptyState` for why that is not `[]`.
   */
  const archivedNotes$ = useObservable<readonly ContentItemRecord[] | null>(null);
  const query$ = useObservable("");
  const expanded$ = useObservable<string | null>(null);
  /** The note being renamed, and the text so far. `null` when nothing is being edited. */
  const editing$ = useObservable<Readonly<{ id: string; title: string }> | null>(null);
  /** Which list the rail is showing. Archived notes are still notes, just not offered. */
  const archived$ = useObservable(false);
  /**
   * A cut waiting to be confirmed, held only for an edge that says something.
   *
   * Carries the claim and the ends rather than the relation, because the dialog is open across
   * renders and a relation object read now can be replaced by a reload before the answer comes.
   * The ends are what `disconnectItems` takes and they do not go stale.
   */
  const pendingCut$ = useObservable<Readonly<{
    claim: string;
    source: string;
    target: string;
    title: string;
  }> | null>(null);

  const announce = useInfiniteCanvasAnnounce();
  const archivedListing = useValue(archivedNotes$);
  const query = useValue(query$);
  const expanded = useValue(expanded$);
  const editing = useValue(editing$);
  const archived = useValue(archived$);
  const pendingCut = useValue(pendingCut$);
  const relations = useValue(relations$);
  const reachableListing = getProjectContent(useValue(projectContent$), projectId);
  const listing = archived ? archivedListing : reachableListing;
  const notes = listing ?? [];
  const styles = rail();

  /**
   * Ask, and show nothing until the answer comes back.
   *
   * The two lists are held separately, which is what keeps the heading and the list in step.
   * Toggling to Archive used to leave the *notes* sitting there under the word "Archived" until the
   * second query landed — a list labelled as something it is not, which is worse than a list that
   * is briefly absent. It is no longer possible to read one list under the other's heading, and the
   * way back is now instant instead of blank, because returning to the library reads an answer that
   * was never thrown away.
   *
   * The guard still drops an answer to a question no longer being asked, so flicking between the
   * two cannot let a slow query land under the wrong heading.
   */
  useEffect(() => {
    if (!archived) {
      void loadProjectContent(projectId);

      return;
    }

    archivedNotes$.set(null);

    void content.listArchived({ projectId }).then((listed) => {
      if (archived$.peek()) {
        archivedNotes$.set(listed);
      }
    });
  }, [archived, archived$, archivedNotes$, projectId]);

  /**
   * Which content items are on the canvas, for the presence dot beside each row.
   *
   * `getInfiniteCanvasWindowPresence` is the framework's enumeration and the palette's source, but
   * it reports identity and mode rather than payload — so it cannot answer "which item is this
   * window showing", which is the only question the rail has. Reading `windows` directly is the
   * honest route rather than looking each id back up through presence to reach the same array.
   *
   * `state.windows` rather than the active desktop's subset on purpose: an item open on another
   * desktop is open, and `window.reveal` can reach it.
   *
   * Read through the registry's schema rather than cast. This was `window.data as { noteId?: string
   * }`, and window data became `{ itemId }` when every kind got one shape — so the guard was a cast
   * against a field nothing writes, the set was empty, and no row has shown its dot since. Measured
   * on 2026-08-27: five notes open, zero dots. A cast cannot fail, which is the whole problem; the
   * guard would have.
   *
   * The dot was the least of it. `archive` closes the item's window through this map and
   * `commitRename` retitles it — so archiving left the window sitting open on the canvas, which is
   * the state its own docstring calls "archived stops meaning anything", and a rename left the
   * window carrying its old name. Notes hid the second one, because `NoteWindowBody` syncs its own
   * title from the store; no other kind does.
   */
  const windowIdByItemId = new Map(
    state.windows.flatMap((window) => {
      const itemId = getContentWindowItemId(window);

      return itemId === null ? [] : [[itemId, window.id] as const];
    }),
  );
  const openItemIds = new Set(windowIdByItemId.keys());

  const listed = new Set(notes.map((note) => note.id));
  const terms = query.trim().toLowerCase();
  /** What a row that is not being renamed does. Loop-invariant, so it is decided once. */
  const rowMode = archived ? "archived" : "reachable";
  const emptyMessage =
    notes.length > 0
      ? "Nothing matches that."
      : { archived: "Nothing archived.", reachable: "Nothing here yet." }[rowMode];

  /**
   * What an empty body says — and, while the first read is still out, nothing at all.
   *
   * `[]` used to mean two different things: nobody has asked yet, and the answer was nothing. The
   * rail asserted the second whenever the first was true, so a project holding thirty notes greeted
   * you with "No notes yet." for as long as its first query took — which reads as data loss rather
   * than as loading, and is the one thing a local-first app must never imply. An empty state is a
   * claim about the world; it needs an answer behind it.
   */
  const emptyState = listing === null ? null : <p className={styles.empty()}>{emptyMessage}</p>;

  /** The three things the title cell can be, chosen by name rather than by stacked conditions. */
  const titleCell = {
    /*
     * The thing a palette row cannot host.
     *
     * Enter commits and Escape abandons, which are the two answers; blur commits too, because
     * clicking away from a field you have typed into and losing it is the behaviour nobody
     * expects. `stopPropagation` on keys so the canvas does not read this as its own shortcuts
     * while a name is being typed.
     */
    editing: (note: ContentItemRecord) => (
      <input
        // Named after the row it replaced, since the row's own text is gone while this is showing.
        aria-label={`Rename ${note.title}`}
        autoFocus
        className={styles.editor()}
        onBlur={() => {
          commitRename(note, editing?.title ?? note.title);
        }}
        onChange={(event) => {
          editing$.set({ id: note.id, title: event.target.value });
        }}
        onKeyDown={(event) => {
          event.stopPropagation();

          if (event.key === "Enter") {
            commitRename(note, editing?.title ?? note.title);
          }

          if (event.key === "Escape") {
            editing$.set(null);
          }
        }}
        value={editing?.title ?? note.title}
      />
    ),
    /*
     * Archived notes read, they do not open.
     *
     * A title that still opened would put a note back on the canvas while the library no longer
     * offers it — the one state that makes "archived" mean nothing. Restore first, then it is a
     * note again.
     */
    archived: (note: ContentItemRecord) => (
      <span className={styles.title({ open: false })}>{note.title}</span>
    ),
    reachable: (note: ContentItemRecord) => (
      <button
        className={styles.title({ open: openItemIds.has(note.id) })}
        // Double-click to rename, the way every sidebar in every file manager does. A visible
        // pencil on every row would be five affordances competing for the width the titles need.
        onDoubleClick={() => {
          editing$.set({ id: note.id, title: note.title });
        }}
        onClick={(event) => {
          reach(event.currentTarget, note);
        }}
        type="button"
      >
        <KindGlyph kind={note.kind} />
        {note.title}
      </button>
    ),
  };
  // Title *and* content. This matched titles alone, so a phrase visibly on screen in a note's body
  // returned "Nothing matches that" — in an app whose notes are called "Untitled 7" by default.
  const visible = terms === "" ? notes : notes.filter((note) => matchesContentSearch(note, terms));

  /**
   * Reach an item wherever it is. Whatever kind it is — the rail lists every kind now.
   *
   * One branch, because the opening owns the choice. `openContentWindow` reveals when a window
   * already shows the item and opens when none does, and its own docstring records that the rule
   * moved there *from here*, so that collections and the palette would get it too. This kept a
   * second copy that had to agree, and it stopped agreeing the moment window data was rekeyed: the
   * lookup missed every time, so both branches led to the opener anyway. Two authorities where one
   * silently does all the work is worse than one — the dead half looks like the live half.
   */
  const reach = (from: HTMLElement, item: ContentItemRecord) => {
    openItemWindow({ actions, item, state });

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
  const commitRename = (note: ContentItemRecord, title: string) => {
    const next = title.trim();

    editing$.set(null);

    // Everywhere a name is written down is `renameProjectItem`'s to know. This composed it inline,
    // and so did the palette, and the two had drifted — see that file for what each was missing.
    renameProjectItem({ actions, item: note, state, title: next });
  };

  /**
   * Create where you are already looking.
   *
   * No refetch here any more: `openNewNote` refreshes the listing itself, so a note made from the
   * identity rail or the palette joins this list too. That it used to be this function's job is
   * exactly why those two did not.
   */
  const create = async () => {
    await openNewNote({ actions, projectId, state });
  };

  /**
   * Archive, which is the reversible half of removal and the only half that exists.
   *
   * Not a delete. A note carries `relates_to` edges, and deleting it would have to take them with
   * it or leave the graph pointing at nothing — archiving leaves both intact, so restoring puts
   * back everything that was there. The same pairing canvases and projects already ship, and the
   * reason this needs no typed confirmation: nothing is destroyed, so nothing has to be weighed.
   *
   * The window closes with it. A note that is no longer offered anywhere but is still sitting open
   * on the canvas is the state where "archived" stops meaning anything.
   */
  const archive = async (itemId: string) => {
    const windowId = windowIdByItemId.get(itemId);

    if (windowId !== undefined) {
      actions.closeWindow(windowId);
    }

    await archiveProjectItem({ itemId, projectId });
  };

  /*
   * Said out loud, because restoring offers no undo to say it for you.
   *
   * Archiving is announced by the undo notice it raises. Restoring raises none, so the item simply
   * leaves one list and joins another — visible, and silent to anything that cannot see the lists.
   * The title is read before the write, for the reason `archiveProjectItem` gives: afterwards the
   * item is gone from this listing.
   */
  const restore = async (itemId: string) => {
    const restored = archivedListing?.find((item) => item.id === itemId);

    await restoreProjectItem({ itemId, projectId });
    archivedNotes$.set(await content.listArchived({ projectId }));
    announce(restored === undefined ? "Restored." : `Restored “${restored.title.trim()}”`);
  };

  return (
    <div className={styles.root()}>
      <div className={styles.header()}>
        <span className={styles.heading()}>{archived ? "Archived" : "Library"}</span>
        {/*
          The count is the answer to "is this everything?", which a list alone never gives — and it
          is blank rather than 0 until there is an answer, for the same reason `emptyState` is
          blank: a 0 nobody has counted yet is a wrong number, not a pending one.

          It counts what is *shown*, which is the same number until a search narrows the list and the
          right one after that. It counted the whole listing before, so typing left the header saying
          27 above a single row — and, when nothing matched, saying 27 directly above the words
          "Nothing matches that." A count that describes a different set from the list beneath it
          cannot answer the question it is there for: you could not tell one match out of
          twenty-seven from twenty-six more rows below the fold.
        */}
        <span className={styles.total()}>{listing === null ? null : visible.length}</span>
        {/*
          The word on this button is where it takes you, so it cannot also be a pressed state.

          It carried `aria-pressed={archived}` alongside a label that names the *destination*, and
          the two halves said opposite things: standing in the archive, the button reads "Notes" and
          announced itself pressed — "Notes, toggle button, pressed" — which claims Notes is the
          view you are in when Archived is. Sighted review cannot catch it, because the visible word
          is the right one.

          A destination label makes this an action, not a toggle, so the state claim goes and the
          name says what pressing it does. Which view you are in is the heading beside it, and that
          is where it belongs. `aria-label` keeps the visible word inside it, so speaking "archive"
          still reaches this button.
        */}
        <button
          aria-label={archived ? "Show notes" : "Show archive"}
          className={styles.viewToggle()}
          onClick={() => {
            archived$.set(!archived);
          }}
          type="button"
        >
          {archived ? "Notes" : "Archive"}
        </button>
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
        {/*
          The name is the placeholder without its ellipsis, which is not a redundancy: a placeholder
          is only the last resort of the accessible-name computation, and it disappears from view
          the moment anything is typed while the name has to stay.
        */}
        <input
          aria-label="Search this project"
          className={styles.search()}
          onChange={(event) => {
            query$.set(event.target.value);
          }}
          placeholder="Search this project…"
          type="search"
          value={query}
        />
      </div>
      <div className={styles.body()}>
        {visible.length === 0
          ? emptyState
          : visible.map((note) => {
              // Only neighbours this rail can actually show. An archived neighbour still has its
              // edge, so counting it unfiltered promised a row that expanding could never produce.
              const neighbours = getNeighbourIds(relations, note.id).filter((id) => listed.has(id));
              const isExpanded = expanded === note.id;

              return (
                <div key={note.id}>
                  <div className={styles.row()}>
                    <span className={styles.gutter()}>
                      {openItemIds.has(note.id) ? <span className={styles.presence()} /> : null}
                    </span>
                    {titleCell[editing?.id === note.id ? "editing" : rowMode](note)}
                    {/*
                      The count button is named after the row it belongs to, because nothing else
                      here is.

                      It announced "1 connected" and nothing more, which six rows on this canvas
                      said identically — a name that cannot separate two things is not a name. The
                      note titles had the same fault earlier and the window around them answered it,
                      being a `role="group"` named after the note. A rail row has no such grouping:
                      measured, the nearest ancestor carrying a role is none at all, so there is no
                      context to recover the subject from and the name has to carry it.

                      The count stays at the front so the visible text is still inside the accessible
                      name, which is what keeps the button reachable by speaking it.
                    */}
                    {neighbours.length === 0 ? null : (
                      <button
                        aria-expanded={isExpanded}
                        aria-label={`${String(neighbours.length)} connected to ${note.title}`}
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
                    {/*
                    Last, so it sits at the row's outer edge rather than between a title and the
                    count that describes it. It is rendered on every row whether or not it is
                    visible — the same reason the presence gutter is: a control that appears only on
                    hover and takes width when it does would move everything beside it as the
                    pointer crosses the row.
                  */}
                    <button
                      aria-label={archived ? `Restore ${note.title}` : `Archive ${note.title}`}
                      className={rail({ rowMode }).rowAction()}
                      onClick={() => {
                        void (archived ? restore(note.id) : archive(note.id));
                      }}
                      title={archived ? "Restore" : "Archive"}
                      type="button"
                    >
                      {archived ? (
                        <ArchiveRestore className={styles.rowActionIcon()} />
                      ) : (
                        <Archive className={styles.rowActionIcon()} />
                      )}
                    </button>
                  </div>
                  {/*
                  The thing a modal cannot do: an edge whose other end is not open is invisible on
                  the canvas, and reaching it here costs one click rather than a search you can
                  only run if you already know the name.
                */}
                  {isExpanded
                    ? neighbours.map((neighbourId) => {
                        const neighbour = notes.find((candidate) => candidate.id === neighbourId);
                        const relation = findRelation(relations, note.id, neighbourId);
                        // Asked once. It was called twice — to test for a label and then to print
                        // it — which is two chances for the branch and the text to disagree.
                        const relationLabel =
                          relation === undefined ? undefined : getRelationLabel(relation);

                        return neighbour === undefined || relation === undefined ? null : (
                          <div className={styles.connectionRow()} key={neighbourId}>
                            <button
                              className={styles.connection()}
                              onClick={(event) => {
                                reach(event.currentTarget, neighbour);
                              }}
                              type="button"
                            >
                              <span className={styles.gutter()}>
                                {openItemIds.has(neighbour.id) ? (
                                  <span className={styles.presence()} />
                                ) : null}
                              </span>
                              <KindGlyph kind={neighbour.kind} />
                              <span className={styles.connectionTitle()}>{neighbour.title}</span>
                              {relationLabel === undefined ? null : (
                                <span className={styles.connectionKind()}>{relationLabel}</span>
                              )}
                            </button>
                            {/*
                              Cutting an edge without having to find it on the canvas.

                              A connector between two windows that nearly touch is almost entirely
                              behind them — windows resolve before edges, correctly — so the only
                              part you can aim at is the few pixels crossing the gap, and at one
                              measured arrangement that was 30px with its midpoint still inside a
                              window. The rail already knows every edge without needing either end
                              to be on screen, which makes it the surface where acting on one does
                              not depend on where the notes happen to sit.
                            */}
                            <button
                              aria-label={`Cut the connection to ${neighbour.title}`}
                              className={styles.connectionAction()}
                              onClick={() => {
                                /*
                                 * Confirm only when the edge says something, which is the same test
                                 * the connector draws by and the label above is already computed
                                 * from. A default `relates` edge with no label asserts nothing
                                 * beyond the pairing the row states by existing, so a dialog for it
                                 * would be a dialog for nothing — and would teach the answer "yes"
                                 * for the case that matters.
                                 *
                                 * The one that does say something is destroying a sentence someone
                                 * wrote, with no undo anywhere: `history.undo` is the canvas's and
                                 * does not reach the database.
                                 */
                                if (relationLabel === undefined) {
                                  void disconnectItems({
                                    projectId,
                                    source: relation.source,
                                    target: relation.target,
                                  });

                                  return;
                                }

                                pendingCut$.set({
                                  claim: relationLabel,
                                  source: relation.source,
                                  target: relation.target,
                                  title: neighbour.title,
                                });
                              }}
                              title="Cut this connection"
                              type="button"
                            >
                              <Unlink2 className={styles.rowActionIcon()} />
                            </button>
                          </div>
                        );
                      })
                    : null}
                </div>
              );
            })}
      </div>
      {/*
        One dialog for the rail rather than one per row: only one cut can be pending, and mounting a
        dialog inside every connection row would put one in the tree for every edge on screen.
      */}
      {pendingCut === null ? null : (
        <ConnectionRemovalDialog
          claim={pendingCut.claim}
          onConfirm={() => {
            void disconnectItems({
              projectId,
              source: pendingCut.source,
              target: pendingCut.target,
            });
          }}
          onOpenChange={(next) => {
            if (!next) {
              pendingCut$.set(null);
            }
          }}
          open
          title={pendingCut.title}
        />
      )}
    </div>
  );
}

export { RAIL_INSET };
