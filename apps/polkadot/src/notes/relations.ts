import { observable } from "@legendapp/state";

import type { NoteRelation } from "../database/database.client";
import * as database from "../database/operations";

/**
 * Typed edges between notes, for the project on screen.
 *
 * A mention will eventually be the natural way to author one of these; connecting two selected
 * windows is the first way, and both write the same edge.
 */

const relations$ = observable<readonly NoteRelation[]>([]);

async function loadRelations(projectId: string) {
  relations$.set(await database.relations.list(projectId));
}

async function connectNotes(
  input: Readonly<{ projectId: string; source: string; target: string }>,
) {
  await database.relations.connect({ kind: "relates", source: input.source, target: input.target });
  await loadRelations(input.projectId);
}

async function disconnectNotes(
  input: Readonly<{ projectId: string; source: string; target: string }>,
) {
  await database.relations.disconnect({ source: input.source, target: input.target });
  await loadRelations(input.projectId);
}

/** Undirected, because a user who connected two notes did not choose a direction. */
function findRelation(
  relations: readonly NoteRelation[],
  source: string,
  target: string,
): NoteRelation | undefined {
  return relations.find(
    (relation) =>
      (relation.source === source && relation.target === target) ||
      (relation.source === target && relation.target === source),
  );
}

export { connectNotes, disconnectNotes, findRelation, loadRelations, relations$ };
