import { observable } from "@legendapp/state";

import type { ContentItemRecord } from "../database/database.client";
import { content } from "../database/operations";
import { rememberUndoableAction } from "./undoable-action";

/**
 * Everything this project holds — one authority, because it has several writers.
 *
 * This listed notes and only notes, which made the library a library of notes: an image, a link or
 * a collection existed, was connectable, and could not be found. The database never had that
 * restriction; only this did.
 *
 * The rail used to hold the list itself, and a component-owned cache goes wrong the same way every
 * time: it refetched after its own `+` and nothing else told it anything, so creating from the
 * palette left it reading "No notes yet" with the note on the canvas behind it. Adding a refetch at
 * the sites that forgot would leave the defect intact, because the next writer forgets too.
 *
 * Carries the project it belongs to, so a reader between navigating and the first query landing
 * cannot mistake the previous project's data for this one's.
 *
 * Archived items are not here — a different question, asked from one screen.
 */

type ProjectContent = Readonly<{
  items: readonly ContentItemRecord[];
  projectId: string;
}>;

/** `null` until a read answers. "Nobody has asked yet" is not "there are none". */
const projectContent$ = observable<ProjectContent | null>(null);

/** The listing, or `null` when what is held belongs to a different project or nothing is held. */
function getProjectContent(listing: ProjectContent | null, projectId: string) {
  return listing?.projectId === projectId ? listing.items : null;
}

/** The same listing narrowed to one kind, for a surface that means one — mentions link notes. */
function getProjectContentOfKind(listing: ProjectContent | null, projectId: string, kind: string) {
  return getProjectContent(listing, projectId)?.filter((item) => item.kind === kind) ?? null;
}

async function loadProjectContent(projectId: string) {
  if (projectContent$.peek()?.projectId !== projectId) {
    projectContent$.set(null);
  }

  projectContent$.set({ items: await content.list({ projectId }), projectId });
}

/**
 * Archive, then re-ask. Closing whatever window it was open in is the caller's — what a canvas does
 * about a record that stopped being offered is a canvas decision.
 *
 * **It remembers how to undo itself, here rather than at the call sites.** Archiving is reversible
 * and `restoreProjectItem` is the reversal, so this function is the only thing that has to know
 * both — the same reason a verb returns its own refusal instead of letting a caller guess at one.
 * Two callers archive (the rail and the palette) and one calls restore (the rail's archive list),
 * so before this the palette could archive a note and leave no way back except finding the rail,
 * switching lists, and looking for it.
 *
 * The title is read before the write, because afterwards the item is gone from this listing.
 */
async function archiveProjectItem(input: Readonly<{ itemId: string; projectId: string }>) {
  const archived = getProjectContent(projectContent$.peek(), input.projectId)?.find(
    (item) => item.id === input.itemId,
  );

  await content.archive(input.itemId);
  await loadProjectContent(input.projectId);

  rememberUndoableAction({
    describe:
      archived === undefined ? "Undo archiving" : `Undo archiving “${archived.title.trim()}”`,
    undo: async () => {
      await restoreProjectItem(input);
    },
  });
}

async function restoreProjectItem(input: Readonly<{ itemId: string; projectId: string }>) {
  await content.restore(input.itemId);
  await loadProjectContent(input.projectId);
}

/**
 * Fold a committed rename into the cached record rather than re-reading.
 *
 * The write belongs to the kind's own store, which is the single writer for its content; a rename
 * saving from here would race the revision guard whenever the item is also open and being edited.
 * In place because a rename that visibly lags the keystroke reads as a save that might not have
 * happened.
 */
function setProjectItemTitle(itemId: string, title: string) {
  const listing = projectContent$.peek();

  if (listing === null) {
    return;
  }

  projectContent$.set({
    ...listing,
    items: listing.items.map((item) => (item.id === itemId ? { ...item, title } : item)),
  });
}

export {
  archiveProjectItem,
  getProjectContent,
  getProjectContentOfKind,
  loadProjectContent,
  projectContent$,
  restoreProjectItem,
  setProjectItemTitle,
};
export type { ProjectContent };
