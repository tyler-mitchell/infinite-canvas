import {
  createInfiniteCanvasWindow,
  getInfiniteCanvasWindowPlacementRect,
  getVisibleWorldRect,
  type InfiniteCanvasCommands,
  type InfiniteCanvasState,
} from "@hyphened/infinite-canvas";

import type { WindowData, WindowKind } from "../canvas/window-registry";
import { noteGateway } from "./note-gateway";
import { loadProjectNotes } from "./project-notes";

/**
 * Put a note on the canvas, in the middle of what the user is looking at.
 *
 * One placement, three callers: the rail's button, the palette's new-note action, and the
 * palette's list of notes that have no window. Placement is the part that would drift if each
 * worked it out again.
 */

const NOTE_SIZE = { height: 240, width: 360 } as const;
/**
 * 200, and the number is load-bearing rather than taste.
 *
 * The framework's semantic-LOD band measures a window's **smaller** on-screen axis and restores a
 * summarised window only when that axis is strictly greater than `fullAbovePx`, which defaults to
 * 160. This was `height: 160`, so a note's extent at 100% zoom was exactly 160 — and `160 > 160`
 * is false. Zoom out far enough to demote a note and it stayed a summary all the way back in,
 * returning only past 100%. The same note at the same zoom showed different content depending on
 * where the camera had been.
 *
 * That is the trap door `detail-level.ts` describes and fixed its own defaults to escape; this app
 * walked back into it by picking exactly the boundary. 200 clears it by 40px — the width of the
 * hysteresis band itself, so the margin is the framework's own unit rather than a guess.
 */
const NOTE_MINIMUM_SIZE = { height: 200, width: 240 } as const;

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
/**
 * The next "Untitled n" nothing in this project is already called.
 *
 * It used to be `windows.length + 1` — the number of windows open on the canvas, which is not a
 * fact about the notes at all. Closing a note freed its number for the next one, opening the same
 * note in two windows inflated the count, and windows sitting on another desktop were counted too.
 * Found by clicking "New note" on a canvas with two windows and three notes: the result was a
 * second note called "Untitled 3", indistinguishable in the library from the first.
 *
 * Archived notes are counted as well, and that is the point of asking twice. They hold their titles
 * while archived, so skipping them hands out a name that collides the moment someone restores —
 * a defect that appears long after the action that caused it, in a surface neither of them was in.
 */
function getNextUntitledTitle(titles: readonly string[]) {
  const used = titles.flatMap((title) => {
    const ordinal = /^Untitled (\d+)$/.exec(title)?.[1];

    return ordinal === undefined ? [] : [Number(ordinal)];
  });

  return `Untitled ${String(Math.max(0, ...used) + 1)}`;
}

async function openNewNote(input: Placement & Readonly<{ projectId: string }>) {
  const [offered, archived] = await Promise.all([
    noteGateway.list(input.projectId),
    noteGateway.listArchived(input.projectId),
  ]);
  const title = getNextUntitledTitle([...offered, ...archived].map((note) => note.title));
  const created = await noteGateway.create({ projectId: input.projectId, text: "", title });

  openNoteWindow({ actions: input.actions, noteId: created.id, state: input.state, title });
  await loadProjectNotes(input.projectId);
}

export { openNewNote, openNoteWindow };
