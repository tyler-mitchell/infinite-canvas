import { createInfiniteCanvasState, type InfiniteCanvasCommands } from "@hyphened/infinite-canvas";
import { expect, test } from "vite-plus/test";

import type { WindowKind } from "../canvas/window-registry";
import type { ContentItemRecord } from "../database/database.client";
import { getAppAction } from "../app-actions";
import { LISTABLE_KINDS } from "../collections/listable-kinds";
import { RENAMEABLE_KINDS, renameProjectItem } from "./rename-item";

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

/**
 * What the verb tells a caller it can rename, against what it can.
 *
 * The description read "only notes can be renamed this way; other kinds are renamed from their
 * window" — true when written, and quietly false from the moment collections, images and links each
 * grew a writer. A caller that cannot see the screen has nothing but that sentence to decide whether
 * to try, so an out-of-date one hides the capability as thoroughly as never having built it: an
 * agent holding an image reads it and does not ask.
 *
 * Asserted against the same map the saving reads, which is the whole point — the description
 * interpolates `RENAMEABLE_KINDS`, so this can only fail if someone writes the list by hand again.
 */
test("the verb names every kind it can actually rename", () => {
  const description = getAppAction("content.rename")?.description ?? "";

  for (const kind of RENAMEABLE_KINDS) {
    expect(description).toContain(kind);
  }

  // Guards the guard: if the map ever held one kind, "contains every kind" would pass against the
  // sentence this exists to prevent.
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

/**
 * Every kind the library lists can be renamed, and this is the rule three separate bugs broke.
 *
 * The guard started note-only, so collections were refused a rename `collectionGateway.save` could
 * always have stored. Then images and links were refused with a message naming their own window —
 * which has no title control, and for an image no controls at all. Each time the guard was inherited
 * from the surface before it rather than checked against what the gateways can actually do.
 *
 * A person cannot be relied on to remember this when a fifth kind arrives; the listing can. If a
 * kind appears in the library and nothing can save a title for it, that is either a missing writer
 * or a kind that should not be listed — and both are worth failing a suite over, because the symptom
 * otherwise is a rename that looks right until the next read.
 */
test("every kind the library lists has something that can save its title", () => {
  const unrenameable = LISTABLE_KINDS.filter((kind) => !RENAMEABLE_KINDS.includes(kind.kind));

  // Guards the guard: an empty listing would make the filter vacuously pass.
  expect(LISTABLE_KINDS.length).toBeGreaterThan(3);
  expect(
    unrenameable.map((kind) => kind.kind),
    "listed in the library but nothing can save a new title for them",
  ).toStrictEqual([]);
});

test("the writers are exactly the listed kinds, so neither list quietly grows past the other", () => {
  /*
   * The other direction, which matters less but is cheap: a writer for a kind the library never
   * lists is dead code that reads as coverage. Sorted rather than compared as sets, since the
   * assertion message is more useful when it names what differs.
   */
  expect([...RENAMEABLE_KINDS].sort()).toStrictEqual(
    LISTABLE_KINDS.map((kind) => kind.kind).sort(),
  );
});

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
   * No kind this app ships reaches this any more, which is the point of the history.
   *
   * "collection" was refused until the gateways were read — it had a `save` taking a title all
   * along. Then images and links were refused with a message naming a route that did not exist: an
   * image window has no controls and a link window has one, "Open in browser". Both gateways grew a
   * `rename` rather than the sentence being corrected.
   *
   * So this now guards a fifth kind added without a writer, which would otherwise look renamed until
   * the next read — `setProjectItemTitle` writes to the cached listing, not to storage.
   */
  expect(rename(item("diagram", "Untitled 1"), "Better name")).toContain("has no writer yet");

  /*
   * Deliberately not asserting that a *note* passes this guard. Doing so runs the real write —
   * `renameNote` hands the record to its gateway — and this app has no database tests, so the line
   * that checked it was firing a floating promise at storage from a unit suite. That a note is
   * renameable is what driving it in a browser proves; the guard-the-guard here is the blank and
   * unchanged cases above, which reach the same function and return different refusals.
   */
});

test("the refusal names the kind it could not save", () => {
  // Quoted rather than given an article: an earlier version read "a image", caught by this test.
  // Choosing "a" or "an" from the first letter would be a rule to keep for a handful of words.
  expect(rename(item("diagram", "sketch"), "Cover")).toContain('a "diagram"');
  expect(rename(item("recording", "take 1"), "Interview")).toContain('a "recording"');
});

test("blank is checked before kind, so the worse answer is not given for the smaller mistake", () => {
  // An empty rename is an empty rename whatever the kind. Reporting a missing writer for it would
  // answer a question the caller did not ask and hide the one it got wrong.
  expect(rename(item("diagram", "sketch"), "  ")).toBe("Refused: a name cannot be blank.");
});
