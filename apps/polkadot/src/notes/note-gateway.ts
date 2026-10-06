import { type } from "arktype";

import type { ContentItemRecord } from "../database/database.client";
import { content } from "../database/operations";
import { getNoteText } from "./note-text";

// This layer validates note content inside a generic content item.
const NOTE_KIND = "note";

const NoteContent = type({ text: "string" });

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
  read: async (noteId: string) => {
    const record = await content.read(noteId);

    return record?.kind === NOTE_KIND ? toNote(record) : null;
  },
  save: async (input: NoteRecord) =>
    toNote(
      await content.save({
        content: input.content,
        itemId: input.id,
        revision: input.revision,
        searchText: getNoteSearchText({ title: input.title, text: input.content.text }),
        title: input.title,
      }),
    ),
};

export { NOTE_KIND, NoteContent, toNote };
export type { NoteRecord };
