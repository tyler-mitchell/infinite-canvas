import { observable } from "@legendapp/state";
import { AsyncQueuer, Debouncer } from "@tanstack/pacer";

import { setProjectItemContent, setProjectItemRevision } from "../content/project-content";
import type { NoteRecord } from "./note-gateway";

// One store entry serves every window for the same note.
// Each note uses one debounced, ordered write queue.
type NoteEntry = Readonly<{
  error: string | null;
  note: NoteRecord | null;
  status: "error" | "loading" | "ready";
}>;

const notes$ = observable<Record<string, NoteEntry>>({});
// External writes remount the editor so stale text cannot overwrite them.
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

// Each note id loads once. Failed reads can retry.
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

// The local entry updates before the queued database write.
function editNote(noteId: string, draft: NoteDraft, gateway: NoteGateway) {
  const current = notes$[noteId].peek();

  if (current?.note == null) {
    return;
  }

  notes$[noteId].note.set({ ...current.note, ...draft, content: { text: draft.text } });
  // Keep the project listing current for search and note.read.
  setProjectItemContent(noteId, { text: draft.text });

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

        // Update only the revision so in-flight typing stays intact.
        notes$[noteId].note.revision.set(saved.revision);
        // Keep the listing revision current for later cold writes.
        setProjectItemRevision(noteId, saved.revision);
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

// A held record seeds a note that has not loaded.
function seedFromHeldRecord(note: NoteRecord) {
  if (notes$[note.id].peek() === undefined) {
    loaded.add(note.id);
    notes$[note.id].set({ error: null, note, status: "ready" });
  }

  return notes$[note.id].peek();
}

// Renames use the same ordered writer as text edits.
function renameNote(note: NoteRecord, title: string, gateway: NoteGateway) {
  const entry = seedFromHeldRecord(note);

  if (entry?.note == null) {
    return;
  }

  editNote(note.id, { text: entry.note.content.text, title }, gateway);
}

// External writes use the same ordered writer as text edits.
function writeNote(note: NoteRecord, text: string, gateway: NoteGateway) {
  const entry = seedFromHeldRecord(note);

  if (entry?.note == null) {
    return;
  }

  // The loaded entry has the newest title.
  editNote(note.id, { text, title: entry.note.title }, gateway);
  // Remount open editors after the new text is stored locally.
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
