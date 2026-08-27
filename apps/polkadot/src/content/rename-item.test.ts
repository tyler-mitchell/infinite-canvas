import { createInfiniteCanvasState, type InfiniteCanvasCommands } from "@hyphened/infinite-canvas";
import { expect, test } from "vite-plus/test";

import type { WindowKind } from "../canvas/window-registry";
import type { ContentItemRecord } from "../database/database.client";
import { renameProjectItem } from "./rename-item";

/**
 * The rules that had drifted, now in one place and held to.
 *
 * Renaming was composed inside two click handlers — the library rail's and the command palette's —
 * and the copies did not agree. The rail trimmed the text and refused a blank or unchanged name;
 * the palette committed the raw draft. The rail asked whether the item was a note before handing it
 * to `renameNote`; the palette did not, and `toNote` runs `NoteContent.assert`, which throws on
 * anything else.
 *
 * Every case below refuses before reaching the database, which is what makes them testable here at
 * all: the successful path writes through a kind's gateway and this app has no database tests. So
 * this covers the rules, not the write — and the write is what driving it in a browser is for.
 */

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

test("a blank name is refused, and whitespace is blank", () => {
  // The palette committed the raw draft, so "   " could become an item's name — a title that reads
  // as an empty row in the library and cannot be searched for.
  expect(rename(item("note", "Untitled 1"), "")).toBe("Refused: a name cannot be blank.");
  expect(rename(item("note", "Untitled 1"), "   ")).toBe("Refused: a name cannot be blank.");
});

test("renaming something to what it is already called is not a rename", () => {
  // Reported rather than silently done, because a write that never happened should not answer
  // "done" — the same rule the whole verb vocabulary follows.
  expect(rename(item("note", "Quarterly"), "Quarterly")).toBe("Refused: that is already its name.");
  // The trim applies first, so the same name with padding is still the same name.
  expect(rename(item("note", "Quarterly"), "  Quarterly  ")).toBe(
    "Refused: that is already its name.",
  );
});

test("a kind with no writer is refused rather than half-renamed", () => {
  /*
   * The palette threw here. `toNote` asserts a note's content shape, so handing it an image raised
   * out of a click handler with nothing to catch it.
   *
   * Refusing is not conservatism: `content.save` needs the record's content, revision and search
   * text, which only a kind's own gateway holds, and `setProjectItemTitle` writes to the cached
   * listing rather than to storage. A kind with no writer would look renamed until the next read.
   *
   * **Images and links only.** "collection" was in this list until the gateways were read: it has a
   * `save` that takes a title, so it was being refused a rename the database would have stored. The
   * image and link gateways expose `create`, `list` and `read` and nothing else.
   */
  for (const kind of ["image", "link"]) {
    expect(rename(item(kind, "Untitled 1"), "Better name"), kind).toContain(
      "renamed from its own window",
    );
  }

  /*
   * Deliberately not asserting that a *note* passes this guard. Doing so runs the real write —
   * `renameNote` hands the record to its gateway — and this app has no database tests, so the line
   * that checked it was firing a floating promise at storage from a unit suite. That a note is
   * renameable is what driving it in a browser proves; the guard-the-guard here is the blank and
   * unchanged cases above, which reach the same function and return different refusals.
   */
});

test("the refusal names the kind, so a caller knows which window to go to", () => {
  // Quoted rather than given an article: an earlier version read "a image", caught by this test.
  // Choosing "a" or "an" from the first letter would be a rule to keep for a handful of words.
  expect(rename(item("image", "photo.png"), "Cover")).toContain('a "image"');
  expect(rename(item("link", "example.com"), "Source")).toContain('a "link"');
});

test("blank is checked before kind, so the worse answer is not given for the smaller mistake", () => {
  // An empty rename of an image is an empty rename. Telling someone to go to the window chrome to
  // type nothing would send them somewhere for no reason.
  expect(rename(item("image", "photo.png"), "  ")).toBe("Refused: a name cannot be blank.");
});
