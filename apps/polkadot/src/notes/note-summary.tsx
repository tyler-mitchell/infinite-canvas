import { useInfiniteCanvasSelector } from "@hyphened/infinite-canvas";
import { useValue } from "@legendapp/state/react";
import { useEffect } from "react";
import { tv } from "ui/tv";

import type { WindowKind } from "../canvas/window-registry";
import { ensureNoteLoaded, notes$, type NoteGateway } from "./note-store";
import { getNoteOpeningLine } from "./note-text";

/**
 * What a note says when it is too small to read.
 *
 * The framework's contract is explicit that a summary must say something *different* rather than
 * the same thing smaller. This drew `window.title` — the string the chrome already shows, and in an
 * app whose notes are called "Untitled 7" until someone renames them, a canvas zoomed out was a
 * field of "Untitled N" where an empty note and a full one were indistinguishable.
 *
 * The name and its opening line is the different thing. A collection's summary reached the same
 * conclusion first and its docstring says it outright — "a summary that says only what the title
 * bar says is not a summary" — so this is that rule applied to the kind that most needed it.
 *
 * The opening line is genuinely new information at this zoom, not the body shrunk: the body is not
 * drawn at all here, and one legible line answers "which note is that" for a note whose title never
 * did. It cost nothing to have and was unreachable until `getNoteText` existed, because a note's
 * text is a serialized editor state rather than prose.
 */

const noteSummary = tv({
  slots: {
    /** One line, clipped by the window rather than shrunk to fit it. */
    line: "max-w-full truncate text-[var(--ink-faint)]",
    root: "grid h-full place-items-center content-center gap-[0.4em] px-4 text-center leading-[1.4]",
    title: "max-w-full truncate font-medium text-[var(--ink-muted)]",
  },
});

/**
 * Screen pixels, which is the point.
 *
 * The summary lane exists because the body is too small to read, and a size in **world** units
 * shrinks along with everything else — this was `text-[12px]` and rendered at 3 to 6 screen pixels
 * exactly where the lane had engaged. A summary nobody can read is the body's problem restated.
 *
 * Dividing by zoom holds the words legible and lets the window decide how many survive: at half
 * zoom a 360-wide note shows its whole title, and by the time it is a thumbnail two letters and an
 * ellipsis is all there is room for, which is honest about how much a thumbnail can say.
 */
const SUMMARY_SCREEN_PX = 11;

export function NoteSummary({
  gateway,
  noteId,
  title,
}: Readonly<{ gateway: NoteGateway; noteId: string; title: string }>) {
  /*
   * Subscribed here rather than passed in, which is what the framework asks for: body content that
   * needs live state reads it with `useInfiniteCanvasSelector` inside its own component, so a camera
   * tick invalidates this and not every window on the canvas. Zoom also only changes on zoom — a pan
   * recomputes the same number and re-renders nothing.
   */
  const zoom = useInfiniteCanvasSelector<WindowKind, number>((state) => state.camera.zoom);
  const entry = useValue(notes$[noteId]);
  const styles = noteSummary();

  /*
   * The summary loads, for the reason the collection's does.
   *
   * The framework mounts the body *or* the summary, never both — so a canvas reloaded while zoomed
   * out never mounts the body, nothing ever calls `ensureNoteLoaded`, and the card falls back to
   * the title, which is the window's own chrome said twice. Guarded by a set inside the store, so
   * this is one read per note per session and zooming in afterwards costs nothing.
   */
  useEffect(() => {
    ensureNoteLoaded(noteId, gateway);
  }, [gateway, noteId]);

  const opening = entry?.note == null ? null : getNoteOpeningLine(entry.note.content.text);

  return (
    <div className={styles.root()} style={{ fontSize: SUMMARY_SCREEN_PX / zoom }}>
      <span className={styles.title()}>{title}</span>
      {/* Nothing at all for an empty note. A placeholder would say a note has content it has not. */}
      {opening === null ? null : <span className={styles.line()}>{opening}</span>}
    </div>
  );
}
