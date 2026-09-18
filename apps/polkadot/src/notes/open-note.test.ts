import { createInfiniteCanvasState } from "@hyphened/infinite-canvas";
import { observable, when } from "@legendapp/state";
import { afterEach, expect, test, vi } from "vite-plus/test";

import type { WindowKind } from "../canvas/window-registry";
import type { ContentItemRecord } from "../database/database.client";
import { content } from "../database/operations";
import { noteGateway } from "./note-gateway";
import { openNewNote } from "./open-note";

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

test("slow note creation reserves its title until the write finishes", async () => {
  vi.useFakeTimers();
  const released$ = observable(false);
  const records: ContentItemRecord[] = [];
  const input = {
    dispatch: vi.fn(),
    projectId: "project:slow_creation",
    state: createInfiniteCanvasState<WindowKind>({
      windows: [],
      viewport: { width: 1200, height: 800 },
    }),
  };
  vi.spyOn(content, "list").mockImplementation(async () => structuredClone(records));
  vi.spyOn(content, "titles").mockImplementation(async () => [
    "Untitled 4",
    ...records.map((record) => record.title),
  ]);
  const create = vi.spyOn(noteGateway, "create").mockImplementation(async ({ title, text }) => {
    await when(released$);
    const record = {
      id: `content_item:note_${records.length}`,
      kind: "note",
      content: { text },
      revision: 1,
      title,
    };
    records.push(record);
    return record;
  });
  const first = openNewNote(input);
  const second = openNewNote(input);
  try {
    await vi.advanceTimersByTimeAsync(15_000);
    expect(create).toHaveBeenCalledExactlyOnceWith({
      projectId: input.projectId,
      text: "",
      title: "Untitled 5",
    });
    expect(records).toEqual([]);
  } finally {
    released$.set(true);
    await Promise.all([first, second]);
  }
  expect(records.map(({ title }) => title)).toEqual(["Untitled 5", "Untitled 6"]);
});

test("a failed note creation rejects its caller and permits the next creation", async () => {
  const error = new Error("Write failed");
  const input = {
    dispatch: vi.fn(),
    projectId: "project:failed_creation",
    state: createInfiniteCanvasState<WindowKind>({
      windows: [],
      viewport: { width: 1200, height: 800 },
    }),
  };
  vi.spyOn(content, "list").mockResolvedValue([]);
  vi.spyOn(content, "titles").mockResolvedValue([]);
  const create = vi
    .spyOn(noteGateway, "create")
    .mockRejectedValueOnce(error)
    .mockResolvedValueOnce({
      id: "content_item:recovered",
      content: { text: "" },
      revision: 1,
      title: "Untitled 1",
    });
  const failed = openNewNote(input);
  const next = openNewNote(input);
  await expect(failed).rejects.toBe(error);
  await next;
  expect(create.mock.calls).toEqual([
    [{ projectId: input.projectId, text: "", title: "Untitled 1" }],
    [{ projectId: input.projectId, text: "", title: "Untitled 1" }],
  ]);
  expect(input.dispatch.mock.calls).toEqual([
    [
      expect.objectContaining({
        type: "window.open",
        window: expect.objectContaining({
          data: { itemId: "content_item:recovered" },
          title: "Untitled 1",
        }),
      }),
    ],
    [expect.objectContaining({ type: "window.reveal" })],
  ]);
});
