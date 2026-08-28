import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { expect, test } from "vite-plus/test";

/**
 * The mention chip promises a destination, so something has to take you there.
 *
 * `MentionNode.createDOM` writes `data-note-id` and the theme gives the chip `cursor-pointer`. Both
 * are promises to the person reading the note: this is a thing, and clicking it goes somewhere. From
 * the day the node was written until 2026-08-28 nothing read the attribute — `MentionNode` was
 * referenced by three files, none of them a listener — so the pointer changed shape over nothing and
 * a click did exactly nothing.
 *
 * That failure is invisible to every other check. It compiles, it renders, it has no error, and the
 * node's own docstring described the handler as though it existed. Only clicking one finds it, and
 * only if you already suspected.
 *
 * So this is a scan rather than a behaviour test. The behaviour needs a browser — the click path
 * runs through Lexical's DOM and the canvas's window placement, and this app has no browser tests.
 * What a scan can hold is the pairing: the attribute is written in one place and read in another,
 * and deleting either end breaks this rather than going quiet.
 */

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
  // `dataset.noteId` is the write; `[data-note-id]` is how a listener finds it from an event target.
  const writers = filesMatching(/dataset\.noteId\s*=/);
  const readers = filesMatching(/\[data-note-id\]/);

  expect(writers, "nothing writes the mention's note id").not.toStrictEqual([]);
  expect(
    readers,
    "the mention chip draws a pointer cursor and writes a note id that nothing reads — clicking one does nothing",
  ).not.toStrictEqual([]);
});

test("the mention's appearance comes from the editor theme, not from the node", () => {
  /*
   * The node styled itself with its own `tv` slot, which is a second home for what a note looks
   * like — the rule `EDITOR_THEME` states in its own docstring. Keying it in the theme is the
   * library's mechanism and leaves the node with no styling dependency at all.
   */
  const node = readFileSync(`${SRC}notes/mention-node.ts`, "utf8");

  expect(node.includes("ui/tv"), "a Lexical node should not import the styling system").toBe(false);
  expect(node.includes("config.theme.mention")).toBe(true);
  expect(
    readFileSync(`${SRC}notes/note-editor.tsx`, "utf8").includes("mention: styles.mention()"),
  ).toBe(true);
});
