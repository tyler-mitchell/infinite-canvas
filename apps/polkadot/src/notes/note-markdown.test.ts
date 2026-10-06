import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { expect, test } from "vite-plus/test";

import { markdownToNote, noteToMarkdown } from "./note-markdown";

const SRC = fileURLToPath(new URL(".", import.meta.url));

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

test("a link survives the round trip, url and all", () => {
  const written = markdownToNote("see [Example](https://example.com)");
  const link = (nodeIn(written, 0).children as readonly Record<string, unknown>[])[1] ?? {};

  expect(link.type).toBe("link");
  expect(link.url).toBe("https://example.com");
  expect(noteToMarkdown(written)).toContain("[Example](https://example.com)");
});

// Autolink must exist in both the editor and headless node lists.
test("the editor and the markdown node list agree about autolink", () => {
  const mounts = readFileSync(`${SRC}note-editor.tsx`, "utf8").includes("AutoLinkExtension");
  const lists = readFileSync(`${SRC}note-markdown.ts`, "utf8").includes("AutoLinkNode,");

  expect(
    lists,
    "AutoLinkNode is listed for the headless editor but nothing can produce one — or autolink was mounted and note.read now drops those urls",
  ).toBe(mounts);
});

test("editing one word leaves the blocks around it alone", () => {
  const written = markdownToNote("# Title\n\n```js\nconst a = 1;\n```\n\n- one");
  const edited = markdownToNote(noteToMarkdown(written).replace("Title", "Retitled"));

  expect(typesIn(edited)).toEqual(["heading", "code", "list"]);
  expect(noteToMarkdown(edited)).toContain("Retitled");
  expect(noteToMarkdown(edited)).toContain("const a = 1;");
});
