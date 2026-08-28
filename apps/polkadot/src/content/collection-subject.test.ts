import {
  createInfiniteCanvasState,
  createInfiniteCanvasWindow,
  type InfiniteCanvasState,
} from "@hyphened/infinite-canvas";
import { expect, test } from "vite-plus/test";

import type { WindowKind } from "../canvas/window-registry";
import type { ContentItemRecord } from "../database/database.client";
import { describeProjectContent } from "./describe-content";
import type { ProjectContent } from "./project-content";

/**
 * What a collection is a collection *of*.
 *
 * Every other kind carries its subject in its title. A collection's title is a name and its
 * question is the content, so the listing said `collection "Reading list" [id]` and left a caller
 * to open it to find out what was inside.
 *
 * The gap hides behind the default naming: a collection of links is called "Links", so the title
 * and the subject coincide until somebody renames one — which is exactly when a caller most needs
 * telling, and exactly the case driven in the browser that turned this up.
 *
 * A separate file from `describe-content.test.ts` deliberately: that one is being edited elsewhere,
 * and adding to it would mean committing somebody's unfinished work along with this.
 */

const item = (id: string, kind: string, title: string, content: object = {}) =>
  ({
    archived: false,
    content,
    id,
    kind,
    projectId: "project-1",
    title,
  }) as unknown as ContentItemRecord;

const empty = createInfiniteCanvasState<WindowKind>({
  viewport: { height: 800, width: 1200 },
  windows: [],
});

/**
 * One place that builds the listing, because the first draft built a second one inline and left
 * `projectId` off it — so the report answered "not loaded yet" and the cast said nothing.
 */
const describe = (
  items: readonly ContentItemRecord[],
  state: InfiniteCanvasState<WindowKind> = empty,
) =>
  describeProjectContent({
    listing: { items, projectId: "project-1" } as ProjectContent,
    projectId: "project-1",
    relations: [],
    state,
  });

test("a collection says which kind it lists, so a renamed one is still legible", () => {
  const described = describe([
    item("c1", "collection", "Reading list", { listsKind: "link" }),
    item("n1", "note", "Quarterly notes"),
  ]);

  expect(described).toContain('collection "Reading list" [c1] (lists every link in this project)');
  // The other kinds are untouched: only a collection has a subject to report.
  expect(described).toContain('note "Quarterly notes" [n1]');
  expect(described).not.toContain('Quarterly notes" [n1] (');
});

test("a connected-to collection names its subject by title, in the listing's own vocabulary", () => {
  const described = describe([
    item("c2", "collection", "Around the review", { connectedTo: "n1" }),
    item("n1", "note", "Quarterly notes"),
  ]);

  expect(described).toContain('lists what "Quarterly notes" connects to');
});

test("a subject the listing does not hold falls back to its id rather than vanishing", () => {
  // The same rule the relations half already follows: a half-resolved reference is a fact worth
  // reporting, and dropping it under-reports the project.
  expect(describe([item("c3", "collection", "Orphaned", { connectedTo: "gone" })])).toContain(
    "lists what [gone] connects to",
  );
});

test("open-state and subject read together rather than one replacing the other", () => {
  const showing = createInfiniteCanvasState<WindowKind>({
    viewport: { height: 800, width: 1200 },
    windows: [
      createInfiniteCanvasWindow<WindowKind, { itemId: string }>({
        data: { itemId: "c4" },
        id: "w1",
        kind: "collection",
        rect: { height: 200, width: 320, x: 0, y: 0 },
        title: "Links",
      }),
    ],
  });

  expect(describe([item("c4", "collection", "Links", { listsKind: "link" })], showing)).toContain(
    "[c4] (open, lists every link in this project)",
  );
});

test("a collection whose stored question cannot be read is still listed", () => {
  /*
   * A report must never throw — its two callers are tool output and have no response to an
   * exception except to render nothing, which would lose the whole project rather than one field.
   * So an unparseable question costs the subject and nothing else.
   */
  const described = describe([item("c5", "collection", "Broken", { nonsense: true })]);

  expect(described).toContain('collection "Broken" [c5]');
  expect(described).not.toContain("lists");
});
