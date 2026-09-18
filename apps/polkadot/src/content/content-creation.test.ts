import { createInfiniteCanvasStore, createInfiniteCanvasWindow } from "@hyphened/infinite-canvas";
import { observable, when } from "@legendapp/state";
import { afterEach, expect, test, vi } from "vite-plus/test";
import { getAppAction } from "../app-actions";

import { openItemWindow } from "../canvas/open-item";
import type { WindowPlacement } from "../canvas/open-window";
import { getContentWindowItemId, type WindowKind } from "../canvas/window-registry";
import { collectionGateway } from "../collections/collection-gateway";
import { openNewCollection } from "../collections/open-collection";
import { content } from "../database/operations";
import { imageGateway } from "../images/image-gateway";
import { openNewImage } from "../images/open-image";
import { linkGateway } from "../links/link-gateway";
import { openNewLink } from "../links/open-link";
import { noteGateway } from "../notes/note-gateway";
import { openNewNote } from "../notes/open-note";
import { projectContent$, projectListings$ } from "./project-content";

type CreationInput = WindowPlacement & Readonly<{ projectId: string }>;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test.each([
  { kind: "note" as const, run: (input: CreationInput) => openNewNote(input) },
  {
    kind: "collection" as const,
    run: (input: CreationInput) =>
      openNewCollection({ ...input, question: { listsKind: "note" }, title: "Notes" }),
  },
  {
    kind: "link" as const,
    run: (input: CreationInput) => openNewLink({ ...input, url: "https://example.com/" }),
  },
  {
    kind: "image" as const,
    run: (input: CreationInput) =>
      openNewImage({ ...input, file: new File(["image"], "image.png") }),
  },
])("$kind creation publishes the returned record and opens its window", async ({ kind, run }) => {
  const records = {
    note: {
      id: "content_item:created_note",
      title: "Created note",
      revision: 1,
      content: { text: "Note" },
    },
    collection: {
      id: "content_item:created_collection",
      title: "Created collection",
      revision: 1,
      content: { listsKind: "note" },
    },
    link: {
      id: "content_item:created_link",
      title: "Created link",
      revision: 1,
      content: { url: "https://example.com/", host: "example.com" },
    },
    image: {
      id: "content_item:created_image",
      title: "Created image",
      revision: 1,
      content: { source: "data:image/png;base64,AA==", description: "Image" },
    },
  };
  const writes = {
    note: vi.spyOn(noteGateway, "create").mockResolvedValue(records.note),
    collection: vi.spyOn(collectionGateway, "create").mockResolvedValue(records.collection),
    link: vi.spyOn(linkGateway, "create").mockResolvedValue(records.link),
    image: vi.spyOn(imageGateway, "create").mockResolvedValue(records.image),
  };
  vi.spyOn(content, "list").mockImplementation(async () => {
    if (writes[kind].mock.calls.length > 0) throw new Error("Post-write reads are unavailable");
    return [];
  });
  vi.spyOn(content, "titles").mockResolvedValue([]);
  vi.stubGlobal(
    "Image",
    class {
      src = "";
      naturalWidth = 640;
      naturalHeight = 480;
      async decode() {}
    },
  );
  vi.stubGlobal(
    "FileReader",
    class extends EventTarget {
      result = records.image.content.source;
      readAsDataURL() {
        this.dispatchEvent(new Event("load"));
      }
    },
  );
  const projectId = `project:create_${kind}`;
  projectListings$[projectId].set({ projectId, items: [] });
  const store = createInfiniteCanvasStore<WindowKind>({ initialState: { windows: [] } });
  await run({ dispatch: store.dispatch, state: store.getState(), projectId });
  expect(projectContent$[projectId].peek()?.items).toEqual([{ ...records[kind], kind }]);
  expect(store.getState().windows.map(getContentWindowItemId)).toEqual([records[kind].id]);
  expect(store.getState().windows[0]?.title).toBe(records[kind].title);
  expect(writes[kind]).toHaveBeenCalledOnce();
});

test("opening an existing note does not create or reload content", async () => {
  const read = vi.spyOn(content, "list").mockRejectedValue(new Error("Unexpected content reload"));
  const create = vi
    .spyOn(noteGateway, "create")
    .mockRejectedValue(new Error("Unexpected note creation"));
  const store = createInfiniteCanvasStore<WindowKind>({ initialState: { windows: [] } });
  const item = {
    id: "content_item:existing",
    kind: "note",
    content: { text: "Existing" },
    revision: 1,
    title: "Existing",
  };
  await openItemWindow({ dispatch: store.dispatch, state: store.getState(), item });
  expect(store.getState().windows.map(getContentWindowItemId)).toEqual([item.id]);
  expect(read).not.toHaveBeenCalled();
  expect(create).not.toHaveBeenCalled();
});

test.each(["note", "image", "link", "collection"] as const)(
  "an open %s is revealed without loading its content",
  async (kind) => {
    const read = vi
      .spyOn(imageGateway, "read")
      .mockRejectedValue(new Error("Image reads are unavailable"));
    vi.stubGlobal(
      "Image",
      class {
        constructor() {
          throw new Error("An open image must not be decoded again");
        }
      },
    );
    const item = {
      id: `content_item:reveal_${kind}`,
      kind,
      content: {},
      revision: 1,
      title: "Existing",
    };
    const window = createInfiniteCanvasWindow<WindowKind>({
      id: "existing_window",
      kind,
      data: { itemId: item.id },
      title: item.title,
      mode: "minimized",
      rect: { x: 50, y: 50, width: 320, height: 240 },
    });
    const store = createInfiniteCanvasStore<WindowKind>({ initialState: { windows: [window] } });
    await openItemWindow({ dispatch: store.dispatch, state: store.getState(), item });
    expect(
      store.getState().windows.map((window) => ({ id: window.id, mode: window.mode })),
    ).toEqual([{ id: window.id, mode: "normal" }]);
    expect(store.getState().activeWindowId).toBe(window.id);
    expect(read).not.toHaveBeenCalled();
  },
);

test("content.open waits for image sizing and preserves opening failures", async () => {
  const released$ = observable(false);
  const started$ = observable(false);
  vi.stubGlobal(
    "Image",
    class {
      src = "";
      naturalWidth = 640;
      naturalHeight = 480;
      async decode() {
        started$.set(true);
        await when(released$);
      }
    },
  );
  const projectId = "project:open_image";
  const item = {
    id: "content_item:open_image",
    kind: "image",
    title: "Existing image",
    revision: 1,
    content: { source: "data:image/png;base64,AA==", description: "Image" },
  };
  projectListings$[projectId].set({ projectId, items: [item] });
  const read = vi.spyOn(imageGateway, "read").mockResolvedValue(item);
  const store = createInfiniteCanvasStore<WindowKind>({ initialState: { windows: [] } });
  const settled = vi.fn();
  const completion = Promise.resolve(
    getAppAction("content.open")?.run(
      {
        dispatch: store.dispatch,
        state: store.getState(),
        projectId,
        canvasId: "canvas_document:open_image",
        canvasTitle: "Main",
        goToCanvas: () => undefined,
        refreshRoute: () => undefined,
      },
      { itemId: item.id },
    ),
  ).then(settled);
  try {
    await when(started$);
    expect(settled).not.toHaveBeenCalled();
    expect(store.getState().windows).toEqual([]);
  } finally {
    released$.set(true);
    await completion;
  }
  expect(store.getState().windows.map(getContentWindowItemId)).toEqual([item.id]);
  expect(settled).toHaveBeenCalledExactlyOnceWith(undefined);
  const error = new Error("Image read failed");
  read.mockRejectedValueOnce(error);
  await expect(
    openItemWindow({
      dispatch: store.dispatch,
      state: store.getState(),
      item: { ...item, id: "content_item:failed_open" },
    }),
  ).rejects.toBe(error);
  expect(store.getState().windows.map(getContentWindowItemId)).toEqual([item.id]);
});
