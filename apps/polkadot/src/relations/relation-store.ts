import { observable } from "@legendapp/state";

import { rememberUndoableAction } from "../content/undoable-action";
import type { ContentRelation } from "../database/database.client";
import * as database from "../database/operations";

const relations$ = observable<readonly ContentRelation[]>([]);

// The default relation kind has no visible label.
const RELATION_KINDS = ["relates", "supports", "contradicts", "refines", "follows"] as const;

type RelationKind = (typeof RELATION_KINDS)[number];

const DEFAULT_RELATION_KIND: RelationKind = "relates";

// A custom label overrides the relation kind. The default kind stays unlabeled.
const getRelationLabel = (relation: ContentRelation) =>
  relation.label?.trim() || (relation.kind === DEFAULT_RELATION_KIND ? undefined : relation.kind);

// Track which project owns the current relation list.
const loadedProject = { answered: false, id: null as string | null };

// null means that no relation query has returned for this project.
const getLoadedRelations = (projectId: string): readonly ContentRelation[] | null =>
  loadedProject.id === projectId && loadedProject.answered ? relations$.peek() : null;

// Clear relations when the project changes and ignore late results.
async function loadRelations(projectId: string) {
  if (loadedProject.id !== projectId) {
    loadedProject.id = projectId;
    loadedProject.answered = false;
    relations$.set([]);
  }

  const loaded = await database.relations.list(projectId);

  if (loadedProject.id === projectId) {
    loadedProject.answered = true;
    relations$.set(loaded);
  }
}

// An omitted kind uses the default relation kind.
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

async function setRelationKind(
  input: Readonly<{ kind: RelationKind; projectId: string; relationId: string }>,
) {
  await database.relations.setKind({ kind: input.kind, relationId: input.relationId });
  await loadRelations(input.projectId);
}

// Blank text clears the custom label.
async function setRelationLabel(
  input: Readonly<{ label: string; projectId: string; relationId: string }>,
) {
  await database.relations.setLabel({
    label: input.label.trim() === "" ? null : input.label.trim(),
    relationId: input.relationId,
  });
  await loadRelations(input.projectId);
}

// One cut names its claim. Multiple cuts use a count.
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

// One undo action restores the complete set of removed relations.
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
      // Reconnects must finish before labels can use the new relation ids.
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

// Resolve the stored direction before the shared removal path.
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

// Relations are undirected.
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
