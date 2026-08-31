import { openContentWindow, type WindowPlacement } from "../canvas/open-window";
import { noteGateway } from "./note-gateway";
import { loadProjectContent } from "../content/project-content";
import { withNamingLock } from "../naming-lock";
import { getNextNumberedTitle } from "../titles";

const NOTE_SIZE = { height: 240, width: 360 } as const;
// The minimum size stays above the LOD restore threshold.
const NOTE_MINIMUM_SIZE = { height: 200, width: 240 } as const;

function openNoteWindow(input: WindowPlacement & Readonly<{ noteId: string; title: string }>) {
  openContentWindow({
    actions: input.actions,
    data: { itemId: input.noteId },
    kind: "note",
    minSize: NOTE_MINIMUM_SIZE,
    size: NOTE_SIZE,
    state: input.state,
    title: input.title,
  });
}

const getNextUntitledTitle = (titles: readonly string[]) =>
  getNextNumberedTitle("Untitled", titles);

// The naming lock prevents concurrent notes from choosing the same title.
async function openNewNote(input: WindowPlacement & Readonly<{ projectId: string }>) {
  return withNamingLock(async () => {
    const [offered, archived] = await Promise.all([
      noteGateway.list(input.projectId),
      noteGateway.listArchived(input.projectId),
    ]);
    const title = getNextUntitledTitle([...offered, ...archived].map((note) => note.title));
    const created = await noteGateway.create({ projectId: input.projectId, text: "", title });

    openNoteWindow({ actions: input.actions, noteId: created.id, state: input.state, title });
    await loadProjectContent(input.projectId);
  });
}

export { openNewNote, openNoteWindow };
