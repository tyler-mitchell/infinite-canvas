import { getNoteText } from "../notes/note-text";
import type { ContentItemRecord } from "../database/database.client";
import { getSearchTerms, matchesSearchTerms } from "../text-search";

const CONTENT_WORDS: Readonly<
  Record<string, (content: Readonly<Record<string, unknown>>) => string>
> = {
  // getNoteText parses the serialized editor state.
  note: (content) => (typeof content.text === "string" ? getNoteText(content.text) : ""),
  link: (content) =>
    [content.url, content.host]
      .filter((part): part is string => typeof part === "string")
      .join(" "),
};

// Revision and title changes invalidate the item cache.
const derived = new Map<string, Readonly<{ revision: number; text: string; title: string }>>();

function getContentSearchText(record: ContentItemRecord): string {
  const cached = derived.get(record.id);

  if (
    cached !== undefined &&
    cached.revision === record.revision &&
    cached.title === record.title
  ) {
    return cached.text;
  }

  const words = CONTENT_WORDS[record.kind];
  const extra = words === undefined ? "" : words(record.content as Record<string, unknown>);
  const text = `${record.title} ${extra}`.toLowerCase();

  derived.set(record.id, { revision: record.revision, text, title: record.title });

  return text;
}

function matchesContentSearch(record: ContentItemRecord, query: string): boolean {
  const terms = getSearchTerms(query);

  if (terms.length === 0) {
    return true;
  }

  // An empty query does not parse item content.
  return matchesSearchTerms(getContentSearchText(record), terms);
}

export { getContentSearchText, matchesContentSearch };
