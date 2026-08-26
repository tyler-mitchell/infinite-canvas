import {
  createInfiniteCanvasWindow,
  getInfiniteCanvasWindowPlacementRect,
  getVisibleWorldRect,
  type InfiniteCanvasCommands,
  type InfiniteCanvasState,
} from "@hyphened/infinite-canvas";

import type { WindowData, WindowKind } from "../canvas/window-registry";

/**
 * Create a note and put a window on it, in the middle of what the user is looking at.
 *
 * One function because two surfaces do it — the rail's button and the command palette — and
 * placement is the part that would drift if each worked it out again.
 */

const NOTE_SIZE = { height: 240, width: 360 } as const;
const NOTE_MINIMUM_SIZE = { height: 160, width: 240 } as const;

async function openNewNote(
  input: Readonly<{
    actions: InfiniteCanvasCommands<WindowKind>;
    projectId: string;
    state: InfiniteCanvasState<WindowKind>;
  }>,
) {
  const ordinal = input.state.windows.length + 1;
  const title = `Untitled ${ordinal}`;
  // Cascade, so a run of new notes does not stack into one silhouette.
  const offset = ((ordinal - 1) % 6) * 28;
  const baseRect = getInfiniteCanvasWindowPlacementRect(
    getVisibleWorldRect(input.state.camera, input.state.viewport, 0),
    "center",
    NOTE_SIZE,
    NOTE_MINIMUM_SIZE,
  );
  const database = await import("../database/database.client");
  const created = await database.createNote({ projectId: input.projectId, text: "", title });

  input.actions.openWindow(
    createInfiniteCanvasWindow<WindowKind, WindowData["note"]>({
      data: { noteId: created.id },
      id: globalThis.crypto.randomUUID(),
      kind: "note",
      minSize: NOTE_MINIMUM_SIZE,
      rect: { ...baseRect, x: baseRect.x + offset, y: baseRect.y + offset },
      title,
    }),
  );
}

export { openNewNote };
