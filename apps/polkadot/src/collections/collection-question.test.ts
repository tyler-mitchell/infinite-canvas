import { expect, test } from "vite-plus/test";

import type { ContentItemRecord, ContentRelation } from "../database/database.client";
import type { ProjectContent } from "../content/project-content";
import { resolveCollectionItems } from "./collection-store";

/**
 * What a collection lists, answered from the project rather than remembered.
 *
 * This used to be a database query whose answer was cached per collection and refreshed on open and
 * on question change — and nowhere else. Driven 2026-08-28: four notes stored, an open collection
 * drawing three, because the fourth was created after the window was.
 *
 * The answer is derived now, which is also why these tests can exist: the old resolve needed an
 * engine, and this needs a listing and a list of edges.
 */

const PROJECT = "project:one";

const item = (id: string, kind: string, title = id): ContentItemRecord =>
  ({ content: {}, id, kind, project: PROJECT, revision: 1, title }) as unknown as ContentItemRecord;

const edge = (source: string, target: string): ContentRelation =>
  ({
    id: `rel-${source}-${target}`,
    kind: "relates",
    label: null,
    source,
    target,
  }) as unknown as ContentRelation;

const listingOf = (...items: readonly ContentItemRecord[]): ProjectContent => ({
  items,
  projectId: PROJECT,
});

const NOTE_A = item("item:a", "note");
const NOTE_B = item("item:b", "note");
const IMAGE = item("item:c", "image");

test("a kind question lists that kind and nothing else", () => {
  expect(
    resolveCollectionItems({
      listing: listingOf(NOTE_A, IMAGE, NOTE_B),
      projectId: PROJECT,
      question: { listsKind: "note" },
      relations: [],
    }),
  ).toStrictEqual([NOTE_A, NOTE_B]);
});

test("an item created after the collection opened is listed, which is the defect this closes", () => {
  /*
   * The cache made this impossible: the same question, asked twice, had to give the same answer
   * until something remembered to refresh. Derived, "again" and "afresh" are the same call.
   */
  const question = { listsKind: "note" } as const;
  const before = resolveCollectionItems({
    listing: listingOf(NOTE_A),
    projectId: PROJECT,
    question,
    relations: [],
  });
  const after = resolveCollectionItems({
    listing: listingOf(NOTE_A, NOTE_B),
    projectId: PROJECT,
    question,
    relations: [],
  });

  expect(before).toStrictEqual([NOTE_A]);
  expect(after).toStrictEqual([NOTE_A, NOTE_B]);
});

test("a connection question follows an edge from either end", () => {
  // Undirected, matching `findRelation`: whoever connected two things did not choose a direction.
  const question = { connectedTo: "item:a" } as const;

  expect(
    resolveCollectionItems({
      listing: listingOf(NOTE_A, NOTE_B, IMAGE),
      projectId: PROJECT,
      question,
      relations: [edge("item:a", "item:b"), edge("item:c", "item:a")],
    }),
  ).toStrictEqual([NOTE_B, IMAGE]);
});

test("cutting the edge removes the row, with nothing to invalidate", () => {
  const question = { connectedTo: "item:a" } as const;
  const listing = listingOf(NOTE_A, NOTE_B);

  expect(
    resolveCollectionItems({
      listing,
      projectId: PROJECT,
      question,
      relations: [edge("item:a", "item:b")],
    }),
  ).toStrictEqual([NOTE_B]);
  expect(
    resolveCollectionItems({ listing, projectId: PROJECT, question, relations: [] }),
  ).toStrictEqual([]);
});

test("an edge to something the listing does not hold contributes nothing", () => {
  /*
   * Archived items are not in `projectContent$`, so an edge to one resolves to no record rather than
   * to a row that cannot be opened. The query needed its own rule for this; deriving does not.
   */
  expect(
    resolveCollectionItems({
      listing: listingOf(NOTE_A),
      projectId: PROJECT,
      question: { connectedTo: "item:a" },
      relations: [edge("item:a", "item:archived")],
    }),
  ).toStrictEqual([]);
});

test("a listing belonging to another project answers nothing, rather than that project's items", () => {
  // The guard `getProjectContent` already enforces: between navigating and the first query landing,
  // the previous project's items must not be read as this one's.
  expect(
    resolveCollectionItems({
      listing: { items: [NOTE_A, NOTE_B], projectId: "project:other" },
      projectId: PROJECT,
      question: { listsKind: "note" },
      relations: [],
    }),
  ).toStrictEqual([]);
  expect(
    resolveCollectionItems({
      listing: null,
      projectId: PROJECT,
      question: { listsKind: "note" },
      relations: [],
    }),
  ).toStrictEqual([]);
});
