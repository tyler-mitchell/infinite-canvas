import { useValue } from "@legendapp/state/react";
import { useEffect } from "react";
import { tv } from "ui/tv";

import { editNote, ensureNoteLoaded, notes$, type NoteGateway } from "./note-store";
import { NoteEditor } from "./note-editor";

/**
 * A window body bound to a note record.
 *
 * The window carries only `{ noteId }`. Everything shown here comes from the store, so two windows
 * on the same note stay in step and closing a window never risks the text.
 *
 * The database module is passed in rather than imported, because it pulls an 11 MB WebAssembly
 * engine and this component must be renderable — in a test, in a summary, in a story — without it.
 */

const noteWindow = tv({
  slots: {
    body: "flex h-full min-h-0 flex-col gap-2 px-5 pt-3.5 pb-4",
    editor: "min-h-0 flex-1",
    notice: "grid h-full place-items-center px-6 text-center text-[12.5px] text-[var(--ink-faint)]",
    title:
      "w-full bg-transparent text-[15px] font-medium tracking-[-0.015em] text-[var(--ink)] outline-none placeholder:text-[var(--ink-faint)]",
  },
});

export function NoteWindowBody({
  gateway,
  noteId,
}: Readonly<{ gateway: NoteGateway; noteId: string }>) {
  const entry = useValue(notes$[noteId]);
  const styles = noteWindow();

  useEffect(() => {
    ensureNoteLoaded(noteId, gateway);
  }, [gateway, noteId]);

  if (entry === undefined || entry.status === "loading") {
    return <div className={styles.notice()} />;
  }

  if (entry.status === "error" || entry.note === null) {
    return <div className={styles.notice()}>{entry.error ?? "This note could not be opened."}</div>;
  }

  const note = entry.note;

  return (
    <div className={styles.body()}>
      <input
        className={styles.title()}
        onChange={(event) => {
          editNote(noteId, { text: note.content.text, title: event.target.value }, gateway);
        }}
        placeholder="Untitled"
        value={note.title}
      />
      <div className={styles.editor()}>
        <NoteEditor
          onChange={(text) => {
            editNote(noteId, { text, title: note.title }, gateway);
          }}
          value={note.content.text}
        />
      </div>
    </div>
  );
}
