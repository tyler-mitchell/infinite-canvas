import { type } from "arktype";

import {
  getProjectContent,
  setProjectItemContent,
  setProjectItemRevision,
  type ProjectContent,
} from "../content/project-content";
import type { ContentItemRecord, ContentRelation } from "../database/database.client";
import {
  collectionGateway,
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

  const item = items.find((candidate) => candidate.id === input.collectionId);

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

async function setCollectionQuestion(
  input: Readonly<{ collection: CollectionRecord; question: CollectionQuestion }>,
) {
  const saved = await collectionGateway.save({
    collectionId: input.collection.id,
    question: input.question,
    revision: input.collection.revision,
    title: input.collection.title,
  });

  setProjectItemContent(saved.id, saved.content);
  setProjectItemRevision(saved.id, saved.revision);
}

export { getCollectionEntry, resolveCollectionItems, setCollectionQuestion };
export type { CollectionEntry };
