import { type } from "arktype";

import {
  getProjectContent,
  updateProjectItem,
  type ProjectContent,
} from "../content/project-content";
import type { ContentItemRecord, ContentRelation } from "../database/database.client";
import {
  collectionGateway,
  COLLECTION_KIND,
  CollectionContent,
  type CollectionQuestion,
  type CollectionRecord,
} from "./collection-gateway";

type CollectionEntry = Readonly<{
  collection: CollectionRecord | null;
  error: string | null;
  status: "error" | "loading" | "ready";
}>;

/** A null listing means that the query has not returned. */
function getCollectionEntry(
  input: Readonly<{ collectionId: string; listing: ProjectContent | null; projectId: string }>,
): CollectionEntry {
  const items = getProjectContent(input.listing, input.projectId);

  if (items === null) {
    return { collection: null, error: null, status: "loading" };
  }

  const item = items.find(
    (candidate) => candidate.id === input.collectionId && candidate.kind === COLLECTION_KIND,
  );

  if (item === undefined) {
    return { collection: null, error: "This collection no longer exists.", status: "error" };
  }

  const question = CollectionContent(item.content);

  return question instanceof type.errors
    ? { collection: null, error: "This collection's question could not be read.", status: "error" }
    : {
        collection: {
          content: question,
          id: item.id,
          revision: item.revision,
          title: item.title,
        },
        error: null,
        status: "ready",
      };
}

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
  // Relations are undirected.
  const neighbours = new Set(
    input.relations.flatMap((relation) => {
      if (relation.source === connectedTo) return [relation.target];
      if (relation.target === connectedTo) return [relation.source];
      return [];
    }),
  );

  return items.filter((item) => neighbours.has(item.id));
}

async function setCollectionQuestion(
  input: Readonly<{ collection: CollectionRecord; question: CollectionQuestion }>,
) {
  const content = Object.fromEntries(
    Object.entries(input.collection.content).filter(
      ([key]) => key !== "listsKind" && key !== "connectedTo",
    ),
  );
  const saved = await collectionGateway.save({
    collectionId: input.collection.id,
    question: { ...content, ...input.question },
    revision: input.collection.revision,
    title: input.collection.title,
  });

  updateProjectItem({ id: saved.id, content: saved.content, revision: saved.revision });
}

export { getCollectionEntry, resolveCollectionItems, setCollectionQuestion };
export type { CollectionEntry };
