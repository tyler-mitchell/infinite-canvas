import { observable } from "@legendapp/state";

import {
  getProjectContent,
  setProjectItemContent,
  setProjectItemRevision,
  type ProjectContent,
} from "../content/project-content";
import type { ContentItemRecord, ContentRelation } from "../database/database.client";
import {
  collectionGateway,
  type CollectionQuestion,
  type CollectionRecord,
} from "./collection-gateway";

/**
 * Open collections, by which this file means the record — the question and its revision.
 *
 * What the question *resolves to* is not held here and is not held anywhere. It was, in a second
 * observable beside this one, and that cache is the defect `resolveCollectionItems` describes.
 */

type CollectionEntry = Readonly<{
  collection: CollectionRecord | null;
  error: string | null;
  status: "error" | "loading" | "ready";
}>;

const collections$ = observable<Record<string, CollectionEntry>>({});
const loaded = new Set<string>();

function getCollectionEntry(collectionId: string) {
  return collections$[collectionId];
}

/**
 * The collection's question, answered from what is already known.
 *
 * This was a query whose answer was cached in `resolved$`, refreshed when the collection opened and
 * when its question changed — and nowhere else. So the one thing its own docstring said a collection
 * must never do is exactly what it did: creating a note left an open collection listing the project
 * as it was when the window opened. Measured 2026-08-28 — four notes stored, three rows drawn.
 *
 * **Refreshing at the sites that forgot is the fix that does not work**, which `project-content`
 * already says in its header about the rail's own cache: the next writer forgets too. Connecting,
 * disconnecting, archiving, restoring, renaming and creating all change the answer, and a second
 * cache means six places to remember.
 *
 * So there is no cache and no query. Both inputs are already live and already authoritative:
 * `projectContent$` is the project's items — every kind, archived excluded — and `relations$` is its
 * edges, reloaded by `connectItems` and `disconnectItems`. Derived on read, a collection cannot be
 * stale, because there is nothing to go stale.
 *
 * An edge whose other end is archived contributes nothing, because the listing has no record for it.
 * That is the same answer the query gave and it now needs no separate rule.
 */
function resolveCollectionItems(
  input: Readonly<{
    listing: ProjectContent | null;
    projectId: string;
    question: CollectionQuestion;
    relations: readonly ContentRelation[];
  }>,
): readonly ContentItemRecord[] {
  const items = getProjectContent(input.listing, input.projectId) ?? [];

  if (!("connectedTo" in input.question)) {
    const listsKind = input.question.listsKind;

    return items.filter((item) => item.kind === listsKind);
  }

  const connectedTo = input.question.connectedTo;
  // Undirected, matching `findRelation`: whichever end this collection is, the other is a neighbour.
  const neighbours = new Set(
    input.relations.flatMap((relation) =>
      relation.source === connectedTo
        ? [relation.target]
        : relation.target === connectedTo
          ? [relation.source]
          : [],
    ),
  );

  return items.filter((item) => neighbours.has(item.id));
}

/**
 * Loads a collection's record once per id. What it lists is derived, not loaded.
 *
 * `projectId` is no longer used and no longer taken: it existed to scope the resolve this function
 * used to trigger, and a parameter nothing reads is a claim that this still depends on the project.
 */
function ensureCollectionLoaded(collectionId: string) {
  if (loaded.has(collectionId)) {
    return;
  }

  loaded.add(collectionId);
  collections$[collectionId].set({ collection: null, error: null, status: "loading" });

  void collectionGateway
    .read(collectionId)
    .then((collection) => {
      collections$[collectionId].set(
        collection === null
          ? { collection: null, error: "This collection no longer exists.", status: "error" }
          : { collection, error: null, status: "ready" },
      );
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
 * Ask a different question. Nothing re-resolves, because nothing was resolved.
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
  setProjectItemRevision(input.collectionId, saved.revision);
}

export {
  collections$,
  ensureCollectionLoaded,
  getCollectionEntry,
  resolveCollectionItems,
  setCollectionQuestion,
};
export type { CollectionEntry };
