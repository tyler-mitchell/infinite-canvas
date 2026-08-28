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

/**
 * The same listing narrowed to one kind, for a surface that means one — mentions link notes.
 *
 * Named rather than positional because two of the three arguments were plain strings in a row:
 * `(listing, projectId, kind)` and `(listing, kind, projectId)` both compile, and the wrong one
 * returns an empty list, which reads as "this project holds no notes" rather than as a mistake.
 * The object is what the rest of this app already passes, for this reason.
 */
function getProjectContentOfKind(
  input: Readonly<{ kind: string; listing: ProjectContent | null; projectId: string }>,
) {
  return (
    getProjectContent(input.listing, input.projectId)?.filter((item) => item.kind === input.kind) ??
    null
  );
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
// Named for the same reason as above: two adjacent strings, and transposing them writes nothing and
// says nothing. `setProjectItemContent` beside it never had the problem — its second argument is an
// object — which is the shape both now share.
function setProjectItemTitle(input: Readonly<{ itemId: string; title: string }>) {
  const listing = projectContent$.peek();

  if (listing === null) {
    return;
  }

  projectContent$.set({
    ...listing,
    items: listing.items.map((item) =>
      item.id === input.itemId ? { ...item, title: input.title } : item,
    ),
  });
}

/**
 * The same fold, for what an item *says* rather than what it is called.
 *
 * `note.read` resolves against this listing, exactly as every other id-taking verb does, and the
 * listing is only re-read on create, archive and restore. So writing a note left the cache holding
 * the old prose and the reader answering with it — measured: `note.write` reported "done" and
 * `note.read` on the same id immediately answered "is empty".
 *
 * That is the write-blind shape the read verb was added to prevent, reappearing one layer down. A
 * caller checking its own work is the case this pair exists for, so the check has to see the write.
 *
 * **Anything that changes an item's content must call this, and a rename is why it is not optional.**
 * `rename-item.ts` reads content off the listing item and writes it straight back — deliberately, so
 * that renaming does not empty what it renames — so a listing holding superseded content does not
 * merely answer stale, it *restores* the stale value to storage on the next rename. Both mutable
 * kinds were broken this way and fixed on 2026-08-28: typing in a note left a visible word
 * unfindable, and changing a collection's question then renaming it put the old question back.
 * Images and links are safe only because nothing edits their content after creation; a writer for
 * either is a writer that has to fold here too.
 *
 * A title has one owner and cannot be forgotten — `renameProjectItem` writes storage, listing and
 * window title together. Content has no such place, because each kind owns its own debounce and
 * revision guard, so the obligation is stated here rather than enforced.
 */
/**
 * The revision that write earned, which the listing also holds.
 *
 * Folding content alone is half the job and the half that fails quietly. A rename reads `revision`
 * off the same listing item and hands it to the gateway's optimistic-concurrency guard, so a listing
 * one revision behind makes the next rename refuse with `ContentRevisionConflictError` — measured
 * 2026-08-28 by changing a collection's question and then renaming it: the rail and the window title
 * both showed the new name while the database kept the old one, and nothing said so until the
 * unhandled-rejection notice caught it.
 *
 * Separate from the content fold because they do not arrive together: a note's content is folded on
 * the keystroke and its revision only when the debounced write returns.
 */
function setProjectItemRevision(itemId: string, revision: number) {
  const listing = projectContent$.peek();

  if (listing === null) {
    return;
  }

  projectContent$.set({
    ...listing,
    items: listing.items.map((item) => (item.id === itemId ? { ...item, revision } : item)),
  });
}

function setProjectItemContent(itemId: string, content: object) {
  const listing = projectContent$.peek();

  if (listing === null) {
    return;
  }

  projectContent$.set({
    ...listing,
    items: listing.items.map((item) => (item.id === itemId ? { ...item, content } : item)),
  });
}

export {
  archiveProjectItem,
  getProjectContent,
  getProjectContentOfKind,
  loadProjectContent,
  projectContent$,
  restoreProjectItem,
  setProjectItemContent,
  setProjectItemRevision,
  setProjectItemTitle,
};
export type { ProjectContent };
