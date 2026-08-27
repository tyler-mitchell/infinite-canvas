import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "@hyphened/infinite-canvas";
import { expect, test } from "vite-plus/test";

import type { WindowKind } from "../canvas/window-registry";
import type { ContentItemRecord, ContentRelation } from "../database/database.client";
import { describeProjectContent } from "./describe-content";
import type { ProjectContent } from "./project-content";

/**
 * The listing a caller cannot get any other way.
 *
 * `describeCanvas` reports what is open; a record whose window was closed still exists and is
 * invisible to everything except the library rail. The distinction this file guards hardest is
 * "not loaded" against "empty", because collapsing them tells a caller the project holds nothing
 * while the first query is still in flight — and that is a lie it would act on.
 */

const item = (id: string, kind: string, title: string) =>
  ({ archived: false, id, kind, projectId: "project-1", title }) as unknown as ContentItemRecord;

const listing: ProjectContent = {
  items: [item("one", "note", "Quarterly notes"), item("two", "image", "swatch.png")],
  projectId: "project-1",
};

const stateShowing = (itemIds: readonly string[]) =>
  createInfiniteCanvasState<WindowKind>({
    viewport: { height: 800, width: 1200 },
    windows: itemIds.map((itemId, index) =>
      createInfiniteCanvasWindow<WindowKind, { itemId: string }>({
        data: { itemId },
        id: `window-${index}`,
        kind: "note",
        rect: { height: 200, width: 320, x: index * 400, y: 0 },
        title: itemId,
      }),
    ),
  });

test("nothing loaded yet is not the same answer as an empty project", () => {
  expect(
    describeProjectContent({
      listing: null,
      projectId: "project-1",
      relations: [],
      state: stateShowing([]),
    }),
  ).toBe("The project's content has not loaded yet.");
  expect(
    describeProjectContent({
      listing: { items: [], projectId: "project-1" },
      projectId: "project-1",
      relations: [],
      state: stateShowing([]),
    }),
  ).toBe("This project holds nothing yet.");
});

test("a listing belonging to another project reads as not loaded, never as that project's", () => {
  // The guard `project-content` carries for exactly this: mid-navigation, the held listing is the
  // previous project's, and reporting it would attribute one project's contents to another.
  expect(
    describeProjectContent({
      listing,
      projectId: "project-2",
      relations: [],
      state: stateShowing([]),
    }),
  ).toBe("The project's content has not loaded yet.");
});

test("every item is named by kind and title", () => {
  const described = describeProjectContent({
    listing,
    projectId: "project-1",
    relations: [],
    state: stateShowing([]),
  });

  expect(described).toContain('note "Quarterly notes"');
  expect(described).toContain('image "swatch.png"');
});

test("every item carries the id that content.open takes, or the listing cannot be ordered from", () => {
  // Titles do not distinguish stored items — five "Untitled" notes are ordinary — so the id is
  // the only handle that names one item. A listing without it is a catalogue with no order form.
  const described = describeProjectContent({
    listing,
    projectId: "project-1",
    relations: [],
    state: stateShowing([]),
  });

  expect(described).toContain("[one]");
  expect(described).toContain("[two]");
});

test("items already on the canvas are marked, and the rest are counted", () => {
  // The actionable number: what is closed is what a caller might want to open.
  const described = describeProjectContent({
    listing,
    projectId: "project-1",
    relations: [],
    state: stateShowing(["one"]),
  });

  expect(described).toContain('note "Quarterly notes" [one] (open)');
  expect(described).not.toContain("[two] (open)");
  expect(described).toContain("2 item(s), 1 not open");
});

/**
 * How the project is joined, which was readable only by looking at the lines.
 *
 * On a canvas whose point is relating things, the connections are most of the content — and a
 * caller that cannot see the screen was told every item and nothing about any edge between them.
 */

const relation = (source: string, target: string, kind: string, label?: string) =>
  ({ id: `${source}-${target}`, kind, label, source, target }) as ContentRelation;

const describeWith = (relations: readonly ContentRelation[]) =>
  describeProjectContent({ listing, projectId: "project-1", relations, state: stateShowing([]) });

test("a project with no edges says so, rather than saying nothing about edges", () => {
  // Silence reads as "this report does not cover connections". "No connections" is a fact.
  expect(describeWith([])).toContain("No connections.");
});

test("a connection names both ends by the handle content.open takes", () => {
  const described = describeWith([relation("one", "two", "supports")]);

  expect(described).toContain(
    '1 connection(s): "Quarterly notes" [one] supports "swatch.png" [two]',
  );
});

test("the stored order is kept, because the kinds are not symmetric", () => {
  // "supports" read backwards is a different claim about the same two items. `findRelation` is
  // undirected so a pair cannot be joined twice; that is about identity, not about meaning.
  expect(describeWith([relation("two", "one", "supports")])).toContain(
    '"swatch.png" [two] supports "Quarterly notes" [one]',
  );
});

test("a written label wins over the kind, the way the drawn connector reads it", () => {
  expect(describeWith([relation("one", "two", "contradicts", "blocks the review")])).toContain(
    '"Quarterly notes" [one] blocks the review "swatch.png" [two]',
  );
});

test("the default kind is named rather than hidden", () => {
  /*
   * `getRelationLabel` drops "relates" because an unlabelled line already says it on screen. A
   * reader with no line has nothing to infer it from, so the report says the word — otherwise the
   * most common kind of connection is the one a caller cannot tell the meaning of.
   */
  expect(describeWith([relation("one", "two", "relates")])).toContain("[one] relates ");
});

test("an edge to something the listing does not hold is still reported", () => {
  // Dropping it would under-report the project. A half-resolved edge is a fact worth surfacing.
  const described = describeWith([relation("one", "gone", "refines")]);

  expect(described).toContain('"Quarterly notes" [one] refines [gone]');
});
