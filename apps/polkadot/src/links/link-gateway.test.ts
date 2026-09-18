import { afterEach, expect, test, vi } from "vite-plus/test";

import { content } from "../database/operations";
import { imageGateway } from "../images/image-gateway";
import { linkGateway } from "./link-gateway";

afterEach(() => vi.restoreAllMocks());

test("a bare domain is stored as the absolute address used by its host", async () => {
  const create = vi.spyOn(content, "create").mockImplementation(async (input) => ({
    id: "content_item:link",
    revision: 0,
    kind: input.kind,
    title: input.title,
    content: input.content,
  }));
  const record = await linkGateway.create({
    projectId: "project:one",
    title: "Example",
    url: "example.com/path?q=1",
  });
  expect(create).toHaveBeenCalledExactlyOnceWith({
    projectId: "project:one",
    kind: "link",
    title: "Example",
    content: { host: "example.com", url: "https://example.com/path?q=1" },
    searchText: "Example https://example.com/path?q=1",
  });
  expect(record.content.url).toBe("https://example.com/path?q=1");
});

test.each([
  [
    "link",
    linkGateway,
    { host: "example.com", url: "https://example.com/", annotation: { text: "Keep me" } },
  ],
  [
    "image",
    imageGateway,
    {
      description: "Diagram",
      source: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg"/>')}`,
      annotation: { text: "Keep me" },
    },
  ],
] as const)("renaming %s preserves extension fields", async (kind, gateway, original) => {
  const save = vi.spyOn(content, "save").mockImplementation(async (input) => ({
    id: input.itemId,
    revision: input.revision + 1,
    kind,
    title: input.title,
    content: input.content,
  }));
  const record = await gateway.rename({
    item: {
      id: "content_item:resource",
      revision: 3,
      kind,
      title: "Original",
      content: structuredClone(original),
    },
    title: "Renamed",
  });
  expect(save).toHaveBeenCalledWith(
    expect.objectContaining({ content: original, revision: 3, title: "Renamed" }),
  );
  expect(record.content).toEqual(original);
});
