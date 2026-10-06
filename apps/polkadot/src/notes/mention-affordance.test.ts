import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { expect, test } from "vite-plus/test";

const SRC = fileURLToPath(new URL("..", import.meta.url));

const sourceFiles = (directory: string): readonly string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = `${directory}/${entry.name}`;

    if (entry.isDirectory()) {
      return sourceFiles(path);
    }

    return /\.tsx?$/.test(entry.name) && !entry.name.includes(".test.") ? [path] : [];
  });

const filesMatching = (pattern: RegExp) =>
  sourceFiles(SRC)
    .filter((path) => pattern.test(readFileSync(path, "utf8")))
    .map((path) => path.slice(SRC.length));

test("the note id a mention writes is read by something", () => {
  const writers = filesMatching(/dataset\.noteId\s*=/);
  const readers = filesMatching(/\[data-note-id\]/);

  expect(writers, "nothing writes the mention's note id").not.toStrictEqual([]);
  expect(
    readers,
    "the mention chip draws a pointer cursor and writes a note id that nothing reads — clicking one does nothing",
  ).not.toStrictEqual([]);
});

test("a link in a note can be followed, not just drawn as one", () => {
  const editor = readFileSync(`${SRC}notes/note-editor.tsx`, "utf8");

  expect(editor.includes("LinkExtension"), "links are not mounted at all").toBe(true);
  expect(
    editor.includes("ClickableLinkExtension"),
    "a note renders links that cannot be followed",
  ).toBe(true);
  expect(editor.includes("newTab: true")).toBe(true);
});

test("the mention's appearance comes from the editor theme, not from the node", () => {
  const node = readFileSync(`${SRC}notes/mention-node.ts`, "utf8");

  expect(node.includes("ui/tv"), "a Lexical node should not import the styling system").toBe(false);
  expect(node.includes("config.theme.mention")).toBe(true);
  expect(
    readFileSync(`${SRC}notes/note-editor.tsx`, "utf8").includes("mention: styles.mention()"),
  ).toBe(true);
});
