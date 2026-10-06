import { expect, test } from "vite-plus/test";

import type { ContentItemRecord } from "../database/database.client";
import {
  getContentSearchExcerpt,
  getContentSearchText,
  matchesContentSearch,
} from "./searchable-text";

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

// Each fixture needs a distinct cache key.
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
  expect(matchesContentSearch(record, "paragraph")).toBe(false);
  expect(matchesContentSearch(record, "version")).toBe(false);
});

test("a body match carries the words around it, because the row does not show them", () => {
  /*
   * The defect this closes: searching "catalogue" returned a note titled "models.dev" and nothing
   * on screen contained the word. Search reads the body, so a result can be a row whose visible
   * text does not explain why it is there.
   */
  const record = note({
    body: "Supplies the model catalogue to every agent that asks",
    id: "content_item:excerpt",
    title: "models.dev",
  });

  // Context runs forward from the term, because the row clips the end and keeps the start.
  expect(getContentSearchExcerpt(record, "catalogue")).toContain("catalogue");
  expect(getContentSearchExcerpt(record, "catalogue")).toContain("to every agent");
});

test("a title match adds no line, because the row is already showing it", () => {
  /*
   * The body repeats the term on purpose. With a body that lacked it, this would pass through the
   * "not in the body either" branch and hold even with the title check deleted — a test that
   * agrees with the code for the wrong reason.
   */
  const record = note({
    body: "half of the limits apply",
    id: "content_item:title",
    title: "Half limits",
  });

  expect(getContentSearchExcerpt(record, "half")).toBeNull();
});

test("a term in neither title nor body adds nothing rather than repeating the note", () => {
  const record = note({ body: "alpha", id: "content_item:none", title: "Beta" });

  expect(getContentSearchExcerpt(record, "gamma")).toBeNull();
  expect(getContentSearchExcerpt(record, "  ")).toBeNull();
});

test("a match deep in a long note is clipped on both sides", () => {
  const filler = "word ".repeat(40);
  const record = note({
    body: `${filler}needle${filler}`,
    id: "content_item:long",
    title: "Untitled",
  });
  const excerpt = getContentSearchExcerpt(record, "needle") ?? "";

  expect(excerpt.startsWith("…")).toBe(true);
  expect(excerpt.endsWith("…")).toBe(true);
  expect(excerpt).toContain("needle");
  // Bounded, so one long note cannot push a rail row to any width it likes.
  expect(excerpt.length).toBeLessThan(80);
});

/*
 * The rail clips this line at roughly 34 monospace characters. Centring the term put it past that,
 * so the row explained its own match with the one word it cut. The term has to survive the clip.
 */
const RAIL_CHARACTERS = 34;

test("the term survives the clip the row applies, which is the whole point of the line", () => {
  const filler = "word ".repeat(40);
  const record = note({
    body: `${filler}needle${filler}`,
    id: "content_item:clipped",
    title: "Untitled",
  });
  const excerpt = getContentSearchExcerpt(record, "needle") ?? "";

  expect(excerpt.slice(0, RAIL_CHARACTERS)).toContain("needle");
});

test("every term must appear, so a second word narrows rather than widens", () => {
  const record = note({ body: "alpha beta", id: "content_item:terms", title: "Untitled" });

  expect(matchesContentSearch(record, "alpha beta")).toBe(true);
  expect(matchesContentSearch(record, "alpha gamma")).toBe(false);
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
