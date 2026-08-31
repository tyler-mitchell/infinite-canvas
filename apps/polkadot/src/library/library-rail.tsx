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
import { formatRelativeTime } from "../content/relative-time";
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

const RAIL_WIDTH = 264;

const RAIL_INSET = RAIL_WIDTH + 24;

const rail = tv({
  slots: {
    archivedCell: "flex min-w-0 flex-1 flex-col gap-0.5 py-1",
    archivedWhen: "pl-[18px] text-[10.5px] text-[var(--ink-faint)] tabular-nums",
    body: "min-h-0 flex-1 overflow-y-auto overscroll-contain px-1.5 pb-1.5",
    connection:
      "flex min-w-0 flex-1 items-center gap-2 py-1 pl-5 text-left text-[12px] text-[var(--ink-muted)] transition-colors duration-100 ease-[var(--ease-swift)] group-hover/connection:text-[var(--ink)]",
    connectionKind: "shrink-0 truncate text-[10.5px] text-[var(--ink-faint)] italic",
    // The named group isolates hover state from its parent row.
    connectionRow:
      "group/connection flex w-full items-center rounded-[var(--radius-sm)] pr-1 transition-colors duration-100 ease-[var(--ease-swift)] hover:bg-[var(--surface-hover)]",
    connectionTitle: "min-w-0 truncate",
    // This action reads the connection row's named hover group.
    connectionAction:
      "shrink-0 rounded-[var(--radius-sm)] p-1 text-[var(--ink-faint)] opacity-0 transition-opacity duration-100 ease-[var(--ease-swift)] group-hover/connection:opacity-100 hover:text-[var(--danger)] focus-visible:opacity-100",
    editor:
      "min-w-0 flex-1 rounded-[var(--radius-sm)] bg-[var(--surface-raised)] px-1 py-1.5 text-[12.5px] text-[var(--ink)] outline-none inset-ring-1 inset-ring-[var(--accent)]",
    count:
      "flex shrink-0 items-center gap-1 rounded-[var(--radius-sm)] px-1 py-0.5 font-mono text-[10px] tabular-nums text-[var(--ink-faint)] transition-colors duration-100 ease-[var(--ease-swift)] hover:bg-[var(--surface-raised)] hover:text-[var(--ink-muted)]",
    countIcon: "size-3",
    disclosure:
      "size-3 shrink-0 transition-transform duration-150 ease-[var(--ease-swift)] motion-reduce:transition-none",
    empty: "px-3 py-8 text-center text-[12px] text-[var(--ink-faint)]",
    // The fixed gutter keeps all titles aligned.
    gutter: "flex w-2 shrink-0 justify-center",
    header: "flex items-center gap-1 px-1.5 pt-1.5 pb-1",
    kindGlyph: "size-3.5 shrink-0 text-[var(--ink-faint)]",
    heading: "flex-1 pl-1.5 text-[12px] font-medium tracking-[-0.005em] text-[var(--ink-muted)]",
    presence: "size-1.5 rounded-full bg-[var(--accent)]",
    root: `flex w-[264px] flex-col rounded-[var(--radius-lg)] ${FLOATING_SURFACE} shadow-[var(--lift-2)]`,
    row: "group flex w-full items-center gap-2 rounded-[var(--radius-sm)] pr-1 pl-1.5 transition-colors duration-100 ease-[var(--ease-swift)] hover:bg-[var(--surface-hover)]",
    search:
      "min-w-0 flex-1 bg-transparent text-[12px] text-[var(--ink)] outline-none placeholder:text-[var(--ink-faint)]",
    searchIcon: "size-3.5 shrink-0 text-[var(--ink-faint)]",
    searchRow:
      "mx-1.5 mb-1.5 flex items-center gap-2 rounded-[var(--radius-sm)] bg-[var(--surface-raised)] px-2 py-1.5",
    // text-left overrides the button's centered default.
    title:
      "min-w-0 flex-1 truncate py-1.5 text-left text-[12.5px] transition-colors duration-100 ease-[var(--ease-swift)]",
    total: "px-1 font-mono text-[10px] tabular-nums text-[var(--ink-faint)]",
    rowAction:
      "shrink-0 rounded-[var(--radius-sm)] p-1 text-[var(--ink-faint)] opacity-0 transition-opacity duration-100 ease-[var(--ease-swift)] group-hover:opacity-100 hover:text-[var(--ink)] focus-visible:opacity-100",
    rowActionIcon: "size-3",
    viewToggle:
      "rounded-[var(--radius-sm)] px-1.5 py-0.5 text-[11px] text-[var(--ink-faint)] transition-colors duration-100 ease-[var(--ease-swift)] hover:bg-[var(--surface-hover)] hover:text-[var(--ink)]",
  },
  variants: {
    expanded: {
      true: { disclosure: "rotate-90" },
    },
    rowMode: {
      // Archive actions stay visible without hover.
      archived: { rowAction: "opacity-100" },
      reachable: {},
    },
    open: {
      false: { title: "text-[var(--ink-muted)] group-hover:text-[var(--ink)]" },
      true: { title: "text-[var(--ink)]" },
    },
  },
});

// Relations are undirected.
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
  // The archive list is local because only this rail reads it.
  const archivedNotes$ = useObservable<readonly ContentItemRecord[] | null>(null);
  const query$ = useObservable("");
  const expanded$ = useObservable<string | null>(null);
  const editing$ = useObservable<Readonly<{ id: string; title: string }> | null>(null);
  const archived$ = useObservable(false);
  // Keep immutable relation fields while the dialog remains open.
  const pendingCut$ = useObservable<Readonly<{
    claim: string;
    source: string;
    target: string;
    title: string;
  }> | null>(null);

  const announce = useInfiniteCanvasAnnounce();
  // All rows use the same time reference for one render.
  const now = Date.now();
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

  // Include windows from all desktops.
  const windowIdByItemId = new Map(
    state.windows.flatMap((window) => {
      const itemId = getContentWindowItemId(window);

      return itemId === null ? [] : [[itemId, window.id] as const];
    }),
  );
  const openItemIds = new Set(windowIdByItemId.keys());

  const listed = new Set(notes.map((note) => note.id));
  const terms = query.trim().toLowerCase();
  const rowMode = archived ? "archived" : "reachable";
  const emptyMessage =
    notes.length > 0
      ? "Nothing matches that."
      : { archived: "Nothing archived.", reachable: "Nothing here yet." }[rowMode];

  // null suppresses the empty state until the query returns.
  const emptyState = listing === null ? null : <p className={styles.empty()}>{emptyMessage}</p>;

  const titleCell = {
    // Blur and Enter commit. Escape cancels.
    editing: (note: ContentItemRecord) => (
      <input
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
    // Archived items must be restored before they can open.
    // Archive rows keep the content kind and archive time.
    archived: (note: ContentItemRecord) => (
      <span className={styles.archivedCell()}>
        <span className={styles.title({ open: false })}>
          <KindGlyph kind={note.kind} />
          {note.title}
        </span>
        {note.archived_at === undefined ? null : (
          <span className={styles.archivedWhen()}>
            Archived {formatRelativeTime({ iso: note.archived_at, now })}
          </span>
        )}
      </span>
    ),
    reachable: (note: ContentItemRecord) => (
      <button
        className={styles.title({ open: openItemIds.has(note.id) })}
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
  const visible = terms === "" ? notes : notes.filter((note) => matchesContentSearch(note, terms));

  const reach = (from: HTMLElement, item: ContentItemRecord) => {
    openItemWindow({ actions, item, state });

    // Restore canvas shortcut focus after the rail action.
    focusInfiniteCanvasCommandSurfaceFrom(from);
  };

  const commitRename = (note: ContentItemRecord, title: string) => {
    const next = title.trim();

    editing$.set(null);

    renameProjectItem({ actions, item: note, state, title: next });
  };

  const create = async () => {
    await openNewNote({ actions, projectId, state });
  };

  // Archive closes the open window before it hides the item.
  const archive = async (itemId: string) => {
    const windowId = windowIdByItemId.get(itemId);

    if (windowId !== undefined) {
      actions.closeWindow(windowId);
    }

    await archiveProjectItem({ itemId, projectId });
  };

  // Restore announces the result because it has no undo notice.
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
        {/* The count stays empty until the list loads and counts only visible rows. */}
        <span className={styles.total()}>{listing === null ? null : visible.length}</span>
        {/* The label names the destination. The heading names the current view. */}
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
        {/* The persistent name does not depend on the placeholder. */}
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
              // Only include neighbours that this rail can show.
              const neighbours = getNeighbourIds(relations, note.id).filter((id) => listed.has(id));
              const isExpanded = expanded === note.id;

              return (
                <div key={note.id}>
                  <div className={styles.row()}>
                    <span className={styles.gutter()}>
                      {openItemIds.has(note.id) ? <span className={styles.presence()} /> : null}
                    </span>
                    {titleCell[editing?.id === note.id ? "editing" : rowMode](note)}
                    {/* The accessible name includes the row title. */}
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
                    {/* This control keeps its width while hidden and stays at the outer edge. */}
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
                  {/* The rail shows connections when the other item is closed. */}
                  {isExpanded
                    ? neighbours.map((neighbourId) => {
                        const neighbour = notes.find((candidate) => candidate.id === neighbourId);
                        const relation = findRelation(relations, note.id, neighbourId);
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
                            {/* The rail can cut a connection without selecting its canvas line. */}
                            <button
                              aria-label={`Cut the connection to ${neighbour.title}`}
                              className={styles.connectionAction()}
                              onClick={() => {
                                // Custom claims require confirmation because this write has no undo.
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
      {/* One shared dialog holds the pending cut. */}
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
