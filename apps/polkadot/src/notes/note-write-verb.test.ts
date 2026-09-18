import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";

import { getAppAction } from "../app-actions";
import { projectContent$, projectListings$ } from "../content/project-content";
import { markdownToNote, noteToMarkdown } from "./note-markdown";

const PROJECT_ID = "project:test";
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

const CONTEXT = {
  dispatch: undefined as never,
  canvasId: "canvas_document:canvas-1",
  canvasTitle: "Main canvas",
  goToCanvas: () => undefined,
  projectId: PROJECT_ID,
  refreshRoute: () => undefined,
  state: undefined as never,
};

const seed = ({ itemId, markdown }: Readonly<{ itemId: string; markdown: string }>) => {
  projectListings$[PROJECT_ID].set({
    items: [
      {
        content: { text: markdownToNote(markdown) },
        id: itemId,
        kind: "note",
        revision: 0,
        title: "Untitled",
      },
    ],
    projectId: PROJECT_ID,
  });
};

const storedAfterWriting = async ({
  itemId,
  markdown,
}: Readonly<{ itemId: string; markdown: string }>): Promise<string> => {
  await getAppAction("note.write")?.run(CONTEXT, { itemId, text: markdown });

  const item = projectContent$[PROJECT_ID]
    .peek()
    ?.items.find((candidate) => candidate.id === itemId);

  return noteToMarkdown((item?.content as { text?: string } | undefined)?.text ?? "");
};

test("a fenced block written as markdown is stored as a code block", async () => {
  const itemId = "content_item:code_block";
  seed({ itemId, markdown: "nothing yet" });

  expect(await storedAfterWriting({ itemId, markdown: "```js\nconst a = 1;\n```" })).toBe(
    "```js\nconst a = 1;\n```",
  );
});

test("a heading is stored as a heading, not as its words", async () => {
  const itemId = "content_item:heading";
  seed({ itemId, markdown: "nothing yet" });

  expect(await storedAfterWriting({ itemId, markdown: "# Title" })).toBe("# Title");
});

test("read, edit one word, write: the other blocks are untouched", async () => {
  const itemId = "content_item:retitled";
  seed({ itemId, markdown: "# Title\n\n```js\nconst a = 1;\n```\n\n- one" });

  // Not `String(read)`: that turns a missing action into "undefined" and a
  // promise into "[object Promise]", and the replace below then does nothing.
  const read = (await getAppAction("note.read")?.run(CONTEXT, { itemId })) ?? "";
  const edited = read.replace("Title", "Retitled");
  const after = await storedAfterWriting({ itemId, markdown: edited });

  expect(after).toContain("# Retitled");
  expect(after).toContain("```js");
  expect(after).toContain("const a = 1;");
  expect(after).toContain("- one");
});
