import {
  defineInfiniteCanvasWindowRegistry,
  getInfiniteCanvasWindowData,
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
      "grid h-full place-items-center px-4 text-center text-[12px] leading-[1.5] text-[var(--ink-faint)]",
  },
});

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
    renderSummary: ({ window }) => <div className={noteWindow().summary()}>{window.title}</div>,
    textSelection: "native",
    wheelBehavior: "native-scroll",
  },
});

export { NoteWindowData, windowDefinitions };
export type { WindowData, WindowKind };
