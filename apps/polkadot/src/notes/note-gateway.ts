import { type } from "arktype";

import type { ContentItemRecord } from "../database/database.client";
import { content } from "../database/operations";
import { getNoteText } from "./note-text";

/**
 * A note, as the note layer sees a content item.
 *
 * There has never been a `note` table — a note is a `content_item` with `kind = "note"` and a
 * `content` object the database stores without reading. This module is the one place that knows
 * what goes in that object, what to call the kind, and which words make a note findable.
 *
 * Validation happens in two halves, on purpose. `ContentItemRecord` proves the envelope came back
 * with an id, a kind, a revision and *some* content; `NoteContent` proves that content is a note's.
 * Neither half can do the other's job: the database layer cannot know a note has text, and this
 * layer should not restate what every kind already shares.
 */

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

/**
 * What makes a note findable: its name and its prose.
 *
 * Derived here rather than in SurrealQL, which is the one thing the generic content functions gave
 * up. No expression over an arbitrary `content` object could find the words — an image's
 * searchable text is its description, and the two shapes share no field — so the kind that knows
 * hands them over.
 *
 * `draft.text` is a serialized editor state, and this used to interpolate it whole. So the index
 * entry for a note reading "see @Untitled 7" was 445 characters of `type`, `format`, `version`,
 * `paragraph`, `normal` and a raw record id, with fifteen characters of prose in it — every note
 * matching every one of those words, and none of them matching what the note is about.
 */
function getNoteSearchText(draft: Readonly<{ text: string; title: string }>) {
  return `${draft.title} ${getNoteText(draft.text)}`;
}

/**
 * Note operations, and only the ones that need to know what a note is.
 *
 * Archiving and restoring are deliberately absent. They take a record id and work on any content
 * item, so `content.archive` is what callers use — aliasing them here would put a note's name on an
 * operation that never reads a note.
 *
 * Named for the object rather than the plural, unlike `content` and `canvases`, because half the
 * files that consume it already have a local `notes` holding a list of them, and a facade that
 * shadows silently is worse than one that reads a little longer.
 */
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
