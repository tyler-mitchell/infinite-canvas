import { observable } from "@legendapp/state";

import { rememberUndoableAction } from "../content/undoable-action";
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

/**
 * Cutting a connection, and remembering how to put it back.
 *
 * This was the one removal in the app that destroyed something. `fn::unrelate_content_items` deletes
 * the row and the canvas's `history.undo` does not reach the database — driven, it answers "Undo is
 * not available right now" — so a kind someone chose and a sentence someone typed left for good.
 * That contradicted the app's own rule, written on `archiveProjectItem`: removal is archiving
 * *because* nothing is destroyed, which is why archiving needs no confirmation.
 *
 * **Rebuilt rather than un-deleted, and the difference is worth stating.** ROADMAP scoped the
 * reversible route as a stored flag every read filters plus a schema change — a soft delete. It is
 * not needed: an edge is entirely described by its two ends, its kind and its label, so an inverse
 * that reconnects with all four restores everything a reader can observe. What it does not restore
 * is the row's identity; the rebuilt edge has a new id. Nothing addresses an edge by id across a
 * cut — the rail, the palette, the hotkeys and `app-actions` all resolve by endpoint pair, and
 * `setRelationKind` takes an id only after `findRelation` has just produced one — so the new id is
 * unobservable. A soft delete would preserve it and cost a filtered column serving a list nobody
 * browses.
 *
 * **Written with its caller, which is the thing that was missing.** A returning `disconnectItems`
 * and a `restoreRelation` were written and deleted earlier the same day for being speculative: no
 * caller used either. `rememberUndoableAction` is that caller, and it arrived afterwards — its own
 * docstring names "one day cutting a connection" as the case it was built for. So the reversal is a
 * closure it already knows how to offer rather than a new surface.
 *
 * Read before the write, because afterwards there is nothing left to read.
 */
async function disconnectItems(
  input: Readonly<{ projectId: string; source: string; target: string }>,
) {
  const cut = findRelation(relations$.peek(), input.source, input.target);

  await database.relations.disconnect({ source: input.source, target: input.target });
  await loadRelations(input.projectId);

  if (cut === undefined) {
    return;
  }

  const claim = getRelationLabel(cut);

  rememberUndoableAction({
    // Named by what it said when it said anything, for the reason the removal dialog quotes it:
    // "the connection" is every connection, and the one you just cut is the only one you mean.
    describe: claim === undefined ? "Undo cutting the connection" : `Undo cutting “${claim}”`,
    undo: async () => {
      await connectItems({
        kind: cut.kind as RelationKind,
        projectId: input.projectId,
        source: cut.source,
        target: cut.target,
      });

      if (cut.label === null || cut.label === undefined) {
        return;
      }

      /*
       * The label needs the *new* edge's id, which only exists once the reconnect has landed.
       * `connectItems` reloads before it resolves, so `relations$` already holds the rebuilt edge
       * here — this is a lookup rather than a second round trip.
       */
      const rebuilt = findRelation(relations$.peek(), cut.source, cut.target);

      if (rebuilt !== undefined) {
        await setRelationLabel({
          label: cut.label,
          projectId: input.projectId,
          relationId: rebuilt.id,
        });
      }
    },
  });
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
