import { observable } from "@legendapp/state";
import { ObservablePersistLocalStorage } from "@legendapp/state/persist-plugins/local-storage";
import { syncObservable } from "@legendapp/state/sync";

/**
 * The notes you last reached for, most recent first.
 *
 * Ids rather than records, deliberately. A remembered record would go stale the moment the note was
 * renamed or archived, and the palette would offer a row that opens something that is no longer
 * there. Ids are resolved against the live listing at render, so a note that stops existing simply
 * stops appearing — there is no cache to invalidate because there is no cache.
 *
 * `localStorage` rather than the database, because this is a habit rather than content: it belongs
 * to this browser, it is worthless on another machine, and putting it in SurrealDB would make a
 * five-item convenience share the revision-guarded write path that note text needs.
 *
 * **This is the `syncObservable` the audit rejected once, and the rejection does not reach it.**
 * That was about canvas persistence: the remote change processor launches prepared sets without
 * awaiting them in order, which cannot hold a revision-ordered write. A list of five strings with
 * no remote and no revisions has none of that exposure, and hand-rolling a `localStorage` read and
 * write to avoid a library already installed would be the exact inversion of the rule.
 */

/** Five, because a longer list stops being "what you were just doing" and becomes another search. */
const RECENT_NOTE_LIMIT = 5;

const recentNoteIds$ = observable<readonly string[]>([]);

syncObservable(recentNoteIds$, {
  persist: { name: "recent-notes", plugin: ObservablePersistLocalStorage },
});

/** Reaching a note you had already reached moves it to the front rather than repeating it. */
function rememberNote(noteId: string) {
  recentNoteIds$.set(
    [noteId, ...recentNoteIds$.peek().filter((id) => id !== noteId)].slice(0, RECENT_NOTE_LIMIT),
  );
}

export { RECENT_NOTE_LIMIT, recentNoteIds$, rememberNote };
