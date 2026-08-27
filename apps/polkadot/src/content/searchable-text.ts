import { getNoteText } from "../notes/note-text";
import type { ContentItemRecord } from "../database/database.client";

/**
 * The words a listed item can be found by.
 *
 * The library rail's search matched `title` and nothing else, which in an app where new notes are
 * called "Untitled 7" is close to no search at all: typing a phrase visibly on screen in a note's
 * body returned "Nothing matches that", measured on 2026-08-27.
 *
 * **Derived from the record rather than read from `search_text`, deliberately.** The column exists,
 * every gateway writes it on create and save, and it is the right place for this to live one day —
 * but it is a plain `string` field with no analyzer and no `SEARCH` index behind it, it is absent
 * from `ContentItemRecord` so nothing can read it back, and every note written before today holds a
 * serialized editor state in it. Deriving from the content the listing already carries is correct
 * for records that exist now, needs no migration and no reindex, and leaves the stored column free
 * to become a real full-text index later without this changing.
 *
 * The honest limit, stated because a search box implies more than this does: it filters the
 * in-memory listing for one project. There is no server-side search. At a few hundred items that is
 * indistinguishable from one; at a few thousand it will not be, and the answer then is the index
 * the schema is already shaped for, not a faster loop.
 */

/**
 * What each kind adds to its title, by kind.
 *
 * A map rather than a chain of conditionals, and only the kinds whose content shape has actually
 * been read. An unlisted kind is findable by name — which is what it was before, so a new kind
 * loses nothing by not appearing here and gains by being added.
 */
const CONTENT_WORDS: Readonly<
  Record<string, (content: Readonly<Record<string, unknown>>) => string>
> = {
  // A note's `text` is a serialized editor state; `getNoteText` is the only thing that reads it.
  note: (content) => (typeof content.text === "string" ? getNoteText(content.text) : ""),
  // Half of finding a link is remembering where it went — the same reasoning `link-gateway` gives
  // for putting the address in its stored search text.
  link: (content) =>
    [content.url, content.host]
      .filter((part): part is string => typeof part === "string")
      .join(" "),
};

/** Everything one listed item can be matched against, lowercased once for the caller's loop. */
function getContentSearchText(record: ContentItemRecord): string {
  const words = CONTENT_WORDS[record.kind];
  const extra = words === undefined ? "" : words(record.content as Record<string, unknown>);

  return `${record.title} ${extra}`.toLowerCase();
}

/**
 * Whether an item matches what was typed, every term having to appear somewhere.
 *
 * Every term rather than any, which is what makes a second word narrow a list instead of widening
 * it — the behaviour a search box is expected to have and the one a bare `includes` of the raw
 * query does not give, since that requires the words in the typed order and adjacent.
 */
function matchesContentSearch(record: ContentItemRecord, query: string): boolean {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);

  if (terms.length === 0) {
    return true;
  }

  const haystack = getContentSearchText(record);

  return terms.every((term) => haystack.includes(term));
}

export { getContentSearchText, matchesContentSearch };
