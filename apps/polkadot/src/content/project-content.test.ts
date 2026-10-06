import { observable, observe, syncState, when } from "@legendapp/state";
import { afterEach, expect, onTestFinished, test, vi } from "vite-plus/test";

import { content } from "../database/operations";
import { editNote, ensureNoteLoaded, notes$, type NoteGateway } from "../notes/note-store";
import {
  archiveProjectItem,
  archivedProjectContent$,
  archivedProjectListings$,
  createProjectItem,
  getProjectContent,
  getProjectContentOfKind,
  loadArchivedProjectContent,
  loadProjectContent,
  projectContent$,
  projectListings$,
  restoreProjectItem,
  updateProjectItem,
} from "./project-content";
import { undoableAction$, undoLastAction } from "./undoable-action";

afterEach(() => vi.restoreAllMocks());

const item = (id: string, kind: string) => ({
  content: {},
  id,
  kind,
  revision: 1,
  title: id,
  updated_at: "2026-08-26T00:00:00Z",
});

const listing = {
  items: [item("a", "note"), item("b", "image"), item("c", "link"), item("d", "note")],
  projectId: "project:one",
};

test("a listing is returned for the project it belongs to", () => {
  expect(getProjectContent(listing, "project:one")).toHaveLength(4);
});

test("another project's listing reads as no answer, not as an empty one", () => {
  expect(getProjectContent(listing, "project:two")).toBeNull();
  expect(getProjectContent(null, "project:one")).toBeNull();
});

test("every kind is listed, which is what makes it a library rather than a note list", () => {
  const kinds = getProjectContent(listing, "project:one")?.map((entry) => entry.kind);

  expect(new Set(kinds)).toEqual(new Set(["note", "image", "link"]));
});

test("narrowing to a kind keeps the project guard", () => {
  expect(getProjectContentOfKind({ kind: "note", listing, projectId: "project:one" })).toHaveLength(
    2,
  );
  expect(getProjectContentOfKind({ kind: "note", listing, projectId: "project:two" })).toBeNull();
});

test("a kind nothing matches is an empty list, not a missing answer", () => {
  expect(
    getProjectContentOfKind({ kind: "collection", listing, projectId: "project:one" }),
  ).toEqual([]);
});

test("a background refresh preserves another project's listing", async () => {
  const first = item("content_item:one", "note");
  const second = item("content_item:two", "image");
  const updated = { ...first, title: "Updated note" };
  const read = vi
    .spyOn(content, "list")
    .mockResolvedValueOnce(structuredClone([first]))
    .mockResolvedValueOnce(structuredClone([second]))
    .mockResolvedValueOnce(structuredClone([updated]));

  await Promise.all([loadProjectContent("project:one"), loadProjectContent("project:two")]);
  expect(projectContent$["project:one"].peek()).toEqual({
    projectId: "project:one",
    items: [first],
  });
  expect(projectContent$["project:two"].peek()).toEqual({
    projectId: "project:two",
    items: [second],
  });
  await loadProjectContent("project:one");
  expect(projectContent$["project:one"].peek()?.items).toEqual([updated]);
  expect(projectContent$["project:two"].peek()?.items).toEqual([second]);
  expect(read.mock.calls).toEqual([
    [{ projectId: "project:one" }],
    [{ projectId: "project:two" }],
    [{ projectId: "project:one" }],
  ]);
});

test("an item update preserves other projects and record fields", () => {
  const first = { ...item("content_item:editable", "note"), content: { text: "Retain this text" } };
  const second = item("content_item:other", "image");
  projectListings$["project:editable"].set({
    projectId: "project:editable",
    items: [structuredClone(first)],
  });
  projectListings$["project:other"].set({
    projectId: "project:other",
    items: [structuredClone(second)],
  });
  updateProjectItem({ id: first.id, title: "New title", revision: 2 });
  expect(projectContent$["project:editable"].peek()?.items).toEqual([
    { ...first, title: "New title", revision: 2 },
  ]);
  expect(projectContent$["project:other"].peek()?.items).toEqual([second]);
});

test("creation publishes the returned item without a post-write read", async () => {
  const projectId = "project:create_known";
  const previous = item("content_item:previous", "image");
  const created = {
    id: "content_item:created",
    content: { text: "New note" },
    revision: 1,
    title: "New",
  };
  projectListings$[projectId].set({ projectId, items: [previous] });
  const read = vi.spyOn(content, "list").mockRejectedValue(new Error("Read unavailable"));
  const create = vi.fn(async () => created);
  await expect(createProjectItem({ projectId, kind: "note", create })).resolves.toEqual(created);
  expect(projectContent$[projectId].peek()?.items).toEqual([
    { ...created, kind: "note" },
    previous,
  ]);
  expect(read).not.toHaveBeenCalled();
  expect(create).toHaveBeenCalledOnce();
});

test("creation loads unknown membership before the write", async () => {
  const projectId = "project:create_unknown";
  const previous = item("content_item:previous_unknown", "image");
  const created = {
    id: "content_item:created_unknown",
    content: { text: "New note" },
    revision: 1,
    title: "New",
  };
  const read = vi.spyOn(content, "list").mockResolvedValueOnce([previous]);
  const create = vi.fn(async () => {
    expect(read).toHaveBeenCalledExactlyOnceWith({ projectId });
    return created;
  });
  await createProjectItem({ projectId, kind: "note", create });
  expect(projectContent$[projectId].peek()?.items).toEqual([
    { ...created, kind: "note" },
    previous,
  ]);
  expect(read).toHaveBeenCalledOnce();
});

test("a failed membership read prevents creation and a failed write preserves the listing", async () => {
  const error = new Error("Storage unavailable");
  const create = vi
    .fn<() => Promise<Omit<ReturnType<typeof item>, "kind">>>()
    .mockRejectedValue(error);
  vi.spyOn(content, "list").mockRejectedValue(error);
  await expect(
    createProjectItem({ projectId: "project:create_unreadable", kind: "note", create }),
  ).rejects.toBe(error);
  expect(create).not.toHaveBeenCalled();
  const projectId = "project:create_rejected";
  const previous = item("content_item:retained", "image");
  projectListings$[projectId].set({ projectId, items: [previous] });
  await expect(createProjectItem({ projectId, kind: "note", create })).rejects.toBe(error);
  expect(projectContent$[projectId].peek()?.items).toEqual([previous]);
});

test("a pending refresh completes before a new item is published", async () => {
  const projectId = "project:create_after_refresh";
  const previous = item("content_item:before_refresh", "image");
  const created = { id: "content_item:after_refresh", content: {}, revision: 1, title: "New" };
  const released$ = observable(false);
  vi.spyOn(content, "list").mockImplementation(async () => {
    await when(released$);
    return [previous];
  });
  const create = vi.fn(async () => created);
  const refresh = loadProjectContent(projectId);
  const creation = createProjectItem({ projectId, kind: "image", create });
  try {
    await Promise.resolve();
    expect(create).not.toHaveBeenCalled();
  } finally {
    released$.set(true);
    await Promise.all([refresh, creation]);
  }
  expect(projectContent$[projectId].peek()?.items).toEqual([
    { ...created, kind: "image" },
    previous,
  ]);
});

test("archive and undo publish their writes without a listing refresh", async () => {
  const projectId = "project:archive";
  const original = { ...item("content_item:archive", "note"), title: "Archive me" };
  const error = new Error("Listing unavailable");
  const archived = { ...original, archived_at: "2026-09-15T12:00:00Z" };
  const archive = vi
    .spyOn(content, "archive")
    .mockResolvedValue({ ...archived, project: projectId });
  const restored = { ...original, title: "Restored title", revision: 2 };
  const restore = vi
    .spyOn(content, "restore")
    .mockResolvedValue({ ...restored, project: "project:archive" });
  const read = vi.spyOn(content, "list").mockRejectedValue(error);
  projectListings$["project:archive"].set({
    projectId: "project:archive",
    items: [structuredClone(original)],
  });
  archivedProjectListings$[projectId].set({ projectId, items: [] });
  const membership: number[] = [];
  onTestFinished(
    observe(() => {
      membership.push(
        (projectContent$[projectId].get()?.items.length ?? 0) +
          (archivedProjectContent$[projectId].get()?.items.length ?? 0),
      );
    }),
  );
  undoableAction$.set(null);

  await archiveProjectItem({ projectId: "project:archive", itemId: original.id });
  expect(projectContent$["project:archive"].peek()?.items).toEqual([]);
  expect(archivedProjectContent$[projectId].peek()?.items).toEqual([archived]);
  expect(archive).toHaveBeenCalledExactlyOnceWith(original.id);
  expect(undoableAction$.peek()?.describe).toBe("Undo archiving “Archive me”");
  await undoLastAction();
  expect(restore).toHaveBeenCalledExactlyOnceWith(original.id);
  expect(projectContent$["project:archive"].peek()?.items).toEqual([restored]);
  expect(archivedProjectContent$[projectId].peek()?.items).toEqual([]);
  expect(membership.every((count) => count === 1)).toBe(true);
  expect(read).not.toHaveBeenCalled();
});

test("failed archive and restore writes preserve project membership", async () => {
  const projectId = "project:archive_failure";
  const original = item("content_item:archive_failure", "image");
  const error = new Error("Write unavailable");
  projectListings$[projectId].set({ projectId, items: [original] });
  undoableAction$.set(null);
  vi.spyOn(content, "archive").mockRejectedValue(error);
  vi.spyOn(content, "restore").mockRejectedValue(error);
  await expect(archiveProjectItem({ projectId, itemId: original.id })).rejects.toBe(error);
  expect(projectContent$[projectId].peek()?.items).toEqual([original]);
  expect(undoableAction$.peek()).toBeNull();
  await expect(restoreProjectItem({ projectId, itemId: "content_item:unrestored" })).rejects.toBe(
    error,
  );
  expect(projectContent$[projectId].peek()?.items).toEqual([original]);
});

test("restore loads unknown membership and never duplicates an existing item", async () => {
  const projectId = "project:restore_unknown";
  const previous = item("content_item:already_present", "image");
  const restored = item("content_item:restored", "note");
  const read = vi.spyOn(content, "list").mockResolvedValue([previous]);
  vi.spyOn(content, "restore").mockResolvedValue({ ...restored, project: projectId });
  await restoreProjectItem({ projectId, itemId: restored.id });
  await restoreProjectItem({ projectId, itemId: restored.id });
  expect(projectContent$[projectId].peek()?.items).toEqual([restored, previous]);
  expect(read).toHaveBeenCalledExactlyOnceWith({ projectId });
});

test("an earlier refresh cannot restore an archived row", async () => {
  const projectId = "project:archive_after_refresh";
  const original = item("content_item:archive_after_refresh", "image");
  const released$ = observable(false);
  vi.spyOn(content, "list").mockImplementation(async () => {
    await when(released$);
    return [original];
  });
  const archive = vi
    .spyOn(content, "archive")
    .mockResolvedValue({ ...original, project: projectId });
  const refresh = loadProjectContent(projectId);
  const archived = archiveProjectItem({ projectId, itemId: original.id });
  try {
    await Promise.resolve();
    expect(archive).not.toHaveBeenCalled();
  } finally {
    released$.set(true);
    await Promise.all([refresh, archived]);
  }
  expect(projectContent$[projectId].peek()?.items).toEqual([]);
});

test("an earlier archive-list read cannot reinsert a restored row", async () => {
  const projectId = "project:restore_after_archive_read";
  const restored = item("content_item:restore_after_archive_read", "image");
  const released$ = observable(false);
  projectListings$[projectId].set({ projectId, items: [] });
  vi.spyOn(content, "listArchived").mockImplementation(async () => {
    await when(released$);
    return [{ ...restored, archived_at: "2026-09-15T12:00:00Z" }];
  });
  const restore = vi
    .spyOn(content, "restore")
    .mockResolvedValue({ ...restored, project: projectId });
  const refresh = loadArchivedProjectContent(projectId);
  const restoration = restoreProjectItem({ projectId, itemId: restored.id });
  try {
    await Promise.resolve();
    expect(restore).not.toHaveBeenCalled();
  } finally {
    released$.set(true);
    await Promise.all([refresh, restoration]);
  }
  expect(projectContent$[projectId].peek()?.items).toEqual([restored]);
  expect(archivedProjectContent$[projectId].peek()?.items).toEqual([]);
});

test("archive listings retain their project identity", async () => {
  const first = item("content_item:archived_first", "image");
  const second = item("content_item:archived_second", "note");
  vi.spyOn(content, "listArchived").mockResolvedValueOnce([first]).mockResolvedValueOnce([second]);
  await Promise.all([
    loadArchivedProjectContent("project:archived_first"),
    loadArchivedProjectContent("project:archived_second"),
  ]);
  expect(archivedProjectContent$["project:archived_first"].peek()?.items).toEqual([first]);
  expect(archivedProjectContent$["project:archived_second"].peek()?.items).toEqual([second]);
});

test("a missing archive target does not create an undo action", async () => {
  undoableAction$.set(null);
  vi.spyOn(content, "archive").mockResolvedValue(null);
  await archiveProjectItem({
    projectId: "project:archive_missing",
    itemId: "content_item:missing",
  });
  expect(undoableAction$.peek()).toBeNull();
});

test("an item update that arrives after archive reaches the archived listing", async () => {
  const projectId = "project:late_rename";
  const original = item("content_item:late_rename", "image");
  projectListings$[projectId].set({ projectId, items: [original] });
  archivedProjectListings$[projectId].set({ projectId, items: [] });
  vi.spyOn(content, "archive").mockResolvedValue({ ...original, project: projectId });
  await archiveProjectItem({ projectId, itemId: original.id });
  updateProjectItem({ id: original.id, title: "Updated title", revision: 2 });
  expect(projectContent$[projectId].peek()?.items).toEqual([]);
  expect(archivedProjectContent$[projectId].peek()?.items).toEqual([
    { ...original, title: "Updated title", revision: 2 },
  ]);
});

test("a missing restore target leaves the listing unchanged", async () => {
  const projectId = "project:restore_missing";
  const previous = item("content_item:restore_neighbor", "image");
  projectListings$[projectId].set({ projectId, items: [previous] });
  vi.spyOn(content, "restore").mockResolvedValue(null);
  await restoreProjectItem({ projectId, itemId: "content_item:missing" });
  expect(projectContent$[projectId].peek()?.items).toEqual([previous]);
});

test("restoration updates the item's own project", async () => {
  const local = item("content_item:local_restore", "image");
  const restored = item("content_item:foreign_restore", "note");
  projectListings$["project:restore_local"].set({
    projectId: "project:restore_local",
    items: [local],
  });
  projectListings$["project:restore_foreign"].set({
    projectId: "project:restore_foreign",
    items: [],
  });
  vi.spyOn(content, "restore").mockResolvedValue({
    ...restored,
    project: "project:restore_foreign",
  });
  await restoreProjectItem({ projectId: "project:restore_local", itemId: restored.id });
  expect(projectContent$["project:restore_local"].peek()?.items).toEqual([local]);
  expect(projectContent$["project:restore_foreign"].peek()?.items).toEqual([restored]);
});

test("listing refreshes retain live note edits and follow project membership", async () => {
  vi.useFakeTimers();
  onTestFinished(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });
  const projectId = "project:live_note";
  const original = { ...item("content_item:live_note", "note"), content: { text: "Original" } };
  const released$ = observable(false);
  const error = new Error("Save unavailable");
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  const gateway = {
    read: vi.fn<NoteGateway["read"]>(async () => original),
    save: vi.fn<NoteGateway["save"]>().mockRejectedValueOnce(error),
  } satisfies NoteGateway;
  vi.spyOn(content, "list")
    .mockResolvedValueOnce(structuredClone([original]))
    .mockImplementationOnce(async () => {
      await when(released$);
      return structuredClone([original]);
    })
    .mockResolvedValueOnce([]);
  await loadProjectContent(projectId);
  const changed = vi.fn();
  onTestFinished(projectContent$[projectId].onChange(({ value }) => changed(value)));
  ensureNoteLoaded(original.id, gateway, original);
  await when(syncState(notes$[original.id]).isLoaded);
  const refresh = loadProjectContent(projectId);
  editNote(original.id, { text: "Unsaved text", title: "New title" }, gateway);
  const expected = { ...original, content: { text: "Unsaved text" }, title: "New title" };
  expect(projectContent$[projectId].peek()?.items).toEqual([expected]);
  expect(changed).toHaveBeenLastCalledWith({ projectId, items: [expected] });
  released$.set(true);
  await refresh;
  expect(projectContent$[projectId].peek()?.items).toEqual([expected]);
  expect(projectListings$[projectId].peek()?.items).toEqual([original]);
  await vi.advanceTimersByTimeAsync(400);
  expect(syncState(notes$[original.id]).error.peek()).toBe(error);
  expect(projectContent$[projectId].peek()?.items).toEqual([expected]);
  const recovered = { ...expected, content: { text: "Saved text" }, revision: 2 };
  gateway.save.mockResolvedValueOnce(recovered);
  editNote(original.id, { text: "Saved text", title: "New title" }, gateway);
  await vi.advanceTimersByTimeAsync(400);
  expect(projectContent$[projectId].peek()?.items).toEqual([recovered]);
  expect(changed).toHaveBeenLastCalledWith({ projectId, items: [recovered] });
  await loadProjectContent(projectId);
  expect(projectContent$[projectId].peek()?.items).toEqual([]);
  expect(notes$[original.id].peek()?.content.text).toBe("Saved text");
});
