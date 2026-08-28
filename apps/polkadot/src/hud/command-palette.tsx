import {
  focusInfiniteCanvasCommandSurface,
  getInfiniteCanvasContextualEntries,
  getInfiniteCanvasGroupTitle,
  getInfiniteCanvasWindowGroup,
  getInfiniteCanvasWindowPresence,
  useInfiniteCanvasActions,
  useInfiniteCanvasDesktopPortalRoot,
  useInfiniteCanvasState,
  type InfiniteCanvasCommandGroup,
  type InfiniteCanvasContextualEntry,
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
const matchCommand = (value: string, search: string, keywords?: readonly string[]) => {
  /*
   * Searched against the words, not against the value.
   *
   * cmdk hands the filter both, because they are different jobs: `value` identifies a row and
   * `keywords` describe it. Matching on `value` conflated them — a row had to be searchable to be
   * distinguishable, so two windows showing notes with the same title became one row as far as
   * selection was concerned, since it compares `state.value` to the item's value and both matched.
   */
  const haystack = (keywords ?? [value]).join(" ").toLowerCase();
  const terms = getSearchTerms(search);

  if (terms.length === 0) {
    return 1;
  }

  if (!matchesSearchTerms(haystack, terms)) {
    return 0;
  }

  // Ranking is this surface's own: the palette shows one list ordered by relevance, where the rail
  // filters a tree whose order belongs to the library. Only "does this match" is shared.
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
const searchWords = (parts: readonly (string | undefined)[]) =>
  parts.filter((part): part is string => part !== undefined && part !== "");

/**
 * A page the palette has gone into, or `null` for the list.
 *
 * `ROADMAP.md` said the palette could not rename because a list row cannot host an inline editor.
 * A *row* cannot; a palette can, and cmdk documents how — so once the label page existed, rename
 * was the same shape with different words. Both are here rather than in two observables because
 * the mode has to be readable where `filter` is declared, and one page at a time is the whole rule.
 */
type PalettePage =
  | Readonly<{ groupId: string; kind: "group"; title: string }>
  | Readonly<{ kind: "label"; relation: ContentRelation }>
  | Readonly<{ kind: "rename"; note: ContentItemRecord }>;

/** The framework groups every command; the glyph follows that rather than being decoration. */
const GROUP_ICON: Record<InfiniteCanvasCommandGroup, ComponentType> = {
  canvas: Frame,
  edit: Undo2,
  selection: MousePointerSquareDashed,
  view: Move3d,
  window: SquareStack,
};

/** A consumer verb has no framework group, so this app supplies the glyph. */
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
    // `command-item-icon` is the hook Polkadot's stylesheet tints on the selected row.
    tile: "grid size-6 shrink-0 place-items-center rounded-[7px] bg-[var(--surface)] text-[var(--ink-faint)] transition-colors duration-100 [&_svg]:size-3.5",
    title: "shrink-0 text-[13px] text-[var(--ink)]",
    titleRow: "flex min-w-0 flex-1 items-baseline gap-2",
  },
});

export function CommandPalette({ projectId }: Readonly<{ projectId: string }>) {
  const isOpen$ = useObservable(false);
  const isOpen = useValue(isOpen$);
  /**
   * The connection being labelled, if any — cmdk's "page" pattern, which is consumer state rather
   * than an API: the same input becomes a text field, and the list becomes the one row that commits
   * it. Held here rather than inside the content because `filter` is declared here and has to know
   * it must stop filtering; a typed sentence is not a query and must not eliminate its own row.
   */
  const page$ = useObservable<PalettePage | null>(null);
  const page = useValue(page$);

  /**
   * The one way this palette closes, whatever asked it to.
   *
   * Three things have to happen and only one of them is obvious. The page has to be dropped, or
   * reopening lands you back on a rename field for whichever note you were on last. And focus has to
   * go back to the canvas, because the dialog restores focus to whatever opened it and a hotkey is
   * not an element — so it lands on `<body>`, where every canvas shortcut is silently dead.
   *
   * Stable across renders: the observables it closes over are, so the hotkey effect below can depend
   * on it without tearing down and re-registering its listener on every render.
   */
  const close = useCallback(() => {
    isOpen$.set(false);
    page$.set(null);
    returnFocusToCanvas();
  }, [isOpen$, page$]);

  /*
   * The hotkey dismisses through `close`, which it did not.
   *
   * It toggled `isOpen$` directly, and a controlled `open` prop going false does not make Base UI
   * call `onOpenChange` — that fires for a user gesture the dialog itself handles, not for a prop
   * update. So closing with the same key that opened it skipped both of the other two steps.
   *
   * Measured: dismissing with `Mod+K` left `document.activeElement` on `<body>`, while dismissing
   * with Escape left it on the canvas command surface. Everything on the canvas keyboard — undo,
   * fit, nudge, delete — was dead until the canvas was clicked, and nothing on screen said so.
   */
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
      // On a page the text is content, not a query, so nothing is eliminated by typing it.
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
      {/* Mounted only while open. `useInfiniteCanvasState` re-renders on every camera tick, and a
          palette nobody opened has no business reconciling while the user pans. */}
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
  /** Shown and greyed rather than hidden, so a row can say why it cannot run yet. */
  disabled?: boolean;
  icon: ComponentType;
  /**
   * What makes this row *this* row — never what makes it findable.
   *
   * cmdk compares `state.value` to an item's value to decide what is selected, so two rows sharing
   * one are both selected and arrow keys cannot separate them. Titles are not unique — two notes
   * can be called "Untitled 3" — so identity comes from a record id and search comes from
   * `keywords`, which is the split cmdk's own API already draws.
   */
  id: string;
  keys?: readonly string[];
  /** Words to find this row by *beyond* what it displays. The title is always searchable. */
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
  const actions = useInfiniteCanvasActions<WindowKind>();
  const canvases$ = useObservable<readonly CanvasSummary[]>([]);
  const projectList$ = useObservable<readonly ProjectSummary[]>([]);
  /*
   * The project's notes come from the shared store, not a second copy loaded here.
   *
   * A component-owned list is the defect `project-notes` was created to remove: the rail held one,
   * and every writer that was not the rail left it stale. The palette holding another would have
   * put that defect straight back — renaming from here would keep the rail honest and the palette's
   * own list wrong.
   */
  const projectListing = useValue(projectContent$);
  const query$ = useObservable("");
  // The palette's note rows stay notes for now; the rail is where every kind is browsed.
  const notes = getProjectContentOfKind({ kind: "note", listing: projectListing, projectId }) ?? [];
  const relations = useValue(relations$);
  const undoableAction = useValue(undoableAction$);
  const canvases = useValue(canvases$);
  const projectList = useValue(projectList$);
  const query = useValue(query$);
  const styles = palette();
  /**
   * The one selected window's content item, when there is exactly one.
   *
   * `undefined` for none, for several, and for a window bound to nothing — all three are cases
   * where "what does this connect to" has no subject, and an action offered without one would have
   * to invent which window it meant.
   */
  const connectionSubject = ((selected) => {
    const itemId = selected === undefined ? null : getContentWindowItemId(selected);

    return selected === undefined || itemId === null
      ? undefined
      : { itemId, title: selected.title };
  })(
    state.selection.windowIds.length === 1
      ? state.windows.find((window) => window.id === state.selection.windowIds[0])
      : undefined,
  );
  const windows = getInfiniteCanvasWindowPresence(state).windows;
  const activeWindow = windows.find((window) => window.isActive);
  // The canvas's verbs and this app's in one list, so a consumer verb is searchable rather than
  // reachable only by the chord it declares.
  const contextual = getInfiniteCanvasContextualEntries(state, {
    actions,
    hotkeyActions: getConnectorHotkeyActions(projectId),
  });
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
    void loadProjectContent(projectId);
  }, [canvases$, projectId, projectList$]);

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
      .map((window) => getContentWindowItemId(window))
      .filter((itemId) => itemId !== null),
  );
  const recentIds = new Set(useValue(recentNoteIds$));
  /** A window whose note is in `Recent` is reachable from there; showing it twice says nothing. */
  /*
   * Only windows that show something, so a lookup miss means one thing.
   *
   * This mapped every window, binding the ones bound to nothing to an absent value — so `.get()`
   * answered the same way for "no such window" and "that window shows nothing", and both readers
   * below guard with `!== undefined`. Routing this through `getContentWindowItemId`, which answers
   * `null` rather than `undefined`, is what surfaced it: the guard would have passed for a window
   * showing nothing and handed `null` to `rememberNote`.
   */
  const noteIdByWindowId = new Map(
    state.windows.flatMap((window) => {
      const itemId = getContentWindowItemId(window);

      return itemId === null ? [] : [[window.id, itemId] as const];
    }),
  );
  /**
   * Lifted out of their home group only while `Recent` is on screen.
   *
   * Filtering them out unconditionally would have hidden them from search the moment you typed,
   * since `Recent` disappears then — a note becoming unfindable *because* you had used it recently
   * is the exact opposite of the feature.
   */
  const isBrowsing = query.trim() === "";
  const closedNotes = notes
    .filter((note) => !openNoteIds.has(note.id))
    .filter((note) => !(isBrowsing && recentIds.has(note.id)));

  /**
   * What you were just doing, resolved against what still exists.
   *
   * Only on an empty query: once you have typed something you know what you are after, and the
   * filter already ranks it. On the empty state there is nothing to rank by except habit.
   *
   * Recent notes are lifted out of `Windows` and `Notes` rather than repeated in both places. cmdk
   * identifies a row by its value, so two rows sharing one are indistinguishable to selection — and
   * a list that shows you the same note twice is answering a question you did not ask.
   */
  const visibleWindows = windows.filter((window) => {
    const noteId = noteIdByWindowId.get(window.id);

    return !(isBrowsing && noteId !== undefined && recentIds.has(noteId));
  });

  const recentNotes = isBrowsing
    ? [...recentIds]
        .map((noteId) => notes.find((note) => note.id === noteId))
        .filter((note) => note !== undefined)
    : [];

  /**
   * Reach a note wherever it is, and remember that you did.
   *
   * Whether that means revealing an existing window or opening a new one is not decided here.
   * `openContentWindow` owns it, and its docstring already says so — the rule moved there
   * precisely so "every caller gets it — the rail, the palette, collections". This surface kept
   * its own copy anyway, so the claim was true of the rail and the collections and not of the
   * palette, which reached past the opener and answered the question a second time.
   *
   * Two answers to one question is the shape this app keeps finding: they agreed here, but they
   * were separate derivations — `getContentWindowItemId` against the opener's own `showsItem` —
   * and nothing made them stay agreed.
   */
  const reachNote = (note: Readonly<{ id: string; title: string }>) => {
    rememberNote(note.id);
    openNoteWindow({ actions, noteId: note.id, state, title: note.title });
  };

  /**
   * The note record behind the active window, if that window is showing one.
   *
   * The full record rather than the window's title, because `renameNote` seeds the store from what
   * the caller already holds — handing it a title alone would mean a round trip for data the
   * palette has loaded anyway.
   */
  // Through the guard, not a cast: `noteId` stopped existing when window data became one
  // `{ itemId }` for every kind, so this matched nothing and the active note was always undefined.
  const activeStateWindow = state.windows.find((window) => window.id === state.activeWindowId);
  const activeNoteId =
    activeStateWindow === undefined ? undefined : getContentWindowItemId(activeStateWindow);
  const activeNote = notes.find((note) => note.id === activeNoteId);
  /** The group holding the active window, which is the only one a person could mean to name. */
  const activeGroup =
    state.activeWindowId === null
      ? undefined
      : getInfiniteCanvasWindowGroup(state, state.activeWindowId);

  /**
   * Connecting from the selection, which is the keyboard's way in.
   *
   * Dragging between two notes is the direct gesture and is what most people will use; this stays
   * because it is the only route that needs no pointer at all, and because selecting two windows is
   * something the canvas already does.
   */
  /*
   * Through the guard, not a cast — the third and last place in this file reading a field that
   * stopped existing.
   *
   * Window data became one `{ itemId }` for every kind, and two comments in this file already record
   * `data.noteId` going dead: once for the active note, once for the rename's third write. This read
   * survived both corrections, so `selectedNoteIds` was permanently `[]`, `connectedPair` permanently
   * `undefined`, and the rows below that need two selected notes could not appear. The docstring
   * above calls this "the only route that needs no pointer at all"; it had not worked since the
   * rekey.
   *
   * Measured on the running canvas: reading `data.noteId` off two windows returns nothing, and
   * reading them through the guard returns both content ids.
   *
   * `data` is `unknown` by design, so a cast onto it cannot fail — which is exactly why all three of
   * these were silent. `getContentWindowItemId` is the app's one answer to this question and is what
   * the rail and the recents already use.
   */
  const selectedNoteIds = state.selection.windowIds
    .map((windowId) => {
      const selected = state.windows.find((window) => window.id === windowId);

      return selected === undefined ? null : getContentWindowItemId(selected);
    })
    .filter((itemId): itemId is string => itemId !== null);
  const connectedPair =
    selectedNoteIds.length === 2 &&
    selectedNoteIds[0] !== undefined &&
    selectedNoteIds[1] !== undefined
      ? findRelation(relations, selectedNoteIds[0], selectedNoteIds[1])
      : undefined;
  /**
   * What disconnecting these two would destroy, when it would destroy anything.
   *
   * This row acts on an edge nobody is looking at: two *windows* are selected, the connector between
   * them is not, and it may be off screen entirely. So unlike the Backspace action — which cuts a
   * connector the pointer selected, with its label drawn on the line — the person choosing this row
   * has no way to see what the connection claims.
   *
   * The rail answers the same problem with a dialog. A palette row cannot: it is a keyboard surface
   * and `run` closes the palette, so a modal on the way out would interrupt the one flow this exists
   * to make fast. Saying it in the row is the proportionate form — it arrives before the choice
   * rather than after it, which is the argument `saved-view-menu` already makes for a removal mode
   * over a confirm dialog.
   *
   * `getRelationLabel` is the same test the connector draws by and the rail confirms on; an edge with
   * the default kind and no label claims nothing beyond the pairing, and its title stays plain.
   */
  const connectionClaim = connectedPair === undefined ? undefined : getRelationLabel(connectedPair);
  const disconnectPairTitle =
    connectionClaim === undefined
      ? "Disconnect the two selected notes"
      : `Disconnect the two selected notes — loses “${connectionClaim}”`;

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

  const openCanvas = useGoToCanvas();
  const refreshRoute = useRefreshRoute();
  // Which canvas this is, from the route rather than from state of its own — the URL already says.
  const canvas = useLoaderData({ from: "/canvas/$canvasId" });

  /*
   * The page where the input is a sentence rather than a search.
   *
   * cmdk calls these pages and supplies no component for one — it is the same input and the same
   * list, told to mean something else, which is why this is a branch here rather than a second
   * dialog. Escape goes back rather than closing: the palette is already the second thing you
   * opened, and dropping you all the way out for changing your mind about a word is a punishment.
   *
   * One row, and it is the whole affordance: it previews what will be stored, so committing is the
   * same Enter that runs every other row, and clearing is visibly the same act as writing rather
   * than a separate destructive verb hidden somewhere else.
   */
  if (page !== null) {
    const draft = query.trim();
    /*
     * Both pages are the same shell — an input, one row, a footer — so what differs is declared as
     * data and the shell reads it. Adding a third page is then a third entry rather than a third
     * copy of the same JSX, which is what keeps them behaving identically.
     */
    const spec =
      page.kind === "group"
        ? {
            commit: () => {
              actions.setGroupTitle({ groupId: page.groupId, title: draft });
            },
            /*
             * Empty restores the framework's default rather than being refused, unlike a note.
             * A group's name is a convenience — it has one without you, and clearing it back to
             * "Group" is a thing someone can reasonably want. A note has no name but the one it
             * is given.
             */
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
              // Empty is a real choice here: it clears the label and the edge falls back to its kind.
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
                /*
                 * One rename, wherever it is asked for. This composed the three writes inline and so
                 * did the library rail, and the two had drifted: this one committed the raw draft,
                 * so whitespace could become a title, and it handed any kind to `toNote` — which
                 * runs `NoteContent.assert` and throws on anything that is not a note.
                 */
                renameProjectItem({ actions, item: page.note, state, title: draft });
              },
              /*
               * Empty is not a choice here, it is a hole. The schema asserts a non-empty title, so a
               * blank rename would be refused by the database after the palette had already closed and
               * told you it worked. The row says why instead of failing silently later.
               */
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

                  actions.executeCommand({ type: "window.reveal", windowId: window.id });
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
                      id={`send-to-${workspace.id}`}
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
                  // Where a project opens is the verb's decision, and so is whether it is a move.
                  // This row used to enter the project you were already in, which walked you to
                  // whichever of its canvases you had last typed in.
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
          {/*
            Rendered from `app-actions`, not written out here.

            Every row was a `void someCreator({...})` inside its own `onSelect`, which is a
            capability only a pointer can reach — it cannot be listed, described or invoked by
            anything else. The vocabulary carries the label, the description and the enablement,
            and this maps it to rows. A collection is named for what it lists rather than offering
            an empty one to configure: "Collection of notes" is already the thing they wanted.
          */}
          {/*
            Entries taking an argument are not rows. A row is a name you pick, with nowhere to put
            a title or an id — the palette's own pages are how that would be asked for, and none
            exists for these yet. Skipped here rather than filtered out of the vocabulary, because
            a caller that can supply an argument still gets them.
          */}
          {APP_ACTIONS.filter((action) => action.input === undefined).map((action) => {
            const context = {
              actions,
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
                  // The palette closes on select; a write verb's promise is nobody's to wait for.
                  void action.run(context);
                })}
                id={action.id}
                keywords="create list all"
                title={action.label}
              />
            );
          })}
          {/*
            Only offered when exactly one window is selected, because the question needs a subject.
            Two selected windows would be two collections or an arbitrary choice between them, and
            none would be a collection of what — the action is named for the thing it points at, so
            it can only exist when there is one.

            The verb is `collection.create.connectedTo`; this row supplies its argument. It sat
            outside the vocabulary while "one entry per argument value" was the only shape there
            was, because that shape cannot enumerate "connected to *this* item" — the note above
            used to say so and named it as the WebMCP spike's open question. Entries carry an
            ArkType `input` now, so the row is a control again rather than a capability.

            Rendered here rather than by the loop above, which skips input-taking entries: a row
            has nowhere to type an argument, and this one does not need anywhere — the selection
            already is the argument.
          */}
          {connectionSubject === undefined ? null : (
            <Row
              icon={Link2}
              onSelect={run(() => {
                void getAppAction("collection.create.connectedTo")?.run(
                  {
                    actions,
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
          {/*
            What the selected connection means, one row per kind.

            A fixed vocabulary is what a palette row is *for* — unlike a rename, there is nothing to
            type, so this needs no inline editor and belongs here rather than in the rail. The kind
            the edge already carries is left out: offering "Mark as supports" on an edge that
            already supports is a row that does nothing, and a list that reads as a set of choices
            when one of them is the current state teaches the wrong thing about what is selected.
          */}
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
          {/*
            Renaming the note you are looking at, without leaving the keyboard.

            `ROADMAP.md` recorded this as impossible — "a list row cannot host an inline editor" —
            and the rail got rename for that reason. The claim was half right: a row cannot, a page
            can, and the label page proved it. The rail keeps its double-click, which is the better
            gesture when you are already browsing; this is the better one when your hands are on
            `Mod+K`. Both write through `renameNote`, so there is still one authority for note
            writes and the revision guard still guards something.

            Seeded with the current name rather than blank, because a rename is an edit of a name
            that exists, and starting empty makes the common case — changing one word — retyping.
          */}
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
          {/*
            A group could not be named at all. `group.setTitle` takes a string only a person has, so
            it is `parameterized` in the framework's coverage map and no palette row could offer it
            — which left every group called "Group", the framework's own default, forever.

            The same shell as the two renames beside it, which is what makes a third page an entry
            rather than a third copy.
          */}
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
                /*
                 * Seeded empty unless somebody named it, which `title === null` says exactly.
                 *
                 * A note rename seeds the current title because you are editing a name someone
                 * chose. A derived group name is a description wearing a value, so pre-filling it
                 * makes the first act clearing it — watched, a name typed straight in came out
                 * "GroupReading list". This compared against the framework's default string, which
                 * was the closest thing to provenance available and got the case wrong the moment a
                 * derived name was anything other than "Group".
                 */
                query$.set(activeGroup.title ?? "");
              }}
              title={
                activeGroup.title === null ? "Name this group…" : `Rename “${activeGroup.title}”…`
              }
            />
          )}
          {/*
            Archive, which is the only removal a note has.

            This was left undone on the grounds that the palette cannot delete because delete needs
            a typed confirmation — reasoning about a verb that does not exist here. A note carries
            `relates_to` edges, so the removal the schema settled on is archive: nothing is
            destroyed, restore puts back the note *and* its edges, and there is nothing to weigh, so
            there is nothing to confirm. A plain row is the whole affordance.

            The window closes with it, exactly as the rail does it. A note the library no longer
            offers but that is still sitting open on the canvas is the state where "archived" stops
            meaning anything.
          */}
          {/*
            Taking back the last thing done to the library, which the canvas's own undo cannot.

            `history.undo` covers windows, groups and the camera; archiving happens in the database,
            outside anything the framework's history knows about. Two surfaces archive and only the
            rail's archive list restores, so a note archived from here used to leave no way back
            except finding the rail, switching lists, and looking for it.

            The row names the act rather than saying "Undo", because the palette already offers the
            canvas's Undo and two rows reading the same word are two controls with one name. Naming
            it also makes it searchable by what was archived.
          */}
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
                  actions.closeWindow(windowId);
                }

                void archiveProjectItem({ itemId: activeNote.id, projectId });
              })}
              title={`Archive “${activeNote.title}”`}
            />
          )}
          {/* Only for a single edge: a sentence written onto four connections at once is a
              sentence that was true of none of them. */}
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
          {/* Cutting a connection is `connection.cut` in the Canvas group above, which is the
              same declaration the keyboard binds. */}
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
              // Same verb the switcher calls, so the naming rule is one decision rather than three.
              createDesktop({
                actions,
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
