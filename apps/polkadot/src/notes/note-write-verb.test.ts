import { expect, test } from "vite-plus/test";

import { getAppAction } from "../app-actions";
import { projectContent$ } from "../content/project-content";
import { markdownToNote, noteToMarkdown } from "./note-markdown";

const PROJECT_ID = "project:test";
const NOTE_ID = "content_item:note-1";

const CONTEXT = {
  actions: undefined as never,
  canvasId: "canvas_document:canvas-1",
  canvasTitle: "Main canvas",
  goToCanvas: () => undefined,
  projectId: PROJECT_ID,
  refreshRoute: () => undefined,
  state: undefined as never,
};

const seed = (markdown: string) => {
  projectContent$.set({
    items: [
      {
        content: { text: markdownToNote(markdown) },
        id: NOTE_ID,
        kind: "note",
        revision: 0,
        title: "Untitled",
      },
    ],
    projectId: PROJECT_ID,
  });
};

const storedAfterWriting = (markdown: string): string => {
  getAppAction("note.write")?.run(CONTEXT, { itemId: NOTE_ID, text: markdown });

  const item = projectContent$.peek()?.items.find((candidate) => candidate.id === NOTE_ID);

  return noteToMarkdown((item?.content as { text?: string } | undefined)?.text ?? "");
};

test("a fenced block written as markdown is stored as a code block", () => {
  seed("nothing yet");

  expect(storedAfterWriting("```js\nconst a = 1;\n```")).toBe("```js\nconst a = 1;\n```");
});

test("a heading is stored as a heading, not as its words", () => {
  seed("nothing yet");

  expect(storedAfterWriting("# Title")).toBe("# Title");
});

test("read, edit one word, write: the other blocks are untouched", () => {
  seed("# Title\n\n```js\nconst a = 1;\n```\n\n- one");

  const read = getAppAction("note.read")?.run(CONTEXT, { itemId: NOTE_ID });
  const edited = String(read).replace("Title", "Retitled");
  const after = storedAfterWriting(edited);

  expect(after).toContain("# Retitled");
  expect(after).toContain("```js");
  expect(after).toContain("const a = 1;");
  expect(after).toContain("- one");
});
