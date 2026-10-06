import { openContentWindow, withSummaryMinimum, type WindowPlacement } from "../canvas/open-window";
import { NOTE_KIND, noteGateway } from "./note-gateway";
import { createProjectItem } from "../content/project-content";
import { namingQueue } from "../naming-queue";
import { content } from "../database/operations";
import { getNextNumberedTitle } from "../titles";

const NOTE_SIZE = { height: 240, width: 360 } as const;
// A note renders a summary, so its minimum cannot fall below the size detail restores from.
const NOTE_MINIMUM_SIZE = withSummaryMinimum({ height: 200, width: 240 });

function openNoteWindow(input: WindowPlacement & Readonly<{ noteId: string; title: string }>) {
  openContentWindow({
    dispatch: input.dispatch,
    data: { itemId: input.noteId },
    kind: "note",
    minSize: NOTE_MINIMUM_SIZE,
    size: NOTE_SIZE,
    state: input.state,
    title: input.title,
  });
}

async function openNewNote(input: WindowPlacement & Readonly<{ projectId: string }>) {
  const created = await namingQueue.add(async () => {
    const titles = await content.titles({ kind: NOTE_KIND, projectId: input.projectId });
    const title = getNextNumberedTitle("Untitled", titles);
    return createProjectItem({
      projectId: input.projectId,
      kind: NOTE_KIND,
      create: () => noteGateway.create({ projectId: input.projectId, text: "", title }),
    });
  });
  openNoteWindow({
    dispatch: input.dispatch,
    noteId: created.id,
    state: input.state,
    title: created.title,
  });
}

export { NOTE_MINIMUM_SIZE, openNewNote, openNoteWindow };
