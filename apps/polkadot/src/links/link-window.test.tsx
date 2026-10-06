import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, test, vi } from "vite-plus/test";

import { projectListings$, updateProjectItem } from "../content/project-content";
import { linkGateway } from "./link-gateway";
import { LinkWindowBody } from "./link-window";

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  useLoaderData: () => ({ projectId: "project:link_title" }),
}));

afterEach(() => vi.restoreAllMocks());

test("a link rename updates its header and frame title without reloading its address", async () => {
  const record = {
    id: "content_item:renamed_link",
    revision: 1,
    title: "Current title",
    content: { host: "example.com", url: "https://example.com/" },
  };
  projectListings$["project:link_title"].set({
    projectId: "project:link_title",
    items: [{ ...record, kind: "link" }],
  });
  const read = vi
    .spyOn(linkGateway, "read")
    .mockResolvedValue({ ...record, title: "Cached old title" });
  const render = () => renderToStaticMarkup(<LinkWindowBody linkId={record.id} />);
  await vi.waitFor(() => expect(render()).toContain('title="Current title"'));
  updateProjectItem({ id: record.id, title: "Renamed title", revision: 2 });
  const markup = render();
  expect(markup).toContain(">Renamed title</span>");
  expect(markup).toContain('title="Renamed title"');
  expect(markup).toContain('src="https://example.com/"');
  expect(markup).not.toContain("Cached old title");
  expect(markup).not.toContain("Current title");
  expect(read).toHaveBeenCalledExactlyOnceWith(record.id);
});
