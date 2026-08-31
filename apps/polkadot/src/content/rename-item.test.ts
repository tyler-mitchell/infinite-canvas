import { createInfiniteCanvasState, type InfiniteCanvasCommands } from "@hyphened/infinite-canvas";
import { expect, test } from "vite-plus/test";

import type { WindowKind } from "../canvas/window-registry";
import type { ContentItemRecord } from "../database/database.client";
import { getAppAction } from "../app-actions";
import { LISTABLE_KINDS } from "../collections/listable-kinds";
import { RENAMEABLE_KINDS, renameProjectItem } from "./rename-item";

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

const actions = {
  setWindowTitle: () => undefined,
} as unknown as InfiniteCanvasCommands<WindowKind>;

const item = (kind: string, title: string): ContentItemRecord =>
  ({
    content: { text: "" },
    id: "item-1",
    kind,
    revision: 1,
    title,
  }) as unknown as ContentItemRecord;

const rename = (record: ContentItemRecord, title: string) =>
  renameProjectItem({ actions, item: record, state, title });

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

test("a blank name is refused, and whitespace is blank", () => {
  expect(rename(item("note", "Untitled 1"), "")).toBe("Refused: a name cannot be blank.");
  expect(rename(item("note", "Untitled 1"), "   ")).toBe("Refused: a name cannot be blank.");
});

test("renaming something to what it is already called is not a rename", () => {
  expect(rename(item("note", "Quarterly"), "Quarterly")).toBe("Refused: that is already its name.");
  expect(rename(item("note", "Quarterly"), "  Quarterly  ")).toBe(
    "Refused: that is already its name.",
  );
});

test("a kind with no writer is refused rather than half-renamed", () => {
  expect(rename(item("diagram", "Untitled 1"), "Better name")).toContain("has no writer yet");
});

test("the refusal names the kind it could not save", () => {
  expect(rename(item("diagram", "sketch"), "Cover")).toContain('a "diagram"');
  expect(rename(item("recording", "take 1"), "Interview")).toContain('a "recording"');
});

test("blank is checked before kind, so the worse answer is not given for the smaller mistake", () => {
  expect(rename(item("diagram", "sketch"), "  ")).toBe("Refused: a name cannot be blank.");
});
