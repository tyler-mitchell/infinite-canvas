import { expect, test } from "vite-plus/test";

import { getAppAction } from "../app-actions";
import { projectListings$ } from "../content/project-content";
import { markdownToNote } from "./note-markdown";

const PROJECT_ID = "project:test";
const NOTE_ID = "content_item:note-1";

const readNote = (markdown: string): unknown => {
  projectListings$[PROJECT_ID].set({
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
      dispatch: undefined as never,
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

test("a note of mixed blocks reads as the markdown that would produce it", () => {
  const answer = readNote("# Title\n\n- one\n- two\n\n> said");

  expect(answer).toContain("# Title");
  expect(answer).toContain("- one");
  expect(answer).toContain("> said");
});
