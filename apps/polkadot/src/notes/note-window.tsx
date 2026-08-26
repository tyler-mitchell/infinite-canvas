import { useInfiniteCanvasActions } from "@hyphened/infinite-canvas";
import { useObservable, useValue } from "@legendapp/state/react";
import { useEffect, useRef } from "react";
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
    body: "flex flex-1 flex-col gap-2 px-5 pt-3.5 pb-4",
    editor: "flex flex-1 flex-col",
    /*
     * The edge of the text, said with light rather than with a bar.
     *
     * Scrolling worked and nothing announced it: a note taller than its window simply began or
     * ended mid-sentence, and macOS overlay scrollbars show nothing at rest, so the only cue
     * arrived after you had already guessed there was more. A gradient into the body's own colour
     * reads as the text passing under an edge, which is what is happening — a rule or a scrollbar
     * track would be the outline-drawn chrome the bar bans.
     *
     * `sticky` because the fade has to hold still against the *frame* while the content moves, and
     * the scroll container is the framework's, not this file's; the negative margin cancels the
     * height it would otherwise add so the strips cost the layout nothing.
     */
    fade: "pointer-events-none sticky z-10 h-6 shrink-0 transition-opacity duration-150 ease-[var(--ease-swift)]",
    notice: "grid h-full place-items-center px-6 text-center text-[12.5px] text-[var(--ink-faint)]",
    /*
     * `min-h-full`, never `h-full`.
     *
     * The frame body the framework draws is already a scroll container — it declares
     * `overflowY: auto` and this kind asks for `native-scroll`. Pinning the content to exactly
     * that height meant the container could never have anything to scroll, so a note longer than
     * its window was clipped with no way to reach the rest of it. Growing past the frame is what
     * hands the overflow back to the one scroller that exists.
     */
    root: "flex min-h-full flex-col",
    title:
      "w-full bg-transparent text-[15px] font-medium tracking-[-0.015em] text-[var(--ink)] outline-none placeholder:text-[var(--ink-faint)]",
  },
  variants: {
    edge: {
      bottom: { fade: "-mt-6 bottom-0 bg-gradient-to-t from-[var(--surface)] to-transparent" },
      top: { fade: "-mb-6 top-0 bg-gradient-to-b from-[var(--surface)] to-transparent" },
    },
  },
});

/**
 * The nearest ancestor that actually scrolls.
 *
 * Found rather than owned: the window body is the framework's element, and a consumer rendered
 * inside it has no handle on it. Matched on the declared `overflow-y` instead of on whether it
 * currently overflows, because at mount a short note overflows nothing and the listener would
 * never be attached to the container the note later grows past.
 */
const findScrollParent = (element: HTMLElement | null): HTMLElement | null => {
  const parent = element?.parentElement ?? null;

  if (parent === null) {
    return null;
  }

  return /auto|scroll|overlay/.test(globalThis.getComputedStyle(parent).overflowY)
    ? parent
    : findScrollParent(parent);
};

export function NoteWindowBody({
  gateway,
  noteId,
  windowId,
  windowTitle,
}: Readonly<{ gateway: NoteGateway; noteId: string; windowId: string; windowTitle: string }>) {
  const actions = useInfiniteCanvasActions();
  const entry = useValue(notes$[noteId]);
  const rootRef = useRef<HTMLDivElement>(null);
  /*
   * Two booleans, not one object.
   *
   * Legend State commits per field and does not replace the root, so a component reading the root
   * of an object observable can be subscribed to something that never changes — the same trap that
   * once left this app's autosave subscribed to a constant and writing nothing for weeks. Written
   * here as `{ above, below }` first, and the fades never moved: `set` updated the fields and the
   * root read stayed identical. Primitives have no root to go stale.
   */
  const above$ = useObservable(false);
  const below$ = useObservable(false);
  const above = useValue(above$);
  const below = useValue(below$);
  const styles = noteWindow();
  const noteTitle = entry?.note?.title;

  useEffect(() => {
    ensureNoteLoaded(noteId, gateway);
  }, [gateway, noteId]);

  /*
   * Re-measured on scroll and on either box changing size.
   *
   * The resize half is not optional: typing grows the content without scrolling it, and dragging
   * the window's corner changes the frame without touching either — both are ways to cross the
   * threshold where a fade should appear, and a scroll listener alone sees neither.
   */
  useEffect(() => {
    const content = rootRef.current;
    const scroller = findScrollParent(content);

    if (content === null || scroller === null) {
      return;
    }

    const measure = () => {
      above$.set(scroller.scrollTop > 1);
      below$.set(scroller.scrollTop + scroller.clientHeight < scroller.scrollHeight - 1);
    };
    const observer = new ResizeObserver(measure);

    measure();
    scroller.addEventListener("scroll", measure, { passive: true });
    observer.observe(scroller);
    observer.observe(content);

    return () => {
      scroller.removeEventListener("scroll", measure);
      observer.disconnect();
    };
  }, [above$, below$, entry?.status]);

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
    <div className={styles.root()} ref={rootRef}>
      {/* Opacity is a computed number, not a state a class can name — the same reason a chart's
          font size is a prop rather than a utility. A `data-` attribute plus a variant was the
          first attempt and the utility was never generated, so the fade matched its own selector
          and stayed invisible. */}
      <div className={noteWindow({ edge: "top" }).fade()} style={{ opacity: above ? 1 : 0 }} />
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
      <div className={noteWindow({ edge: "bottom" }).fade()} style={{ opacity: below ? 1 : 0 }} />
    </div>
  );
}
