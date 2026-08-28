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

/**
 * A collection holds nothing of its own. Both halves come from the project listing.
 *
 * There were two observables here — the record and what it resolved to — and both were caches of
 * facts `projectContent$` already held. The resolved half showed the project as it was when the
 * window opened. The record half was worse: a rename writes storage and folds the *listing*, so this
 * copy kept the old title and the old revision, and the next question change sent the stale one.
 * Driven 2026-08-28 — renaming a collection and then changing what it lists failed with
 * `ContentRevisionConflictError ... changed after revision 4` against storage at 5, the question
 * unchanged and nothing on screen saying so.
 *
 * `project-content`'s header calls a title's single owner the thing that "cannot be forgotten". This
 * file was the place that forgot it, by keeping a second one.
 */

type CollectionEntry = Readonly<{
  collection: CollectionRecord | null;
  error: string | null;
  status: "error" | "loading" | "ready";
}>;

/**
 * The record, read out of the listing.
 *
 * `null` listing is "nobody has asked yet", which is not "no such collection" — the same distinction
 * `projectContent$` draws for itself, and the reason a missing item is only an error once the
 * listing has actually answered.
 *
 * The question is parsed rather than asserted: `toCollection` throws, and this runs during render.
 * A record whose content cannot be read says so instead of taking the window down.
 */
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
 * Ask a different question.
 *
 * Takes the record rather than an id, because the caller already derived one and re-deriving here
 * would be a second read of the same listing that could disagree with what the picker was showing.
 *
 * Both halves of the write are folded back: the question, because a rename reads it out of the
 * listing and passes it through unchanged — so a listing holding the superseded one would restore
 * it — and the revision, because the next write has to hold one the database will still accept.
 */
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
