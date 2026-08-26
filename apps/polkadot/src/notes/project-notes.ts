import { observable } from "@legendapp/state";

import { content } from "../database/operations";
import { noteGateway, type NoteRecord } from "./note-gateway";

/**
 * Which notes this project offers — one authority, because it has several writers.
 *
 * The library rail used to hold this list itself, and it went wrong in the way a component-owned
 * cache always does: the rail refetched after its own `+` and nothing else told it anything. Making
 * a note from the identity rail or the palette left it reading "No notes yet." with the note
 * sitting on the canvas behind it — a list that omits what you just made, in the surface whose only
 * job is browsing what exists. Adding a refetch at the two sites that forgot would have left the
 * defect intact, because the next writer forgets too.
 *
 * Sibling to `relations.ts`, and the same shape deliberately: a module observable, one loader, and
 * every mutation refreshing it. One difference, which is a correction rather than a variation —
 * this carries the project it belongs to. `relations$` does not, so between navigating to another
 * project and its first query landing, whatever reads it is looking at the previous project's data
 * and cannot tell.
 *
 * **Archived notes are not here.** They are a different question asked from one screen, and folding
 * them in would give the observable two meanings at once, which is exactly the confusion the rail
 * already fixed once by keeping its heading and its list in step.
 */

type ProjectNotes = Readonly<{
  notes: readonly NoteRecord[];
  projectId: string;
}>;

/** `null` until a read answers. "Nobody has asked yet" is not "there are none". */
const projectNotes$ = observable<ProjectNotes | null>(null);

/** The listing, or `null` when what is held belongs to a different project or nothing is held. */
function getProjectNotes(listing: ProjectNotes | null, projectId: string) {
  return listing?.projectId === projectId ? listing.notes : null;
}

async function loadProjectNotes(projectId: string) {
  if (projectNotes$.peek()?.projectId !== projectId) {
    projectNotes$.set(null);
  }

  projectNotes$.set({ notes: await noteGateway.list(projectId), projectId });
}

/**
 * Archive, then re-ask.
 *
 * Closing the window the note was open in is the caller's, not this module's: what a canvas does
 * about a record that stopped being offered is a canvas decision, and this file knows nothing about
 * windows.
 */
async function archiveProjectNote(input: Readonly<{ noteId: string; projectId: string }>) {
  await content.archive(input.noteId);
  await loadProjectNotes(input.projectId);
}

async function restoreProjectNote(input: Readonly<{ noteId: string; projectId: string }>) {
  await content.restore(input.noteId);
  await loadProjectNotes(input.projectId);
}

/**
 * Fold a committed rename into the cached record rather than re-reading.
 *
 * The write itself belongs to `note-store`, which is the single writer for note content — a rename
 * that saved from here would race the revision guard whenever the note is also open and being typed
 * into. This only keeps the list honest, and it does it in place because a rename that visibly lags
 * the keystroke reads as a save that might not have happened.
 */
function setProjectNoteTitle(noteId: string, title: string) {
  const listing = projectNotes$.peek();

  if (listing === null) {
    return;
  }

  projectNotes$.set({
    ...listing,
    notes: listing.notes.map((note) => (note.id === noteId ? { ...note, title } : note)),
  });
}

export {
  archiveProjectNote,
  getProjectNotes,
  loadProjectNotes,
  projectNotes$,
  restoreProjectNote,
  setProjectNoteTitle,
};
export type { ProjectNotes };
