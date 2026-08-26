import { useInfiniteCanvasActions } from "@hyphened/infinite-canvas";
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
 *
 * The note's name is written here and nowhere else; the chrome title is hidden for this kind.
 * `window.title` still follows it, for the far-zoom summary and the accessible name.
 */

const noteWindow = tv({
  slots: {
    /*
     * `min-h-full`, never `h-full`.
     *
     * The frame body the framework draws is already a scroll container — it declares
     * `overflowY: auto` and this kind asks for `native-scroll`. Pinning the content to exactly
     * that height meant the container could never have anything to scroll, so a note longer than
     * its window was clipped with no way to reach the rest of it. Growing past the frame is what
     * hands the overflow back to the one scroller that exists.
     */
    body: "flex min-h-full flex-col gap-2 px-5 pt-3.5 pb-4",
    editor: "flex flex-1 flex-col",
    notice: "grid h-full place-items-center px-6 text-center text-[12.5px] text-[var(--ink-faint)]",
    title:
      "w-full bg-transparent text-[15px] font-medium tracking-[-0.015em] text-[var(--ink)] outline-none placeholder:text-[var(--ink-faint)]",
  },
});

export function NoteWindowBody({
  gateway,
  noteId,
  windowId,
  windowTitle,
}: Readonly<{ gateway: NoteGateway; noteId: string; windowId: string; windowTitle: string }>) {
  const actions = useInfiniteCanvasActions();
  const entry = useValue(notes$[noteId]);
  const styles = noteWindow();
  const noteTitle = entry?.note?.title;

  useEffect(() => {
    ensureNoteLoaded(noteId, gateway);
  }, [gateway, noteId]);

  // `window.title` was written once at open and never again, so renames went stale in the summary
  // and the accessible name. Empty titles are skipped; the framework refuses them.
  useEffect(() => {
    if (noteTitle !== undefined && noteTitle.trim().length > 0 && noteTitle !== windowTitle) {
      actions.setWindowTitle({ title: noteTitle, windowId });
    }
  }, [actions, noteTitle, windowId, windowTitle]);

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
