import { expect, test } from "vite-plus/test";

import { markdownToNote, noteToMarkdown } from "./note-markdown";

/**
 * What markdown does to a note that names another note.
 *
 * A mention is a `TextNode` subclass carrying the target's id in `NodeState`, and the id is the
 * whole point: the text is only what the note was called at the time, and nothing resolves the note
 * by that string. Markdown has no syntax for it and `TRANSFORMERS` has no transformer for it, so the
 * export writes the words and the import reads them back as ordinary text.
 */

const NOTE_WITH_A_MENTION = JSON.stringify({
  root: {
    children: [
      {
        children: [
          { detail: 0, format: 0, mode: "normal", style: "", text: "see ", type: "text" },
          {
            detail: 0,
            format: 0,
            mode: "segmented",
            noteId: "content_item:target",
            style: "",
            text: "@Quarterly",
            type: "mention",
          },
        ],
        type: "paragraph",
      },
    ],
    type: "root",
  },
});

const firstParagraphChildren = (serialized: string): readonly Record<string, unknown>[] => {
  const parsed: unknown = JSON.parse(serialized);
  const root = (
    parsed as { root: { children: readonly { children: Record<string, unknown>[] }[] } }
  ).root;

  return root.children[0]?.children ?? [];
};

test("a mention leaves as an ordinary markdown link to the record", () => {
  expect(noteToMarkdown(NOTE_WITH_A_MENTION)).toBe("see [@Quarterly](content_item:target)");
});

test("and comes back a mention, still pointing at the same note", () => {
  const children = firstParagraphChildren(markdownToNote(noteToMarkdown(NOTE_WITH_A_MENTION)));
  const mention = children.find((child) => child.type === "mention");

  expect(mention?.text).toBe("@Quarterly");
  expect(mention?.noteId).toBe("content_item:target");
});

/** The reason the import is keyed to the destination rather than to the bracket shape. */
test("a real link whose text starts with @ stays a link", () => {
  const children = firstParagraphChildren(
    markdownToNote("ask [@someone](https://example.com/someone)"),
  );

  expect(children.some((child) => child.type === "mention")).toBe(false);
  expect(children.some((child) => child.type === "link")).toBe(true);
});

/** A link to nothing is worse than the words, so a mention with no id exports as its text. */
test("a mention carrying no id falls through to its words", () => {
  const withoutId = JSON.stringify({
    root: {
      children: [
        {
          children: [
            {
              detail: 0,
              format: 0,
              mode: "segmented",
              style: "",
              text: "@Orphan",
              type: "mention",
            },
          ],
          type: "paragraph",
        },
      ],
      type: "root",
    },
  });

  expect(noteToMarkdown(withoutId)).toBe("@Orphan");
});
