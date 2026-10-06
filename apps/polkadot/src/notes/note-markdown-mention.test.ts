import { expect, test } from "vite-plus/test";

import { markdownToNote, noteToMarkdown } from "./note-markdown";

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

test("a real link whose text starts with @ stays a link", () => {
  const children = firstParagraphChildren(
    markdownToNote("ask [@someone](https://example.com/someone)"),
  );

  expect(children.some((child) => child.type === "mention")).toBe(false);
  expect(children.some((child) => child.type === "link")).toBe(true);
});

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
