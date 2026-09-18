import { afterEach, expect, test, vi } from "vite-plus/test";

import type { ContentItemRecord, ContentRelation } from "../database/database.client";
import { projectContent$, projectListings$, type ProjectContent } from "../content/project-content";
import { collectionGateway } from "./collection-gateway";
import {
  getCollectionEntry,
  resolveCollectionItems,
  setCollectionQuestion,
} from "./collection-store";

afterEach(() => vi.restoreAllMocks());

const PROJECT = "project:one";

const item = (id: string, kind: string, title = id): ContentItemRecord => ({
  content: {},
  id,
  kind,
  revision: 1,
  title,
});

const edge = (source: string, target: string): ContentRelation => ({
  id: `relates_to:${source.replaceAll(":", "_")}_${target.replaceAll(":", "_")}`,
  kind: "relates",
  label: null,
  source,
  target,
});

const listingOf = (...items: readonly ContentItemRecord[]): ProjectContent => ({
  items,
  projectId: PROJECT,
});

const NOTE_A = item("content_item:a", "note");
const NOTE_B = item("content_item:b", "note");
const IMAGE = item("content_item:c", "image");

test("a collection reference cannot read another content kind", () => {
  const content = { listsKind: "note" };
  const collectionId = "content_item:collection";
  const input = { collectionId, projectId: PROJECT };
  expect(
    getCollectionEntry({
      ...input,
      listing: listingOf({ ...item(collectionId, "note"), content }),
    }),
  ).toEqual({ collection: null, error: "This collection no longer exists.", status: "error" });
  expect(
    getCollectionEntry({
      ...input,
      listing: listingOf({ ...item(collectionId, "collection"), content }),
    }).status,
  ).toBe("ready");
});

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
  // Relations are undirected.
  const question = { connectedTo: "content_item:a" } as const;

  expect(
    resolveCollectionItems({
      listing: listingOf(NOTE_A, NOTE_B, IMAGE),
      projectId: PROJECT,
      question,
      relations: [
        edge("content_item:a", "content_item:b"),
        edge("content_item:c", "content_item:a"),
      ],
    }),
  ).toStrictEqual([NOTE_B, IMAGE]);
});

test("cutting the edge removes the row, with nothing to invalidate", () => {
  const question = { connectedTo: "content_item:a" } as const;
  const listing = listingOf(NOTE_A, NOTE_B);

  expect(
    resolveCollectionItems({
      listing,
      projectId: PROJECT,
      question,
      relations: [edge("content_item:a", "content_item:b")],
    }),
  ).toStrictEqual([NOTE_B]);
  expect(
    resolveCollectionItems({ listing, projectId: PROJECT, question, relations: [] }),
  ).toStrictEqual([]);
});

test("an edge to something the listing does not hold contributes nothing", () => {
  expect(
    resolveCollectionItems({
      listing: listingOf(NOTE_A),
      projectId: PROJECT,
      question: { connectedTo: "content_item:a" },
      relations: [edge("content_item:a", "content_item:archived")],
    }),
  ).toStrictEqual([]);
});

test("a listing belonging to another project answers nothing, rather than that project's items", () => {
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

test.each([
  {
    name: "connections",
    before: { listsKind: "note", annotation: { text: "Keep this" } },
    question: { connectedTo: "content_item:anchor" },
    expected: { connectedTo: "content_item:anchor", annotation: { text: "Keep this" } },
  },
  {
    name: "kind",
    before: { connectedTo: "content_item:anchor", annotation: { text: "Keep this" } },
    question: { listsKind: "image" },
    expected: { listsKind: "image", annotation: { text: "Keep this" } },
  },
])(
  "changing the question to $name preserves unrelated content",
  async ({ before, question, expected }) => {
    const save = vi.spyOn(collectionGateway, "save").mockImplementation(async (input) => ({
      id: input.collectionId,
      content: input.question,
      revision: input.revision + 1,
      title: input.title,
    }));
    const collection = {
      id: "content_item:collection",
      content: structuredClone(before),
      revision: 4,
      title: "Collection",
    };
    projectListings$[PROJECT].set({
      projectId: PROJECT,
      items: [{ ...structuredClone(collection), kind: "collection" }],
    });
    await setCollectionQuestion({ collection, question });
    expect(save).toHaveBeenCalledExactlyOnceWith({
      collectionId: collection.id,
      question: expected,
      revision: 4,
      title: "Collection",
    });
    expect(projectContent$[PROJECT].peek()?.items[0]?.content).toEqual(expected);
    expect(projectContent$[PROJECT].peek()?.items[0]?.revision).toBe(5);
  },
);
