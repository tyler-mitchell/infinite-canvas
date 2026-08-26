import { observable } from "@legendapp/state";

import type { ContentItemRecord } from "../database/database.client";
import { collectionGateway, type CollectionRecord } from "./collection-gateway";

/**
 * Open collections and what each one currently resolves to.
 *
 * Two observables rather than one nested entry, because they are invalidated by different things:
 * the record changes when someone edits the collection, and the resolved list changes whenever
 * *anything else in the project* is created, archived or renamed. Folding them together would make
 * every content write look like an edit to the collection itself.
 */

type CollectionEntry = Readonly<{
  collection: CollectionRecord | null;
  error: string | null;
  status: "error" | "loading" | "ready";
}>;

const collections$ = observable<Record<string, CollectionEntry>>({});
const resolved$ = observable<Record<string, readonly ContentItemRecord[]>>({});
const loaded = new Set<string>();

function getCollectionEntry(collectionId: string) {
  return collections$[collectionId];
}

function getResolvedItems(collectionId: string) {
  return resolved$[collectionId];
}

/**
 * Answer the collection's question again.
 *
 * Public and called on every open rather than cached across them: a collection is a live listing,
 * and the one thing it must never do is show a project the way it was the last time someone looked
 * at it. Cheap enough to mean it — the listing is one indexed query per kind.
 */
async function refreshCollection(
  input: Readonly<{ collectionId: string; listsKind: string; projectId: string }>,
) {
  resolved$[input.collectionId].set(
    await collectionGateway.resolve({ listsKind: input.listsKind, projectId: input.projectId }),
  );
}

/** Loads a collection once per id, then resolves what it lists. */
function ensureCollectionLoaded(collectionId: string, projectId: string) {
  if (loaded.has(collectionId)) {
    return;
  }

  loaded.add(collectionId);
  collections$[collectionId].set({ collection: null, error: null, status: "loading" });

  void collectionGateway
    .read(collectionId)
    .then(async (collection) => {
      if (collection === null) {
        collections$[collectionId].set({
          collection: null,
          error: "This collection no longer exists.",
          status: "error",
        });

        return;
      }

      collections$[collectionId].set({ collection, error: null, status: "ready" });
      await refreshCollection({
        collectionId,
        listsKind: collection.content.listsKind,
        projectId,
      });
    })
    .catch((error: unknown) => {
      loaded.delete(collectionId);
      collections$[collectionId].set({
        collection: null,
        error: error instanceof Error ? error.message : "Could not open this collection.",
        status: "error",
      });
    });
}

/**
 * Point a collection at a different kind, and re-resolve.
 *
 * The record's revision is folded back from the write, exactly as a note's is: the listing the user
 * is looking at is the source of truth for what is on screen, and the next write has to hold a
 * revision the database will still accept.
 */
async function setCollectionKind(
  input: Readonly<{ collectionId: string; listsKind: string; projectId: string }>,
) {
  const entry = collections$[input.collectionId].peek();

  if (entry?.collection == null) {
    return;
  }

  const saved = await collectionGateway.save({
    collectionId: input.collectionId,
    listsKind: input.listsKind,
    revision: entry.collection.revision,
    title: entry.collection.title,
  });

  collections$[input.collectionId].collection.set(saved);
  await refreshCollection(input);
}

export {
  collections$,
  ensureCollectionLoaded,
  getCollectionEntry,
  getResolvedItems,
  refreshCollection,
  resolved$,
  setCollectionKind,
};
export type { CollectionEntry };
