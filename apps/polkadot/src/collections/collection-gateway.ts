import { type } from "arktype";

import type { ContentItemRecord } from "../database/database.client";
import { content } from "../database/operations";

/**
 * A collection: a live list of everything in this project of one kind.
 *
 * The third kind, and the first that is *about* the other two. A note holds prose and an image
 * holds pixels; a collection holds a question — "what images are in this project" — and answers it
 * from the database every time it is opened rather than storing an answer that goes stale.
 *
 * It needs no query language and no new SurrealQL, which is the content spine paying off:
 * `content.list({ kind, projectId })` was already generic over kind the day it was written, so the
 * whole of this kind's data access is one call that already existed.
 */

const COLLECTION_KIND = "collection";

/**
 * What the collection lists. A kind string rather than a union, deliberately.
 *
 * `WindowKind` is the canvas's vocabulary and this is the *database's* — a collection could
 * reasonably list a kind that has no window definition yet, and would still be a correct listing of
 * what is in the project. Narrowing it to the kinds that happen to be renderable today would make
 * the record lie about what it means the first time a fourth kind is added.
 */
const CollectionContent = type({
  listsKind: "string",
}).onUndeclaredKey("delete");

type CollectionRecord = Readonly<{
  content: typeof CollectionContent.infer;
  id: string;
  revision: number;
  title: string;
}>;

function toCollection(record: ContentItemRecord): CollectionRecord {
  return {
    content: CollectionContent.assert(record.content),
    id: record.id,
    revision: record.revision,
    title: record.title,
  };
}

export const collectionGateway = {
  create: async (input: Readonly<{ listsKind: string; projectId: string; title: string }>) =>
    toCollection(
      await content.create({
        content: { listsKind: input.listsKind },
        kind: COLLECTION_KIND,
        projectId: input.projectId,
        searchText: input.title,
        title: input.title,
      }),
    ),
  read: async (collectionId: string) => {
    const record = await content.read(collectionId);

    return record === null ? null : toCollection(record);
  },
  /** What the collection is asking for, answered fresh. */
  resolve: async (input: Readonly<{ listsKind: string; projectId: string }>) =>
    content.list({ kind: input.listsKind, projectId: input.projectId }),
  save: async (
    input: Readonly<{
      collectionId: string;
      listsKind: string;
      revision: number;
      title: string;
    }>,
  ) =>
    toCollection(
      await content.save({
        content: { listsKind: input.listsKind },
        itemId: input.collectionId,
        revision: input.revision,
        searchText: input.title,
        title: input.title,
      }),
    ),
};

export { COLLECTION_KIND, CollectionContent };
export type { CollectionRecord };
