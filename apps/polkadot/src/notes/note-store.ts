import { observable } from "@legendapp/state";
import { AsyncQueuer, Debouncer } from "@tanstack/pacer";

import type { NoteRecord } from "../database/database.client";

/**
 * Open notes, keyed by record id.
 *
 * One observable per note rather than one per window, because the same note may be open in more
 * than one window — reopened from the library, or duplicated onto a second workspace — and both
 * must show the same text as it is typed. The window holds only the id.
 *
 * Writes are debounced then queued at concurrency one, exactly as `canvas-persistence` does: the
 * debouncer collapses a burst of keystrokes into one write, and the queue keeps writes ordered so
 * a revision is never overtaken by the save that follows it.
 */

type NoteEntry = Readonly<{
  error: string | null;
  note: NoteRecord | null;
  status: "error" | "loading" | "ready";
}>;

const notes$ = observable<Record<string, NoteEntry>>({});
const loaded = new Set<string>();
const writers = new Map<
  string,
  { debouncer: Debouncer<(draft: NoteDraft) => void>; stop: () => void }
>();

type NoteDraft = Readonly<{ text: string; title: string }>;

type NoteGateway = Readonly<{
  read: (noteId: string) => Promise<NoteRecord | null>;
  save: (
    input: Readonly<{ noteId: string; revision: number; text: string; title: string }>,
  ) => Promise<NoteRecord>;
}>;

function getNoteEntry(noteId: string) {
  return notes$[noteId];
}

/** Loads a note once per id. Repeat callers observe the same entry rather than re-reading. */
function ensureNoteLoaded(noteId: string, gateway: NoteGateway) {
  if (loaded.has(noteId)) {
    return;
  }

  loaded.add(noteId);
  notes$[noteId].set({ error: null, note: null, status: "loading" });

  void gateway
    .read(noteId)
    .then((note) => {
      notes$[noteId].set(
        note === null
          ? { error: "This note no longer exists.", note: null, status: "error" }
          : { error: null, note, status: "ready" },
      );
    })
    .catch((error: unknown) => {
      loaded.delete(noteId);
      notes$[noteId].set({
        error: error instanceof Error ? error.message : "Could not open this note.",
        note: null,
        status: "error",
      });
    });
}

/**
 * The local copy updates immediately and the write follows.
 *
 * Typing must never wait on the database, so the observable is the source of truth for what is on
 * screen and the revision returned by each write is folded back in to keep the next one valid.
 */
function editNote(noteId: string, draft: NoteDraft, gateway: NoteGateway) {
  const current = notes$[noteId].peek();

  if (current?.note == null) {
    return;
  }

  notes$[noteId].note.set({ ...current.note, ...draft, content: { text: draft.text } });

  let writer = writers.get(noteId);

  if (writer === undefined) {
    const queue = new AsyncQueuer<NoteDraft>(
      async (pending) => {
        const entry = notes$[noteId].peek();

        if (entry?.note == null) {
          return;
        }

        const saved = await gateway.save({
          noteId,
          revision: entry.note.revision,
          text: pending.text,
          title: pending.title,
        });

        // Only the revision is folded back. Replacing the whole record would clobber whatever was
        // typed while the write was in flight.
        notes$[noteId].note.revision.set(saved.revision);
      },
      {
        onError: (error) => {
          notes$[noteId].error.set(
            error instanceof Error ? error.message : "This note could not be saved.",
          );
        },
      },
    );
    const debouncer = new Debouncer(
      (pending: NoteDraft) => {
        queue.addItem(pending);
      },
      { wait: 400 },
    );

    writer = {
      debouncer,
      stop: () => {
        debouncer.cancel();
        queue.stop();
        queue.clear();
      },
    };
    writers.set(noteId, writer);
  }

  writer.debouncer.maybeExecute(draft);
}

/**
 * Rename a note, whether or not it is open.
 *
 * Through the same writer as typing, deliberately. The library rail holds full records from
 * `listNotes`, so it could save directly — and that would be a second writer racing this one
 * whenever the note is also open, because the listed revision goes stale the moment someone types.
 * One authority for note writes, or the revision guard guards nothing.
 *
 * Seeded from the record the caller already has rather than read again: a rename must not wait on
 * a round trip for data that is already in hand, and `ensureNoteLoaded` would resolve after the
 * user had moved on.
 */
function renameNote(note: NoteRecord, title: string, gateway: NoteGateway) {
  if (notes$[note.id].peek() === undefined) {
    loaded.add(note.id);
    notes$[note.id].set({ error: null, note, status: "ready" });
  }

  const entry = notes$[note.id].peek();

  if (entry?.note == null) {
    return;
  }

  editNote(note.id, { text: entry.note.content.text, title }, gateway);
}

function stopNoteWriters() {
  for (const writer of writers.values()) {
    writer.stop();
  }

  writers.clear();
  loaded.clear();
}

export { editNote, ensureNoteLoaded, getNoteEntry, notes$, renameNote, stopNoteWriters };
export type { NoteDraft, NoteEntry, NoteGateway };
