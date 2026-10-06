import { InfiniteCanvasProvider } from "@hyphened/infinite-canvas/legacy";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vite-plus/test";

import { projectListings$ } from "../content/project-content";
import { EmptyProjectInvitation } from "./empty-project";

const render = (projectId: string) =>
  renderToStaticMarkup(
    <InfiniteCanvasProvider initialState={{ windows: [] }}>
      <EmptyProjectInvitation projectId={projectId} onCreate={() => undefined} />
    </InfiniteCanvasProvider>,
  );

test("an unloaded project has no empty-state invitation", () => {
  expect(render("project:unloaded_invitation")).toBe("");
  projectListings$["project:pending_invitation"].set(null);
  expect(render("project:pending_invitation")).toBe("");
});

test("an empty project offers note creation", () => {
  const projectId = "project:empty_invitation";
  projectListings$[projectId].set({ projectId, items: [] });
  expect(render(projectId)).toContain("This project is empty");
  expect(render(projectId)).toContain("New note");
});

test("closing all windows does not make a populated project empty", () => {
  const projectId = "project:populated_invitation";
  projectListings$[projectId].set({
    projectId,
    items: [
      {
        id: "content_item:closed_note",
        kind: "note",
        content: {},
        revision: 1,
        title: "Closed note",
      },
    ],
  });
  expect(render(projectId)).toBe("");
});
