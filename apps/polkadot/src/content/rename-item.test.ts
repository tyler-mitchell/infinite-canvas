import {
  createInfiniteCanvasState,
  createInfiniteCanvasStore,
  createInfiniteCanvasWindow,
  type InfiniteCanvasDispatch,
} from "@hyphened/infinite-canvas";
import { afterEach, expect, onTestFinished, test, vi } from "vite-plus/test";

import type { WindowKind } from "../canvas/window-registry";
import type { ContentItemRecord } from "../database/database.client";
import { getAppAction } from "../app-actions";
import { LISTABLE_KINDS } from "../collections/listable-kinds";
import { RENAMEABLE_KINDS, renameProjectItem } from "./rename-item";
import { imageGateway } from "../images/image-gateway";
import { projectContent$, projectListings$ } from "./project-content";

afterEach(() => vi.restoreAllMocks());

test("the verb names every kind it can actually rename", () => {
  const description = getAppAction("content.rename")?.description ?? "";

  for (const kind of RENAMEABLE_KINDS) {
    expect(description).toContain(kind);
  }

  // This assertion fails if the map has only one kind.
  expect(RENAMEABLE_KINDS.length).toBeGreaterThan(1);
  expect(description.toLowerCase()).not.toContain("only notes");
});

const state = createInfiniteCanvasState<WindowKind>({
  viewport: { height: 800, width: 1200 },
  windows: [],
});

const dispatch: InfiniteCanvasDispatch<WindowKind> = () => undefined;

const item = (kind: string, title: string): ContentItemRecord =>
  ({
    content: { text: "" },
    id: "item-1",
    kind,
    revision: 1,
    title,
  }) as unknown as ContentItemRecord;

const rename = (record: ContentItemRecord, title: string) =>
  renameProjectItem({ dispatch, item: record, state, title });

test("every kind the library lists has something that can save its title", () => {
  const unrenameable = LISTABLE_KINDS.filter((kind) => !RENAMEABLE_KINDS.includes(kind.kind));

  // This assertion fails if the list is empty.
  expect(LISTABLE_KINDS.length).toBeGreaterThan(3);
  expect(
    unrenameable.map((kind) => kind.kind),
    "listed in the library but nothing can save a new title for them",
  ).toStrictEqual([]);
});

test("the writers are exactly the listed kinds, so neither list quietly grows past the other", () => {
  expect([...RENAMEABLE_KINDS].sort()).toStrictEqual(
    LISTABLE_KINDS.map((kind) => kind.kind).sort(),
  );
});

test("a blank name is refused, and whitespace is blank", async () => {
  expect(await rename(item("note", "Untitled 1"), "")).toBe("Refused: a name cannot be blank.");
  expect(await rename(item("note", "Untitled 1"), "   ")).toBe("Refused: a name cannot be blank.");
});

test("renaming something to what it is already called is not a rename", async () => {
  expect(await rename(item("note", "Quarterly"), "Quarterly")).toBe(
    "Refused: that is already its name.",
  );
  expect(await rename(item("note", "Quarterly"), "  Quarterly  ")).toBe(
    "Refused: that is already its name.",
  );
});

test("a kind with no writer is refused rather than half-renamed", async () => {
  expect(await rename(item("diagram", "Untitled 1"), "Better name")).toContain("has no writer yet");
});

test("the refusal names the kind it could not save", async () => {
  expect(await rename(item("diagram", "sketch"), "Cover")).toContain('a "diagram"');
  expect(await rename(item("recording", "take 1"), "Interview")).toContain('a "recording"');
});

test("blank is checked before kind, so the worse answer is not given for the smaller mistake", async () => {
  expect(await rename(item("diagram", "sketch"), "  ")).toBe("Refused: a name cannot be blank.");
});

test("invalid stored content produces a rename refusal", async () => {
  expect(await rename(item("collection", "Original"), "Updated")).toContain(
    "Refused: the rename did not save.",
  );
});

test("renaming updates every window for the item as one canvas change", async () => {
  const record = {
    id: "content_item:shared_image",
    kind: "image",
    revision: 1,
    title: "Original",
    content: {
      description: "Diagram",
      source: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg"/>')}`,
    },
  };
  vi.spyOn(imageGateway, "rename").mockResolvedValue({ ...record, title: "Updated", revision: 2 });
  projectListings$["project:rename"].set({
    projectId: "project:rename",
    items: [structuredClone(record)],
  });
  expect(projectContent$["project:rename"].get()?.items).toEqual([record]);
  const changes: { title: string; revision: number }[] = [];
  onTestFinished(
    projectContent$["project:rename"].onChange(({ value }) => {
      const item = value?.items.find((item) => item.id === record.id);
      if (item !== undefined) changes.push({ title: item.title, revision: item.revision });
    }),
  );
  const store = createInfiniteCanvasStore<WindowKind>({
    initialState: {
      windows: ["first", "second", "other"].map((id) =>
        createInfiniteCanvasWindow<WindowKind>({
          id,
          kind: "image",
          title: id === "other" ? "Other" : "Original",
          data: { itemId: id === "other" ? "content_item:other" : record.id },
          rect: { x: 0, y: 0, width: 320, height: 240 },
        }),
      ),
    },
  });
  await renameProjectItem({
    dispatch: store.dispatch,
    item: record,
    state: store.getState(),
    title: "Updated",
  });
  expect(changes).toEqual([{ title: "Updated", revision: 2 }]);
  expect(store.getState().windows.map(({ id, title }) => ({ id, title }))).toEqual([
    { id: "first", title: "Updated" },
    { id: "second", title: "Updated" },
    { id: "other", title: "Other" },
  ]);
  store.history.undo();
  expect(store.getState().windows.map((window) => window.title)).toEqual([
    "Original",
    "Original",
    "Other",
  ]);
});
