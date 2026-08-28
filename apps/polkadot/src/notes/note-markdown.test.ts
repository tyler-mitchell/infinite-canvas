import { expect, test } from "vite-plus/test";

import { markdownToNote, noteToMarkdown } from "./note-markdown";

/**
 * The round trip `note-text-round-trip.test.ts` says the plain-text path cannot make.
 *
 * Each test reads what a caller would get, edits it the way a caller would, writes it back, and
 * asserts the block is still the block. Asserting the markdown alone would prove the export and
 * nothing about the import.
 */

const typesIn = (serialized: string): readonly string[] => {
  const parsed: unknown = JSON.parse(serialized);
  const root = (parsed as { root: { children: readonly { type: string }[] } }).root;

  return root.children.map((child) => child.type);
};

const nodeIn = (serialized: string, index: number): Record<string, unknown> => {
  const parsed: unknown = JSON.parse(serialized);
  const root = (parsed as { root: { children: readonly Record<string, unknown>[] } }).root;

  return root.children[index] ?? {};
};

/*
 * The fence's own word is stored, not a canonical id: ```js gives `js`, not `javascript`. That is
 * the alias/canonical split the language picker needs `normalizeCodeLanguage` for, and the property
 * worth pinning is that whatever went in comes back — a canonical form asserted here would be this
 * test deciding a question that belongs to Shiki.
 */
test("a fenced block survives a read and a write, and keeps its language", () => {
  const written = markdownToNote("```js\nconst a = 1;\n```");

  expect(typesIn(written)).toEqual(["code"]);
  expect(nodeIn(written, 0).language).toBe("js");

  const returned = markdownToNote(noteToMarkdown(written));

  expect(typesIn(returned)).toEqual(["code"]);
  expect(nodeIn(returned, 0).language).toBe("js");
});

test("a heading keeps its level rather than flattening to a paragraph", () => {
  const written = markdownToNote("# Title");

  expect(typesIn(written)).toEqual(["heading"]);
  expect(nodeIn(written, 0).tag).toBe("h1");
  expect(typesIn(markdownToNote(noteToMarkdown(written)))).toEqual(["heading"]);
});

test("a list stays a list", () => {
  const written = markdownToNote("- one\n- two");

  expect(typesIn(written)).toEqual(["list"]);
  expect(typesIn(markdownToNote(noteToMarkdown(written)))).toEqual(["list"]);
});

test("a quote stays a quote", () => {
  const written = markdownToNote("> said");

  expect(typesIn(written)).toEqual(["quote"]);
  expect(typesIn(markdownToNote(noteToMarkdown(written)))).toEqual(["quote"]);
});

/** The edit a caller actually makes: read, change a word, write, and keep everything else. */
test("editing one word leaves the blocks around it alone", () => {
  const written = markdownToNote("# Title\n\n```js\nconst a = 1;\n```\n\n- one");
  const edited = markdownToNote(noteToMarkdown(written).replace("Title", "Retitled"));

  expect(typesIn(edited)).toEqual(["heading", "code", "list"]);
  expect(noteToMarkdown(edited)).toContain("Retitled");
  expect(noteToMarkdown(edited)).toContain("const a = 1;");
});
