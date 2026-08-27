import { getNoteText } from "../notes/note-text";
import type { ContentItemRecord } from "../database/database.client";
import { getSearchTerms, matchesSearchTerms } from "../text-search";

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

/**
 * The last text derived for each item, so a keystroke does not re-derive the whole library.
 *
 * Deriving a note's words means `JSON.parse` over its entire serialized editor state and a walk of
 * the tree, and the rail filters every item on every keystroke. Measured before adding this: 0.10
 * ms per keystroke at 25 notes, 1.33 ms at 200, and **13.16 ms at 1000 notes holding 5.4 MB of
 * editor state** — about 80% of a 16.7 ms frame, on the main thread, between one letter and the
 * next. The first two are free and the third drops frames while you type.
 *
 * Keyed by id and holding the inputs, rather than keyed by `id:revision`. A content item's revision
 * advances on every save, so keying on the pair would leave a dead entry per edit and grow without
 * bound over a session; one entry per item, replaced when its inputs move, is bounded by the size
 * of the library — which is already in memory.
 *
 * **It validates on the title as well as the revision, and that is not belt-and-braces.** Revision
 * is the obvious key and it is not sufficient: `setProjectItemTitle` folds a committed rename into
 * the cached listing in place, `{ ...item, title }`, deliberately leaving revision alone so the
 * rename does not race the kind's own writer. So a renamed note keeps its revision, and a cache
 * trusting revision alone would serve the old title and leave the note unfindable by its new name
 * until a reload. Validating on exactly the two fields the text is derived from cannot drift from
 * how the text is built.
 */
const derived = new Map<string, Readonly<{ revision: number; text: string; title: string }>>();

/** Everything one listed item can be matched against, lowercased once for the caller's loop. */
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

/**
 * Whether an item matches what was typed, every term having to appear somewhere.
 *
 * Every term rather than any, which is what makes a second word narrow a list instead of widening
 * it — the behaviour a search box is expected to have and the one a bare `includes` of the raw
 * query does not give, since that requires the words in the typed order and adjacent.
 */
function matchesContentSearch(record: ContentItemRecord, query: string): boolean {
  const terms = getSearchTerms(query);

  if (terms.length === 0) {
    return true;
  }

  // Derived only once the query is non-empty: an empty box matches everything without paying for a
  // thousand notes' worth of editor state.
  return matchesSearchTerms(getContentSearchText(record), terms);
}

export { getContentSearchText, matchesContentSearch };
