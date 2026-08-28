import { observable } from "@legendapp/state";
import { AsyncQueuer, Debouncer } from "@tanstack/pacer";

import type { NoteRecord } from "./note-gateway";

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
/**
 * How many times each note has been rewritten from outside its own editor.
 *
 * Lexical takes its state once, at mount — `note-editor.tsx` passes `editorState` in
 * `initialConfig` and its comment says the caller keys the component to change notes. That is right
 * for typing, where the editor *is* the source, and wrong the moment something else writes: the open
 * editor keeps showing the old prose, and the next keystroke saves that stale state back over the
 * write. Losing an agent's paragraph to a keypress is the failure, not the stale pixels.
 *
 * So the window keys the editor on this, and an external write remounts it. Remounting costs the
 * caret and the undo stack of that one note — acceptable, and only when the text changed underneath
 * anyway. Bumped here rather than in `editNote`, which typing also goes through: a counter that
 * moved on every keystroke would remount the editor mid-sentence.
 */
const externalWrites$ = observable<Record<string, number>>({});
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
 * Adopt a record the caller is already holding, so a write need not wait on a read.
 *
 * The rail and a tool call both arrive with a full record from a listing. Going through
 * `ensureNoteLoaded` instead would resolve after the user had moved on, and for a note that is
 * already open it would be a second read of what the store has. Returns the entry either way, since
 * a note whose load previously failed has one that holds no record.
 */
function seedFromHeldRecord(note: NoteRecord) {
  if (notes$[note.id].peek() === undefined) {
    loaded.add(note.id);
    notes$[note.id].set({ error: null, note, status: "ready" });
  }

  return notes$[note.id].peek();
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
  const entry = seedFromHeldRecord(note);

  if (entry?.note == null) {
    return;
  }

  editNote(note.id, { text: entry.note.content.text, title }, gateway);
}

/**
 * Replace what a note says, whether or not it is open.
 *
 * `renameNote`'s sibling, and through the same writer for the same reason: the rail and a tool call
 * both hold full records whose revision goes stale the moment somebody types, so a second writer
 * would race this one. One authority for note writes, or the revision guard guards nothing.
 *
 * Replaces rather than appends. A caller that wants to add reads first — `note.read` is registered
 * beside `note.write` precisely so that is possible — and an append verb that could not be checked
 * afterwards would be the write-blind shape this vocabulary keeps refusing to ship.
 */
function writeNote(note: NoteRecord, text: string, gateway: NoteGateway) {
  const entry = seedFromHeldRecord(note);

  if (entry?.note == null) {
    return;
  }

  // The title comes from the entry rather than the caller's record: if the note is open and being
  // renamed, the entry is the newer of the two, and a write must not roll that back.
  editNote(note.id, { text, title: entry.note.title }, gateway);
  // Announced after the write, so any editor showing this note rebuilds on the new text instead of
  // holding the old one and saving it back on the next keystroke.
  externalWrites$[note.id].set((externalWrites$[note.id].peek() ?? 0) + 1);
}

function stopNoteWriters() {
  for (const writer of writers.values()) {
    writer.stop();
  }

  writers.clear();
  loaded.clear();
}

export {
  editNote,
  ensureNoteLoaded,
  externalWrites$,
  getNoteEntry,
  notes$,
  renameNote,
  stopNoteWriters,
  writeNote,
};
export type { NoteDraft, NoteEntry, NoteGateway };
