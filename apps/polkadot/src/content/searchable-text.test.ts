import { expect, test } from "vite-plus/test";

import type { ContentItemRecord } from "../database/database.client";
import { getContentSearchText, matchesContentSearch } from "./searchable-text";

/**
 * What the library search matches against, and when it notices a record has changed.
 *
 * Deriving a note's words means `JSON.parse` over its whole serialized editor state and a walk of
 * the tree, and the rail does it for every item on every keystroke. Measured: 0.10 ms per keystroke
 * at 25 notes, 1.33 ms at 200, and 13.16 ms at 1000 notes holding 5.4 MB — about 80% of a 16.7 ms
 * frame, between one letter and the next. With the derived text cached, the same three are 0.03,
 * 0.13 and 0.86 ms.
 *
 * The cache is only worth having if it cannot serve a stale answer, so most of this file is about
 * invalidation rather than speed.
 */

const serialized = (...paragraphs: readonly string[]) =>
  JSON.stringify({
    root: {
      children: paragraphs.map((text) => ({
        children: [
          { detail: 0, format: 0, mode: "normal", style: "", text, type: "text", version: 1 },
        ],
        direction: null,
        format: "",
        indent: 0,
        type: "paragraph",
        version: 1,
      })),
      direction: null,
      format: "",
      indent: 0,
      type: "root",
      version: 1,
    },
  });

/**
 * `id` is required, and that is the point rather than an oversight.
 *
 * The cache is keyed by id, so two fixtures sharing one can answer for each other and a test can
 * pass or fail for a reason belonging to the test above it. A default id made exactly that happen
 * while this file was being written: three tests shared `content_item:one`, and the second read the
 * first's derived text. Making the caller name it is the cheapest way to stop that recurring.
 */
const note = (
  input: Readonly<{ body?: string; id: string; revision?: number; title: string }>,
): ContentItemRecord => ({
  content: { text: serialized(input.body ?? "nothing in particular") },
  id: input.id,
  kind: "note",
  revision: input.revision ?? 1,
  title: input.title,
});

test("a note is matched by its prose, not by the envelope that stores it", () => {
  const record = note({
    body: "kind-generic content items",
    id: "content_item:prose",
    title: "Untitled 7",
  });

  expect(matchesContentSearch(record, "generic")).toBe(true);
  // The serialized state is full of these; none of them is a word in the note.
  expect(matchesContentSearch(record, "paragraph")).toBe(false);
  expect(matchesContentSearch(record, "version")).toBe(false);
});

test("every term must appear, so a second word narrows rather than widens", () => {
  const record = note({ body: "alpha beta", id: "content_item:terms", title: "Untitled" });

  expect(matchesContentSearch(record, "alpha beta")).toBe(true);
  expect(matchesContentSearch(record, "alpha gamma")).toBe(false);
  // Not a raw substring of the haystack: the terms need not be adjacent or in order.
  expect(matchesContentSearch(record, "beta alpha")).toBe(true);
});

test("an empty query matches everything rather than nothing", () => {
  expect(matchesContentSearch(note({ id: "content_item:empty", title: "Untitled" }), "   ")).toBe(
    true,
  );
});

test("a link is findable by its address, which is half of remembering a link", () => {
  const link: ContentItemRecord = {
    content: { host: "example.com", url: "https://example.com/spec" },
    id: "content_item:l",
    kind: "link",
    revision: 1,
    title: "The spec",
  };

  expect(matchesContentSearch(link, "example.com")).toBe(true);
  expect(matchesContentSearch(link, "spec")).toBe(true);
});

test("a kind nobody has taught it is still findable by name", () => {
  const image: ContentItemRecord = {
    content: { width: 100 },
    id: "content_item:i",
    kind: "image",
    revision: 1,
    title: "corner-a.png",
  };

  expect(matchesContentSearch(image, "corner")).toBe(true);
});

/**
 * The invalidation cases, which are the whole reason the cache is safe to have.
 *
 * Each uses a distinct id, because the cache is keyed by id and a shared one would let an earlier
 * test's entry answer a later one — the test file's own version of the bug it is checking for.
 */

test("a bumped revision is noticed, so an edited note is findable by its new words", () => {
  const before = note({ body: "original wording", id: "content_item:edit", title: "Note" });

  expect(matchesContentSearch(before, "original")).toBe(true);

  const after = note({
    body: "replacement wording",
    id: "content_item:edit",
    revision: 2,
    title: "Note",
  });

  expect(matchesContentSearch(after, "replacement")).toBe(true);
  expect(matchesContentSearch(after, "original")).toBe(false);
});

test("a rename is noticed even though it does not bump the revision", () => {
  /*
   * The case a revision-only cache gets wrong, and it is reachable by an ordinary rename.
   *
   * `setProjectItemTitle` folds a committed rename into the cached listing in place —
   * `{ ...item, title }` — deliberately leaving revision alone so the rename does not race the
   * kind's own writer. A cache trusting revision alone would keep serving the old title and the
   * note would be unfindable by its new name until a reload.
   */
  const before = note({ id: "content_item:rename", title: "Draft" });

  expect(matchesContentSearch(before, "draft")).toBe(true);

  const renamed = note({ id: "content_item:rename", title: "Chapter two" });

  expect(renamed.revision).toBe(before.revision);
  expect(matchesContentSearch(renamed, "chapter")).toBe(true);
  expect(matchesContentSearch(renamed, "draft")).toBe(false);
});

test("two items never answer for each other", () => {
  const first = note({ body: "first body", id: "content_item:a", title: "First" });
  const second = note({ body: "second body", id: "content_item:b", title: "Second" });

  expect(getContentSearchText(first)).toContain("first body");
  expect(getContentSearchText(second)).toContain("second body");
  expect(getContentSearchText(first)).not.toContain("second");
});

test("repeated reads of an unchanged record agree", () => {
  const record = note({ body: "stable", id: "content_item:stable", title: "Stable" });

  expect(getContentSearchText(record)).toBe(getContentSearchText(record));
});
