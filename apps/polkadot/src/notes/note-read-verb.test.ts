import { expect, test } from "vite-plus/test";

import { getAppAction } from "../app-actions";
import { projectContent$ } from "../content/project-content";
import { markdownToNote } from "./note-markdown";

/**
 * `note.read` at the verb, not at the conversion.
 *
 * `note-markdown.test.ts` proves the round trip; this proves the vocabulary actually uses it. The
 * two were separately true once before — the conversion existed while the verb still ran plain text
 * — and nothing in a typecheck connects them.
 *
 * The fixture is built with `markdownToNote`, so the stored state is one the editor would produce
 * rather than JSON written from memory of the format, which is the rule `note-text.test.ts` records.
 */

const PROJECT_ID = "project:test";
const NOTE_ID = "content_item:note-1";

const readNote = (markdown: string): unknown => {
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

  return getAppAction("note.read")?.run(
    {
      actions: undefined as never,
      canvasId: "canvas_document:canvas-1",
      canvasTitle: "Main canvas",
      goToCanvas: () => undefined,
      projectId: PROJECT_ID,
      refreshRoute: () => undefined,
      state: undefined as never,
    },
    { itemId: NOTE_ID },
  );
};

test("a fenced block comes back fenced, with its language", () => {
  expect(readNote("```js\nconst a = 1;\n```")).toBe("```js\nconst a = 1;\n```");
});

test("a heading comes back a heading rather than its words alone", () => {
  expect(readNote("# Title")).toBe("# Title");
});

/** The shape a caller actually reads before editing: several blocks, all of them intact. */
test("a note of mixed blocks reads as the markdown that would produce it", () => {
  const answer = readNote("# Title\n\n- one\n- two\n\n> said");

  expect(answer).toContain("# Title");
  expect(answer).toContain("- one");
  expect(answer).toContain("> said");
});
