import { afterEach, expect, test, vi } from "vite-plus/test";

import { content } from "../database/operations";
import { imageGateway } from "../images/image-gateway";
import { linkGateway } from "../links/link-gateway";
import { noteGateway } from "../notes/note-gateway";

afterEach(() => vi.restoreAllMocks());

test.each([
  {
    kind: "image",
    gateway: imageGateway,
    payload: { source: "data:image/png;base64,AA==", description: "Image" },
  },
  {
    kind: "link",
    gateway: linkGateway,
    payload: { host: "example.com", url: "https://example.com/" },
  },
  { kind: "note", gateway: noteGateway, payload: { text: "Note" } },
])("$kind reads require the matching record kind", async ({ kind, gateway, payload }) => {
  const record = { id: "content_item:read", kind, content: payload, revision: 1, title: "Title" };
  const read = vi.spyOn(content, "read");
  read.mockResolvedValueOnce({ ...record, kind: "other" });
  await expect(gateway.read(record.id)).resolves.toBeNull();
  read.mockResolvedValueOnce(null);
  await expect(gateway.read(record.id)).resolves.toBeNull();
  read.mockResolvedValueOnce(record);
  await expect(gateway.read(record.id)).resolves.toEqual({
    id: record.id,
    content: payload,
    revision: 1,
    title: "Title",
  });
  read.mockResolvedValueOnce({ ...record, content: {} });
  await expect(gateway.read(record.id)).rejects.toThrow();
});
