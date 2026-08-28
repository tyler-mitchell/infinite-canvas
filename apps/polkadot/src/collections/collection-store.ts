import { observable } from "@legendapp/state";

import { setProjectItemContent } from "../content/project-content";
import type { ContentItemRecord } from "../database/database.client";
import {
  collectionGateway,
  type CollectionQuestion,
  type CollectionRecord,
} from "./collection-gateway";

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
  input: Readonly<{ collectionId: string; projectId: string; question: CollectionQuestion }>,
) {
  resolved$[input.collectionId].set(
    await collectionGateway.resolve({
      projectId: input.projectId,
      question: input.question,
    }),
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
      await refreshCollection({ collectionId, projectId, question: collection.content });
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
 * Ask a different question, and re-resolve.
 *
 * The record's revision is folded back from the write, exactly as a note's is: the listing the user
 * is looking at is the source of truth for what is on screen, and the next write has to hold a
 * revision the database will still accept.
 */
async function setCollectionQuestion(
  input: Readonly<{ collectionId: string; projectId: string; question: CollectionQuestion }>,
) {
  const entry = collections$[input.collectionId].peek();

  if (entry?.collection == null) {
    return;
  }

  const saved = await collectionGateway.save({
    collectionId: input.collectionId,
    question: input.question,
    revision: entry.collection.revision,
    title: entry.collection.title,
  });

  collections$[input.collectionId].collection.set(saved);
  /*
   * And into the listing, because a rename reads the question back out of it.
   *
   * `rename-item.ts` passes `question: collection.content` through unchanged, so that renaming does
   * not empty the collection in the same write — and it takes that item from the project listing.
   * With the listing holding the question this write replaced, changing a question and then renaming
   * put the old one back, silently. The note store folds here for the same reason one layer over.
   */
  setProjectItemContent(input.collectionId, saved.content);
  await refreshCollection(input);
}

export {
  collections$,
  ensureCollectionLoaded,
  getCollectionEntry,
  getResolvedItems,
  refreshCollection,
  resolved$,
  setCollectionQuestion,
};
export type { CollectionEntry };
