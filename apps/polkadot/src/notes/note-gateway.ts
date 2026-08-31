import { type } from "arktype";

import type { ContentItemRecord } from "../database/database.client";
import { content } from "../database/operations";
import { getNoteText } from "./note-text";

// This layer validates note content inside a generic content item.
const NOTE_KIND = "note";

const NoteContent = type({ text: "string" }).onUndeclaredKey("delete");

type NoteRecord = Readonly<{
  content: typeof NoteContent.infer;
  id: string;
  revision: number;
  title: string;
}>;

function toNote(record: ContentItemRecord): NoteRecord {
  return {
    content: NoteContent.assert(record.content),
    id: record.id,
    revision: record.revision,
    title: record.title,
  };
}

// Search text includes the title and prose, not serialized editor fields.
function getNoteSearchText(draft: Readonly<{ text: string; title: string }>) {
  return `${draft.title} ${getNoteText(draft.text)}`;
}

export const noteGateway = {
  create: async (input: Readonly<{ projectId: string; text: string; title: string }>) =>
    toNote(
      await content.create({
        content: { text: input.text },
        kind: NOTE_KIND,
        projectId: input.projectId,
        searchText: getNoteSearchText(input),
        title: input.title,
      }),
    ),
  list: async (projectId: string) =>
    (await content.list({ kind: NOTE_KIND, projectId })).map(toNote),
  listArchived: async (projectId: string) =>
    (await content.listArchived({ kind: NOTE_KIND, projectId })).map(toNote),
  read: async (noteId: string) => {
    const record = await content.read(noteId);

    return record === null ? null : toNote(record);
  },
  save: async (
    input: Readonly<{ noteId: string; revision: number; text: string; title: string }>,
  ) =>
    toNote(
      await content.save({
        content: { text: input.text },
        itemId: input.noteId,
        revision: input.revision,
        searchText: getNoteSearchText(input),
        title: input.title,
      }),
    ),
};

export { NOTE_KIND, NoteContent, toNote };
export type { NoteRecord };
