import { createInfiniteCanvasStore, createInfiniteCanvasWindow } from "@hyphened/infinite-canvas";
import { observable, when } from "@legendapp/state";
import { afterEach, expect, test, vi } from "vite-plus/test";

import type { WindowKind } from "../canvas/window-registry";
import { content } from "../database/operations";
import { archiveItem } from "./archive-item";
import { projectListings$ } from "./project-content";

afterEach(() => vi.restoreAllMocks());

function fixture() {
  const projectId = "project:archive_windows";
  const item = {
    id: "content_item:archive_windows",
    kind: "note",
    content: { text: "Keep" },
    revision: 1,
    title: "Note",
  };
  projectListings$[projectId].set({ projectId, items: [item] });
  const store = createInfiniteCanvasStore<WindowKind>({
    initialState: {
      windows: ["first", "second", "other"].map((id) =>
        createInfiniteCanvasWindow<WindowKind>({
          id,
          kind: "note",
          title: id,
          data: { itemId: id === "other" ? "content_item:other" : item.id },
          rect: { x: 0, y: 0, width: 320, height: 240 },
        }),
      ),
    },
  });
  return {
    store,
    item,
    input: { dispatch: store.dispatch, state: store.getState(), itemId: item.id, projectId },
  };
}

test("archive closes every matching window after storage confirms it", async () => {
  const { store, item, input } = fixture();
  const started$ = observable(false);
  const released$ = observable(false);
  vi.spyOn(content, "archive").mockImplementation(async () => {
    started$.set(true);
    await when(released$);
    return { ...item, project: input.projectId };
  });
  const archived = archiveItem(input);
  try {
    await when(started$);
    expect(store.getState().windows.map((window) => window.id)).toEqual([
      "first",
      "second",
      "other",
    ]);
  } finally {
    released$.set(true);
    await archived;
  }
  expect(store.getState().windows.map((window) => window.id)).toEqual(["other"]);
});

test("a rejected archive preserves the open windows", async () => {
  const { store, input } = fixture();
  const error = new Error("Archive unavailable");
  vi.spyOn(content, "archive").mockRejectedValue(error);
  await expect(archiveItem(input)).rejects.toBe(error);
  expect(store.getState().windows).toEqual(input.state.windows);
});

test("a no-op archive preserves the open windows", async () => {
  const { store, input } = fixture();
  vi.spyOn(content, "archive").mockResolvedValue(null);
  await archiveItem(input);
  expect(store.getState().windows).toEqual(input.state.windows);
});
