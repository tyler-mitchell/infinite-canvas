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
 * The question a collection asks — one of two, never both.
 *
 * A union rather than two optional fields, because a record carrying both would have no answer to
 * which one it means, and a record carrying neither would be a collection of nothing. The shape
 * makes the invalid states unrepresentable rather than the code checking for them.
 *
 * `listsKind` is a plain string rather than the `WindowKind` union: that is the *canvas's*
 * vocabulary and this is the database's. A collection could reasonably list a kind that has no
 * window definition yet and still be a correct listing of what is in the project, and narrowing it
 * to what happens to be renderable today would make the record lie the first time a kind is added.
 *
 * Records written before `connectedTo` existed carry `{ listsKind }` and still validate, which is
 * what a union buys over a rewrite.
 */
/*
 * No `.onUndeclaredKey("delete")`, unlike every other schema here, and it is a constraint rather
 * than an oversight: that call is a *morph*, and ArkType refuses an unordered union containing one
 * — "An unordered union of a type including a morph". Written with it, this threw at module parse
 * and took the whole canvas route down with it, which a typecheck cannot see because the union is
 * well-typed and only the runtime parse rejects it.
 *
 * Losing the strip costs nothing here. This layer authors every value it reads back: the only
 * writer of a collection's `content` is `collectionGateway`, so an undeclared key would have to be
 * one this file put there. Passing an unknown key through is also the better failure — a field
 * added by a later version survives a read by an older one instead of being silently deleted.
 */
const CollectionContent = type({ listsKind: "string" }).or({ connectedTo: "string" });

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

type CollectionQuestion = typeof CollectionContent.infer;

export const collectionGateway = {
  create: async (
    input: Readonly<{ projectId: string; question: CollectionQuestion; title: string }>,
  ) =>
    toCollection(
      await content.create({
        content: input.question,
        kind: COLLECTION_KIND,
        projectId: input.projectId,
        searchText: input.title,
        title: input.title,
      }),
    ),
  /*
   * `read` and `resolve` were here and are gone, with the two queries behind them.
   *
   * Both answered from the database and both answers were cached: `resolve` gave what the collection
   * lists, which went stale the moment anything in the project changed, and `read` gave the record,
   * which went stale on a rename and then sent that stale revision back on the next write.
   *
   * The record and the list both come out of `projectContent$` now — with `relations$` for the
   * connection question — so a collection holds nothing of its own and has nothing to refresh.
   */
  save: async (
    input: Readonly<{
      collectionId: string;
      question: CollectionQuestion;
      revision: number;
      title: string;
    }>,
  ) =>
    toCollection(
      await content.save({
        content: input.question,
        itemId: input.collectionId,
        revision: input.revision,
        searchText: input.title,
        title: input.title,
      }),
    ),
};

// `toCollection` joins the exports for the reason `toNote` is one: converting a listing record into
// the kind's own shape is what a caller outside this file needs before it can compose a save.
export { COLLECTION_KIND, CollectionContent, toCollection };
export type { CollectionQuestion, CollectionRecord };
