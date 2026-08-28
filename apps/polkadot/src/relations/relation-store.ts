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
const loadedProject = { answered: false, id: null as string | null };

/**
 * The edges, or `null` while nobody has answered for this project yet.
 *
 * `relations$` holds `[]` both before the first query lands and when a project genuinely has no
 * connections, and the docstring below argues that is honest — which it is for a reader that
 * *draws*: a connector layer showing nothing for a moment is briefly incomplete, and the next frame
 * corrects it.
 *
 * It stops being honest at the moment something turns that array into a sentence.
 * `describeProjectContent` says "No connections." to a caller that cannot see the screen and has no
 * next frame to correct it — the same collapse `project-content` refuses when it keeps "nobody has
 * asked yet" apart from "there are none". An agent calling `content.list` straight after
 * `project.open` is inside that window: `loadRelations` runs from an effect and nothing awaits it.
 *
 * So this is for readers that report. The eleven that draw or resolve a click keep reading
 * `relations$` directly, because for them the interim empty is the right answer rather than a lie.
 */
const getLoadedRelations = (projectId: string): readonly ContentRelation[] | null =>
  loadedProject.id === projectId && loadedProject.answered ? relations$.peek() : null;

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
    // Unanswered until this query lands, which is the fact `getLoadedRelations` reports and the
    // empty array cannot: `[]` is both "not yet" and "none".
    loadedProject.answered = false;
    relations$.set([]);
  }

  const loaded = await database.relations.list(projectId);

  // Another navigation may have overtaken this query. Landing now would put the project we just
  // left back on screen — the defect this function exists to close, arriving by a slower route.
  if (loadedProject.id === projectId) {
    loadedProject.answered = true;
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
 * What the undo row says for a cut.
 *
 * A single edge is named by what it claimed, for the reason the removal dialog quotes it: "the
 * connection" is every connection, and the one just cut is the only one meant. Several are named by
 * how many, because a row listing three sentences is a paragraph.
 */
const describeCut = (cuts: readonly ContentRelation[]) => {
  const [only] = cuts;

  if (only === undefined) {
    return "";
  }

  if (cuts.length > 1) {
    return `Undo cutting ${cuts.length} connections`;
  }

  const claim = getRelationLabel(only);

  return claim === undefined ? "Undo cutting the connection" : `Undo cutting “${claim}”`;
};

/**
 * Cut a set of connections as one act, offering one undo that restores all of them.
 *
 * The undo slot holds one entry. Cutting in a loop overwrote it per edge, so a multi-edge cut
 * offered to restore the last one and the rest went silently — the failure `edge-destruction-sites`
 * exists to catch. Every caller that can cut more than one edge comes here.
 *
 * Restored by rebuilding rather than un-deleting: an edge is its two ends, its kind and its label,
 * so reconnecting with all four gives back everything a reader can observe. The rebuilt edge has a
 * new id, and nothing addresses an edge by id across a cut.
 *
 * Read before the write, because afterwards there is nothing left to read.
 */
async function disconnectRelations(
  input: Readonly<{ projectId: string; relations: readonly ContentRelation[] }>,
) {
  const cuts = input.relations;

  if (cuts.length === 0) {
    return;
  }

  await Promise.all(
    cuts.map((cut) => database.relations.disconnect({ source: cut.source, target: cut.target })),
  );
  await loadRelations(input.projectId);

  rememberUndoableAction({
    describe: describeCut(cuts),
    undo: async () => {
      await Promise.all(
        cuts.map((cut) =>
          database.relations.connect({
            kind: (cut.kind as RelationKind | undefined) ?? DEFAULT_RELATION_KIND,
            source: cut.source,
            target: cut.target,
          }),
        ),
      );
      // Labels need the rebuilt edges' ids, which exist only once the reconnects have landed.
      await loadRelations(input.projectId);

      const rebuilt = relations$.peek();

      await Promise.all(
        cuts.flatMap((cut) => {
          const edge =
            cut.label === null || cut.label === undefined
              ? undefined
              : findRelation(rebuilt, cut.source, cut.target);

          return edge === undefined || cut.label == null
            ? []
            : [database.relations.setLabel({ label: cut.label, relationId: edge.id })];
        }),
      );
      await loadRelations(input.projectId);
    },
  });
}

/**
 * Cut the connection between two items, whichever way round it was stored.
 *
 * Resolves the pair to an edge so the cut goes through `disconnectRelations` and carries the same
 * undo. A pair the held list does not know about is still cut, in case the list is behind.
 */
async function disconnectItems(
  input: Readonly<{ projectId: string; source: string; target: string }>,
) {
  const cut = findRelation(relations$.peek(), input.source, input.target);

  if (cut !== undefined) {
    await disconnectRelations({ projectId: input.projectId, relations: [cut] });
    return;
  }

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
  describeCut,
  disconnectItems,
  disconnectRelations,
  findRelation,
  getLoadedRelations,
  getRelationLabel,
  loadRelations,
  RELATION_KINDS,
  relations$,
  setRelationKind,
  setRelationLabel,
};
export type { RelationKind };
