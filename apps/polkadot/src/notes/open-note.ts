import {
  createInfiniteCanvasWindow,
  getInfiniteCanvasWindowPlacementRect,
  getVisibleWorldRect,
  type InfiniteCanvasCommands,
  type InfiniteCanvasState,
} from "@hyphened/infinite-canvas";

import type { WindowData, WindowKind } from "../canvas/window-registry";
import * as database from "../database/operations";
import { loadProjectNotes } from "./project-notes";

/**
 * Put a note on the canvas, in the middle of what the user is looking at.
 *
 * One placement, three callers: the rail's button, the palette's new-note action, and the
 * palette's list of notes that have no window. Placement is the part that would drift if each
 * worked it out again.
 */

const NOTE_SIZE = { height: 240, width: 360 } as const;
const NOTE_MINIMUM_SIZE = { height: 160, width: 240 } as const;

type Placement = Readonly<{
  actions: InfiniteCanvasCommands<WindowKind>;
  state: InfiniteCanvasState<WindowKind>;
}>;

function openNoteWindow(input: Placement & Readonly<{ noteId: string; title: string }>) {
  const ordinal = input.state.windows.length + 1;
  // Cascade, so a run of openings does not stack into one silhouette.
  const offset = ((ordinal - 1) % 6) * 28;
  const baseRect = getInfiniteCanvasWindowPlacementRect(
    getVisibleWorldRect(input.state.camera, input.state.viewport, 0),
    "center",
    NOTE_SIZE,
    NOTE_MINIMUM_SIZE,
  );

  input.actions.openWindow(
    createInfiniteCanvasWindow<WindowKind, WindowData["note"]>({
      data: { noteId: input.noteId },
      id: globalThis.crypto.randomUUID(),
      kind: "note",
      minSize: NOTE_MINIMUM_SIZE,
      rect: { ...baseRect, x: baseRect.x + offset, y: baseRect.y + offset },
      title: input.title,
    }),
  );
}

/**
 * Refreshing the listing here is what makes creation whole, wherever it was asked for.
 *
 * This is already the one creation path — the rail's `+`, the palette's action, and the identity
 * rail's button all arrive here — so it is the only place that can promise the library shows a note
 * the moment it exists. It used to be the rail's own job, and the rail could only keep that promise
 * for notes it made itself: the other two callers left it reading "No notes yet." over a canvas
 * with the new note on it.
 */
async function openNewNote(input: Placement & Readonly<{ projectId: string }>) {
  const title = `Untitled ${input.state.windows.length + 1}`;
  const created = await database.notes.create({ projectId: input.projectId, text: "", title });

  openNoteWindow({ actions: input.actions, noteId: created.id, state: input.state, title });
  await loadProjectNotes(input.projectId);
}

export { openNewNote, openNoteWindow };
