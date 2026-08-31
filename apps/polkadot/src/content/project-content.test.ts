import { expect, test } from "vite-plus/test";

import { getProjectContent, getProjectContentOfKind } from "./project-content";

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
  expect(getProjectContent(listing, "project:two")).toBeNull();
  expect(getProjectContent(null, "project:one")).toBeNull();
});

test("every kind is listed, which is what makes it a library rather than a note list", () => {
  const kinds = getProjectContent(listing, "project:one")?.map((entry) => entry.kind);

  expect(new Set(kinds)).toEqual(new Set(["note", "image", "link"]));
});

test("narrowing to a kind keeps the project guard", () => {
  expect(getProjectContentOfKind({ kind: "note", listing, projectId: "project:one" })).toHaveLength(
    2,
  );
  expect(getProjectContentOfKind({ kind: "note", listing, projectId: "project:two" })).toBeNull();
});

test("a kind nothing matches is an empty list, not a missing answer", () => {
  expect(
    getProjectContentOfKind({ kind: "collection", listing, projectId: "project:one" }),
  ).toEqual([]);
});
