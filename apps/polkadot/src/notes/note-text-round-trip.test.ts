import { expect, test } from "vite-plus/test";

import { getNoteText, toSerializedNote } from "./note-text";

/**
 * What `note.read` then `note.write` costs a note, which is the shape an agent edits in.
 *
 * The vocabulary reads a note as text and writes it as text: `note.write` runs its argument through
 * `toSerializedNote`, which splits on newlines and makes a paragraph of each line. So an agent asked
 * to fix a typo — read, change one word, write — replaces every block in the note with paragraphs,
 * and nothing tells it or the reader that happened.
 *
 * These are characterization tests. They assert the loss rather than a fix, so the cost is stated
 * and a change that stops it fails them loudly instead of passing quietly.
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
