import { useInfiniteCanvasSelector } from "@hyphened/infinite-canvas";
import { useValue } from "@legendapp/state/react";
import { useEffect } from "react";
import { tv } from "ui/tv";

import type { WindowKind } from "../canvas/window-registry";
import { ensureNoteLoaded, notes$, type NoteGateway } from "./note-store";
import { getNoteOpeningLine } from "./note-text";

const noteSummary = tv({
  slots: {
    line: "max-w-full truncate text-[var(--ink-faint)]",
    root: "grid h-full place-items-center content-center gap-[0.4em] px-4 text-center leading-[1.4]",
    title: "max-w-full truncate font-medium text-[var(--ink-muted)]",
  },
});

// Summary text stays at a constant screen size during zoom.
const SUMMARY_SCREEN_PX = 11;

export function NoteSummary({
  gateway,
  noteId,
  title,
}: Readonly<{ gateway: NoteGateway; noteId: string; title: string }>) {
  const zoom = useInfiniteCanvasSelector<WindowKind, number>((state) => state.camera.zoom);
  const entry = useValue(notes$[noteId]);
  const styles = noteSummary();

  // The summary loads the note because the full body is not mounted at this zoom.
  useEffect(() => {
    ensureNoteLoaded(noteId, gateway);
  }, [gateway, noteId]);

  const opening = entry?.note == null ? null : getNoteOpeningLine(entry.note.content.text);

  return (
    <div className={styles.root()} style={{ fontSize: SUMMARY_SCREEN_PX / zoom }}>
      <span className={styles.title()}>{title}</span>
      {/* Empty notes omit the opening line. */}
      {opening === null ? null : <span className={styles.line()}>{opening}</span>}
    </div>
  );
}
