import {
  defineInfiniteCanvasWindowRegistry,
  getInfiniteCanvasWindowData,
  useInfiniteCanvasSelector,
} from "@hyphened/infinite-canvas";
import { type } from "arktype";
import { tv } from "ui/tv";

import type { NoteGateway } from "../notes/note-store";
import { NoteWindowBody } from "../notes/note-window";

/**
 * What can live on a canvas.
 *
 * This is separate from the workspace component because the route loader hydrates a saved layout
 * *before* anything mounts, and hydration has to know which kinds are registered in order to tell
 * a readable canvas from one referencing a window kind this build no longer has.
 */

type WindowKind = "note";

const NoteWindowData = type({ noteId: "string" });
type NoteWindowData = typeof NoteWindowData.infer;

type WindowData = Readonly<{
  note: NoteWindowData;
}>;

const noteWindow = tv({
  slots: {
    summary:
      "grid h-full place-items-center px-4 text-center leading-[1.5] text-[var(--ink-faint)]",
    /** One line, clipped by the window rather than shrunk to fit it. */
    summaryTitle: "max-w-full truncate",
  },
});

/**
 * Screen pixels, which is the point.
 *
 * The summary lane exists because the body is too small to read, and its own docstring is explicit
 * that a window must then say something *different* rather than the same thing smaller. This
 * summary was the title at `text-[12px]` in **world** units — so it shrank along with everything
 * else and rendered at 3 to 6 screen pixels exactly where the lane had engaged. A summary nobody
 * can read is the body's problem restated.
 *
 * Holding the size in screen pixels and dividing by zoom keeps the words legible and lets the
 * window decide how many of them survive: at half zoom a 360-wide note still shows the whole title,
 * and by the time it is a thumbnail two letters and an ellipsis is all there is room for, which is
 * honest about how much a thumbnail can say.
 */
const SUMMARY_TITLE_SCREEN_PX = 11;

/**
 * Subscribed here rather than passed in, which is what the framework asks for: body content that
 * needs live state reads it with `useInfiniteCanvasSelector` inside its own component, so a camera
 * tick invalidates this and not every window on the canvas. Zoom also only changes on zoom — a pan
 * recomputes the same number and re-renders nothing.
 */
function NoteSummary({ title }: Readonly<{ title: string }>) {
  const zoom = useInfiniteCanvasSelector<WindowKind, number>((state) => state.camera.zoom);
  const styles = noteWindow();

  return (
    <div className={styles.summary()}>
      <span className={styles.summaryTitle()} style={{ fontSize: SUMMARY_TITLE_SCREEN_PX / zoom }}>
        {title}
      </span>
    </div>
  );
}

/**
 * The database, as the note layer sees it.
 *
 * Passed to the window body rather than imported by it, so the body stays renderable without
 * pulling an 11 MB WebAssembly engine into a test or a summary.
 */
const noteGateway: NoteGateway = {
  read: async (noteId) => (await import("../database/database.client")).readNote(noteId),
  save: async (input) => (await import("../database/database.client")).saveNote(input),
};

const windowDefinitions = defineInfiniteCanvasWindowRegistry<WindowKind, WindowData>({
  note: {
    kind: "note",
    overflowY: "auto",
    renderBody: ({ window }) => {
      const data = getInfiniteCanvasWindowData(window, NoteWindowData.allows);

      return data == null ? (
        <div className={noteWindow().summary()}>This window is not bound to a note.</div>
      ) : (
        <NoteWindowBody
          gateway={noteGateway}
          noteId={data.noteId}
          windowId={window.id}
          windowTitle={window.title}
        />
      );
    },
    renderSummary: ({ window }) => <NoteSummary title={window.title} />,
    textSelection: "native",
    wheelBehavior: "native-scroll",
  },
});

export { NoteWindowData, windowDefinitions };
export type { WindowData, WindowKind };
