import { expect, test } from "vite-plus/test";

import { getNoteText, toSerializedNote } from "./note-text";

/**
 * What the plain-text pair costs a note, and why the vocabulary no longer uses it.
 *
 * `toSerializedNote` splits on newlines and makes a paragraph of each line, so anything round
 * tripped through it keeps its words and loses its blocks. `note.read` and `note.write` were built
 * on this pair, which meant a caller fixing one typo replaced every code block, heading, list and
 * quote with a paragraph. They run on `note-markdown.ts` now — `note-markdown.test.ts` holds the
 * round trip that survives.
 *
 * These stay as characterization tests because the pair itself stays: `getNoteText` feeds the search
 * index and the far-zoom summary, which want the words and no engine. What is pinned here is the
 * cost of using it for anything else.
 */

/** A note the editor would produce from ```` ```js ```` plus a fenced line. */
const NOTE_WITH_A_CODE_BLOCK = JSON.stringify({
  root: {
    children: [
      {
        children: [{ detail: 0, format: 0, mode: "normal", text: "const a = 1;", type: "text" }],
        language: "javascript",
        type: "code",
      },
    ],
    type: "root",
  },
});

const typesIn = (serialized: string): readonly string[] => {
  const parsed: unknown = JSON.parse(serialized);
  const root = (parsed as { root: { children: readonly { type: string }[] } }).root;

  return root.children.map((child) => child.type);
};

test("a code block survives being read", () => {
  expect(getNoteText(NOTE_WITH_A_CODE_BLOCK)).toBe("const a = 1;");
  expect(typesIn(NOTE_WITH_A_CODE_BLOCK)).toEqual(["code"]);
});

test("and does not survive being written back", () => {
  const returned = toSerializedNote(getNoteText(NOTE_WITH_A_CODE_BLOCK));

  expect(typesIn(returned)).toEqual(["paragraph"]);
});

/** The same loss, for the blocks a note is far more likely to hold than a code block. */
test("a heading and a list item come back as paragraphs too", () => {
  const note = JSON.stringify({
    root: {
      children: [
        { children: [{ text: "Title", type: "text" }], tag: "h1", type: "heading" },
        { children: [{ text: "One", type: "text" }], type: "listitem" },
      ],
      type: "root",
    },
  });

  expect(typesIn(toSerializedNote(getNoteText(note)))).toEqual(["paragraph", "paragraph"]);
});
