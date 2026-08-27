import { observable } from "@legendapp/state";

import type { ContentRelation } from "../database/database.client";
import * as database from "../database/operations";

/**
 * Typed edges between content items, for the project on screen.
 *
 * This lived in `notes/` and was named for notes throughout, which was true of every caller and
 * never true of the model: `relates_to` is `IN content_item OUT content_item` and has been since
 * the first migration. The second window kind is what made the misnomer cost something — an image
 * and a note were joinable in the database and not on the canvas, because every name along the path
 * said the endpoints were notes.
 *
 * Nothing here reads an endpoint's kind. An edge is two ids and what it means.
 */

const relations$ = observable<readonly ContentRelation[]>([]);

/**
 * What a connection can mean.
 *
 * Argument-mapping vocabulary rather than an invented one, and deliberately small: five verbs a
 * person can hold in their head beats a taxonomy they have to consult. Each is written as the word
 * the connector shows, so the stored kind and the drawn label are the same string — there is no
 * second table mapping one to the other and therefore no way for them to disagree.
 *
 * `relates` is the default and shows nothing. An unlabelled line is the honest rendering of "these
 * belong together", which is the claim `relate` already makes by existing; drawing the word
 * "relates" on it would put a label on every edge that says only what the line says.
 */
const RELATION_KINDS = ["relates", "supports", "contradicts", "refines", "follows"] as const;

type RelationKind = (typeof RELATION_KINDS)[number];

const DEFAULT_RELATION_KIND: RelationKind = "relates";

/**
 * What a connector says, or nothing when it makes no claim beyond existing.
 *
 * A written label wins over the kind, because someone who typed a sentence on this edge was being
 * more specific than the five verbs allow — "blocks the review" says something `contradicts` only
 * gestures at. The kind stays underneath either way: it is the queryable category, and the label is
 * how this one edge reads. Clearing the label falls back to the kind rather than to silence.
 */
const getRelationLabel = (relation: ContentRelation) =>
  relation.label?.trim() || (relation.kind === DEFAULT_RELATION_KIND ? undefined : relation.kind);

/**
 * Which project the held edges belong to, so a stale set can be told apart from a current one.
 *
 * Kept beside the list rather than inside it because every reader of `relations$` wants a bare
 * array and there are five of them. `project-notes.ts` carries its project *in* the observable,
 * which is the better shape and the one this should eventually take; doing that here means changing
 * five call sites at once, two of which are being edited right now. This is the same guarantee at
 * the one place it is enforced.
 */
const loadedProject = { id: null as string | null };

/**
 * Ask again, and stop answering with another project's edges while the asking is in flight.
 *
 * The clear is the fix. Without it, `relations$` held the previous project's edges for the whole
 * duration of the query after navigating, and nothing could tell — `project-notes.ts` names this
 * exact defect in its own header as the correction still owed here.
 *
 * The visible cost was small, because edges reference item ids the new canvas does not have, so
 * little drew. The real one is a write: `findRelation` reads this to decide whether the palette
 * offers Connect or Disconnect, and against another project's edges it answers "not connected" for
 * a pair that is. Acting on that answer stores a duplicate edge — a wrong pixel repaints, a wrong
 * row does not.
 *
 * Empty is the honest interim answer. It is briefly incomplete rather than confidently wrong, and
 * every reader already renders "no connections" correctly.
 */
async function loadRelations(projectId: string) {
  if (loadedProject.id !== projectId) {
    loadedProject.id = projectId;
    relations$.set([]);
  }

  const loaded = await database.relations.list(projectId);

  // Another navigation may have overtaken this query. Landing now would put the project we just
  // left back on screen — the defect this function exists to close, arriving by a slower route.
  if (loadedProject.id === projectId) {
    relations$.set(loaded);
  }
}

/**
 * `kind` is optional because the pointer gesture cannot express one.
 *
 * Dragging a line between two windows says they belong together and nothing more, so the drag
 * stores the default and the connector's menu says what it means afterwards. A caller that is not
 * dragging is under no such limit — `database.relations.connect` has always taken a kind, and this
 * hardcoded the default over it, which left the typed half of the model reachable only by editing
 * an edge that already existed.
 */
async function connectItems(
  input: Readonly<{ kind?: RelationKind; projectId: string; source: string; target: string }>,
) {
  await database.relations.connect({
    kind: input.kind ?? DEFAULT_RELATION_KIND,
    source: input.source,
    target: input.target,
  });
  await loadRelations(input.projectId);
}

/**
 * Say what an existing connection means.
 *
 * The edge is named by id rather than by its endpoints: the caller selected a specific connector on
 * the canvas, so there is nothing to resolve, and the undirected endpoint lookup `disconnectItems`
 * needs would be answering a question nobody asked.
 */
async function setRelationKind(
  input: Readonly<{ kind: RelationKind; projectId: string; relationId: string }>,
) {
  await database.relations.setKind({ kind: input.kind, relationId: input.relationId });
  await loadRelations(input.projectId);
}

/** Empty is not a label, it is the absence of one, so it clears rather than storing `""`. */
async function setRelationLabel(
  input: Readonly<{ label: string; projectId: string; relationId: string }>,
) {
  await database.relations.setLabel({
    label: input.label.trim() === "" ? null : input.label.trim(),
    relationId: input.relationId,
  });
  await loadRelations(input.projectId);
}

async function disconnectItems(
  input: Readonly<{ projectId: string; source: string; target: string }>,
) {
  await database.relations.disconnect({ source: input.source, target: input.target });
  await loadRelations(input.projectId);
}

/** Undirected, because a user who connected two things did not choose a direction. */
function findRelation(
  relations: readonly ContentRelation[],
  source: string,
  target: string,
): ContentRelation | undefined {
  return relations.find(
    (relation) =>
      (relation.source === source && relation.target === target) ||
      (relation.source === target && relation.target === source),
  );
}

export {
  connectItems,
  DEFAULT_RELATION_KIND,
  disconnectItems,
  findRelation,
  getRelationLabel,
  loadRelations,
  RELATION_KINDS,
  relations$,
  setRelationKind,
  setRelationLabel,
};
export type { RelationKind };
