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

/** Characters of context kept on each side of the matched term. */
const EXCERPT_REACH = 34;

/**
 * The words around the search term, or null when the row already shows why it matched.
 *
 * Search reads an item's body, so a query can match text no part of the row displays: searching
 * "catalogue" returned a note titled "models.dev" and nothing on screen contained the word. The
 * excerpt is the answer to "why is this here".
 *
 * Null when the term is in the title, because the row is already showing the match, and null when
 * the body does not contain it — a second line repeating the title explains nothing.
 */
function getContentSearchExcerpt(record: ContentItemRecord, query: string): string | null {
  const [term] = getSearchTerms(query);
  const words = CONTENT_WORDS[record.kind];

  if (term === undefined || words === undefined || record.title.toLowerCase().includes(term)) {
    return null;
  }

  const body = words(record.content as Record<string, unknown>);
  const at = body.toLowerCase().indexOf(term);

  if (at === -1) {
    return null;
  }

  const from = Math.max(at - EXCERPT_REACH, 0);
  const to = Math.min(at + term.length + EXCERPT_REACH, body.length);

  return `${from === 0 ? "" : "…"}${body.slice(from, to).trim()}${to === body.length ? "" : "…"}`;
}

export { getContentSearchExcerpt, getContentSearchText, matchesContentSearch };
