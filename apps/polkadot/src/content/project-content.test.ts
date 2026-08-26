import { expect, test } from "vite-plus/test";

import { getProjectContent, getProjectContentOfKind } from "./project-content";

/**
 * The listing that decides what the library can show.
 *
 * Its project guard is the part worth pinning: this cache is a module singleton, so between
 * navigating to another project and its first query landing it still holds the previous project's
 * items — and a reader that trusted them would show one project's contents under another's name.
 */

const item = (id: string, kind: string) => ({
  content: {},
  id,
  kind,
  revision: 1,
  title: id,
  updated_at: "2026-08-26T00:00:00Z",
});

const listing = {
  items: [item("a", "note"), item("b", "image"), item("c", "link"), item("d", "note")],
  projectId: "project:one",
};

test("a listing is returned for the project it belongs to", () => {
  expect(getProjectContent(listing, "project:one")).toHaveLength(4);
});

test("another project's listing reads as no answer, not as an empty one", () => {
  /*
   * `null` rather than `[]`, and the difference is the whole point: the rail draws "nothing here
   * yet" for an empty answer and draws nothing at all for a missing one. Returning `[]` here would
   * tell someone who just switched project that their new project is empty, in the moment before
   * the query lands.
   */
  expect(getProjectContent(listing, "project:two")).toBeNull();
  expect(getProjectContent(null, "project:one")).toBeNull();
});

test("every kind is listed, which is what makes it a library rather than a note list", () => {
  const kinds = getProjectContent(listing, "project:one")?.map((entry) => entry.kind);

  expect(new Set(kinds)).toEqual(new Set(["note", "image", "link"]));
});

test("narrowing to a kind keeps the project guard", () => {
  // Mentions ask for notes. Asking the wrong project must still answer null rather than an empty
  // mention menu, which reads as "this note has no neighbours".
  expect(getProjectContentOfKind(listing, "project:one", "note")).toHaveLength(2);
  expect(getProjectContentOfKind(listing, "project:two", "note")).toBeNull();
});

test("a kind nothing matches is an empty list, not a missing answer", () => {
  // The project answered; it has no collections. That is a real "none", unlike the guard above.
  expect(getProjectContentOfKind(listing, "project:one", "collection")).toEqual([]);
});
