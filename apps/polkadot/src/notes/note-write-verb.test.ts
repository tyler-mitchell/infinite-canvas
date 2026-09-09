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

// `run` returns `string | Promise<string | undefined> | undefined`, so both
// helpers await it. Reading the store before the write settled would fail the
// assertion, and a rejected action would otherwise surface as an unhandled
// rejection rather than a failing test.
const storedAfterWriting = async (markdown: string): Promise<string> => {
  await getAppAction("note.write")?.run(CONTEXT, { itemId: NOTE_ID, text: markdown });

  const item = projectContent$.peek()?.items.find((candidate) => candidate.id === NOTE_ID);

  return noteToMarkdown((item?.content as { text?: string } | undefined)?.text ?? "");
};

test("a fenced block written as markdown is stored as a code block", async () => {
  seed("nothing yet");

  expect(await storedAfterWriting("```js\nconst a = 1;\n```")).toBe("```js\nconst a = 1;\n```");
});

test("a heading is stored as a heading, not as its words", async () => {
  seed("nothing yet");

  expect(await storedAfterWriting("# Title")).toBe("# Title");
});

test("read, edit one word, write: the other blocks are untouched", async () => {
  seed("# Title\n\n```js\nconst a = 1;\n```\n\n- one");

  // Not `String(read)`: that turns a missing action into "undefined" and a
  // promise into "[object Promise]", and the replace below then does nothing.
  const read = (await getAppAction("note.read")?.run(CONTEXT, { itemId: NOTE_ID })) ?? "";
  const edited = read.replace("Title", "Retitled");
  const after = await storedAfterWriting(edited);

  expect(after).toContain("# Retitled");
  expect(after).toContain("```js");
  expect(after).toContain("const a = 1;");
  expect(after).toContain("- one");
});
