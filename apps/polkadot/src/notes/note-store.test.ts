import { observable, observe, syncState, when } from "@legendapp/state";
import { afterEach, beforeEach, expect, onTestFinished, test, vi } from "vite-plus/test";

import {
  editNote,
  ensureNoteLoaded,
  externalWrites$,
  notes$,
  renameNote,
  writeNote,
  type NoteGateway,
} from "./note-store";
import type { NoteRecord } from "./note-gateway";

const gateway = {
  read: vi.fn<NoteGateway["read"]>(async () => null),
  save: vi.fn(async (note: NoteRecord) => ({ ...note, revision: note.revision + 1 })),
} satisfies NoteGateway;

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const seed = async (id: string, text: string, title: string) => {
  ensureNoteLoaded(id, gateway, { content: { text }, id, revision: 3, title });
  await when(syncState(notes$[id]).isLoaded);
};

const stub = (id: string, title: string) => ({
  content: { text: "" },
  id,
  revision: 3,
  title,
});

test("renaming a loaded note keeps its body", async () => {
  await seed("content_item:kept", "the body that must survive", "Before");
  renameNote(stub("content_item:kept", "Before"), "After", gateway);

  expect(notes$["content_item:kept"].peek()?.content.text).toBe("the body that must survive");
  expect(notes$["content_item:kept"].peek()?.title).toBe("After");
  await vi.advanceTimersByTimeAsync(400);
  expect(gateway.save).toHaveBeenCalledExactlyOnceWith({
    id: "content_item:kept",
    content: { text: "the body that must survive" },
    revision: 3,
    title: "After",
  });
  expect(notes$["content_item:kept"].peek()?.revision).toBe(4);
});

test("renaming preserves loaded text when the supplied record differs", async () => {
  await seed("content_item:disagree", "stored", "Name");
  renameNote(
    {
      content: { text: "caller's idea of the text" },
      id: "content_item:disagree",
      revision: 3,
      title: "Name",
    },
    "Renamed",
    gateway,
  );

  expect(notes$["content_item:disagree"].peek()?.content.text).toBe("stored");
  await vi.advanceTimersByTimeAsync(400);
  expect(gateway.save).toHaveBeenCalledExactlyOnceWith({
    id: "content_item:disagree",
    content: { text: "stored" },
    revision: 3,
    title: "Renamed",
  });
});

test("renaming an unloaded note preserves the supplied record", async () => {
  renameNote(stub("content_item:cold", "Cold"), "Renamed", gateway);

  expect(notes$["content_item:cold"].peek()?.content.text).toBe("");
  expect(notes$["content_item:cold"].peek()?.title).toBe("Renamed");
  await when(syncState(notes$["content_item:cold"]).isLoaded);
  await vi.advanceTimersByTimeAsync(400);
  expect(gateway.save).toHaveBeenCalledExactlyOnceWith({
    id: "content_item:cold",
    content: { text: "" },
    revision: 3,
    title: "Renamed",
  });
  expect(gateway.read).not.toHaveBeenCalled();
});

test("queued saves use the last stored revision and preserve newer text", async () => {
  const released$ = observable(false);
  gateway.save.mockImplementationOnce(async (note) => {
    await when(released$);
    return { ...note, revision: 4 };
  });
  await seed("content_item:ordered", "original", "Note");
  editNote("content_item:ordered", { text: "first edit", title: "Note" }, gateway);
  await vi.advanceTimersByTimeAsync(400);
  editNote("content_item:ordered", { text: "second edit", title: "Note" }, gateway);
  await vi.advanceTimersByTimeAsync(400);
  expect(gateway.save).toHaveBeenCalledTimes(1);

  released$.set(true);
  await vi.advanceTimersByTimeAsync(0);
  expect(gateway.save.mock.calls).toEqual([
    [{ id: "content_item:ordered", content: { text: "first edit" }, revision: 3, title: "Note" }],
    [{ id: "content_item:ordered", content: { text: "second edit" }, revision: 4, title: "Note" }],
  ]);
  expect(notes$["content_item:ordered"].peek()).toEqual({
    id: "content_item:ordered",
    content: { text: "second edit" },
    revision: 5,
    title: "Note",
  });
});

test("a failed save retains edits and exposes the error", async () => {
  const error = new Error("Storage unavailable");
  const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  gateway.save.mockRejectedValueOnce(error);
  await seed("content_item:retry", "original", "Note");
  editNote("content_item:retry", { text: "unsaved edit", title: "Note" }, gateway);
  await vi.advanceTimersByTimeAsync(400);
  expect(notes$["content_item:retry"].peek()?.content.text).toBe("unsaved edit");
  expect(syncState(notes$["content_item:retry"]).error.peek()).toBe(error);
  expect(warning).toHaveBeenCalledWith("Note synchronization failed", {
    noteId: "content_item:retry",
    error,
  });

  editNote("content_item:retry", { text: "recovered edit", title: "Note" }, gateway);
  await vi.advanceTimersByTimeAsync(400);
  expect(gateway.save).toHaveBeenLastCalledWith({
    id: "content_item:retry",
    content: { text: "recovered edit" },
    revision: 3,
    title: "Note",
  });
  expect(syncState(notes$["content_item:retry"]).error.peek()).toBeUndefined();
  expect(notes$["content_item:retry"].peek()?.revision).toBe(4);
});

test("refresh waits for an active save before reading its revision", async () => {
  const released$ = observable(false);
  gateway.save.mockImplementationOnce(async (note) => {
    await when(released$);
    return { ...note, revision: 4 };
  });
  await seed("content_item:refresh", "original", "Note");
  onTestFinished(
    observe(() => {
      notes$["content_item:refresh"].get();
    }),
  );
  editNote("content_item:refresh", { text: "first edit", title: "Note" }, gateway);
  await vi.advanceTimersByTimeAsync(400);
  gateway.read.mockResolvedValueOnce({
    id: "content_item:refresh",
    content: { text: "first edit" },
    revision: 4,
    title: "Note",
  });
  await syncState(notes$["content_item:refresh"]).sync();
  await vi.advanceTimersByTimeAsync(0);
  expect(gateway.read).not.toHaveBeenCalled();

  released$.set(true);
  await when(() => !syncState(notes$["content_item:refresh"]).isGetting.get());
  expect(gateway.read).toHaveBeenCalledExactlyOnceWith("content_item:refresh");
  editNote("content_item:refresh", { text: "second edit", title: "Note" }, gateway);
  await vi.advanceTimersByTimeAsync(400);
  expect(gateway.save).toHaveBeenLastCalledWith({
    id: "content_item:refresh",
    content: { text: "second edit" },
    revision: 4,
    title: "Note",
  });
});

test("failed reads share one retry across callers", async () => {
  const noteId = "content_item:read_retry";
  const error = new Error("Read unavailable");
  const released$ = observable(false);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  gateway.read.mockRejectedValueOnce(error).mockImplementationOnce(async () => {
    await when(released$);
    return { id: noteId, content: { text: "Recovered" }, revision: 3, title: "Note" };
  });
  onTestFinished(
    observe(() => {
      notes$[noteId].get();
    }),
  );
  ensureNoteLoaded(noteId, gateway);
  const status$ = syncState(notes$[noteId]);
  await vi.advanceTimersByTimeAsync(0);
  expect(status$.peek()).toMatchObject({
    error,
    isLoaded: false,
    isGetting: false,
    numPendingGets: 0,
  });

  ensureNoteLoaded(noteId, gateway);
  ensureNoteLoaded(noteId, gateway);
  await vi.advanceTimersByTimeAsync(0);
  expect(gateway.read).toHaveBeenCalledTimes(2);
  expect(status$.peek()).toMatchObject({ isGetting: true, numPendingGets: 1 });
  released$.set(true);
  await when(status$.isLoaded);
  expect(status$.peek()).toMatchObject({ isGetting: false, numPendingGets: 0 });
  expect(notes$[noteId].peek()).toEqual({
    id: noteId,
    content: { text: "Recovered" },
    revision: 3,
    title: "Note",
  });
});

test("repeated external text does not reset the editor", async () => {
  const noteId = "content_item:idempotent_write";
  await seed(noteId, "Original", "Note");
  const held = stub(noteId, "Old title");
  writeNote(held, "Original", gateway);
  expect(externalWrites$[noteId].peek() ?? 0).toBe(0);
  writeNote(held, "Updated", gateway);
  expect(externalWrites$[noteId].peek()).toBe(1);
  writeNote(held, "Updated", gateway);
  expect(externalWrites$[noteId].peek()).toBe(1);
  expect(notes$[noteId].peek()?.title).toBe("Note");
  await vi.advanceTimersByTimeAsync(400);
  expect(gateway.save).toHaveBeenCalledExactlyOnceWith({
    id: noteId,
    content: { text: "Updated" },
    revision: 3,
    title: "Note",
  });
});
