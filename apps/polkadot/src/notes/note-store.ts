import { observable, syncState } from "@legendapp/state";
import { syncObservable } from "@legendapp/state/sync";
import PQueue from "p-queue";

import type { noteGateway, NoteRecord } from "./note-gateway";

const notes$ = observable<Record<string, NoteRecord | null>>({});
const externalWrites$ = observable<Record<string, number>>({});
type NoteDraft = Readonly<{ text: string; title: string }>;
type NoteGateway = Pick<typeof noteGateway, "read" | "save">;

function ensureNoteLoaded(noteId: string, gateway: NoteGateway, initial?: NoteRecord) {
  const note$ = notes$[noteId];
  if (note$.peek() !== undefined) {
    const status$ = syncState(note$);
    if (!status$.isLoaded.peek() && !status$.isGetting.peek() && status$.error.peek() !== undefined)
      void status$.sync();
    return;
  }
  note$.set(initial ?? null);
  const revision$ = observable(initial?.revision ?? 0);
  const queue = new PQueue({ concurrency: 1 });
  syncObservable(note$, {
    debounceSet: 400,
    get: () =>
      queue.add(async () => {
        const seed = syncState(note$).isLoaded.peek() ? undefined : initial;
        const note = seed ?? (await gateway.read(noteId));
        revision$.set(note?.revision ?? 0);
        return note;
      }),
    set: ({ value, value$, update }) =>
      queue.add(async () => {
        if (value === null) return;
        const saved = await gateway.save({ ...value, revision: revision$.peek() });
        revision$.set(saved.revision);
        syncState(value$).error.set(undefined);
        update({ value: { revision: saved.revision } });
      }),
    onError: (error) => console.warn("Note synchronization failed", { noteId, error }),
  });
}

function editNote(noteId: string, draft: NoteDraft, gateway: NoteGateway) {
  ensureNoteLoaded(noteId, gateway);
  const note = notes$[noteId].peek();
  if (note == null) return;
  const content = { ...note.content, text: draft.text };
  notes$[noteId].assign({ content, title: draft.title });
}

function renameNote(note: NoteRecord, title: string, gateway: NoteGateway) {
  ensureNoteLoaded(note.id, gateway, note);
  const current = notes$[note.id].peek();
  if (current != null) editNote(note.id, { text: current.content.text, title }, gateway);
}

function writeNote(note: NoteRecord, text: string, gateway: NoteGateway) {
  ensureNoteLoaded(note.id, gateway, note);
  const current = notes$[note.id].peek();
  if (current == null) return;
  const previousText = current.content.text;
  editNote(note.id, { text, title: current.title }, gateway);
  if (previousText !== text) externalWrites$[note.id].set((value) => (value ?? 0) + 1);
}

export { editNote, ensureNoteLoaded, externalWrites$, notes$, renameNote, writeNote };
export type { NoteDraft, NoteGateway };
