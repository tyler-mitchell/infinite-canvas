import { type } from "arktype";

import type { ContentItemRecord } from "../database/database.client";
import { content } from "../database/operations";

const COLLECTION_KIND = "collection";

// ArkType rejects morphs inside this unordered union during module parsing.
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

export { COLLECTION_KIND, CollectionContent, toCollection };
export type { CollectionQuestion, CollectionRecord };
