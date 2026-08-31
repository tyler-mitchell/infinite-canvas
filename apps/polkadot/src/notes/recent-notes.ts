import { observable } from "@legendapp/state";
import { ObservablePersistLocalStorage } from "@legendapp/state/persist-plugins/local-storage";
import { syncObservable } from "@legendapp/state/sync";

// Recent ids resolve against the live list, so records cannot become stale.
const RECENT_NOTE_LIMIT = 5;

const recentNoteIds$ = observable<readonly string[]>([]);

syncObservable(recentNoteIds$, {
  persist: { name: "recent-notes", plugin: ObservablePersistLocalStorage },
});

function rememberNote(noteId: string) {
  recentNoteIds$.set(
    [noteId, ...recentNoteIds$.peek().filter((id) => id !== noteId)].slice(0, RECENT_NOTE_LIMIT),
  );
}

export { RECENT_NOTE_LIMIT, recentNoteIds$, rememberNote };
