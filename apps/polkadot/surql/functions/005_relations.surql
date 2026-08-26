-- Typed edges between notes. `relates_to` has been in the schema since the first migration —
-- `TYPE RELATION IN content_item OUT content_item ENFORCED` — and nothing has ever written one.

-- `in` and `out` are projected under friendlier names; they are SurrealQL's edge endpoints, not a
-- vocabulary the application should have to speak.
DEFINE FUNCTION OVERWRITE fn::list_relations($project: record<project>) {
  RETURN SELECT id, in AS source, out AS target, kind, label
    FROM relates_to
    WHERE in.project = $project;
};

-- Idempotent, and undirected — which it was not, and the difference was a duplicate edge.
--
-- This checked only `in = $source AND out = $target`, so connecting A to B and then B to A stored
-- two edges between the same pair. Every other part of the system already treats an edge as
-- undirected: `unrelate_notes` deletes it whichever way round it was drawn, `findRelation` finds it
-- either way, and the rail counts a neighbour once regardless of direction. Only the guard against
-- creating one had a direction, so the one operation that could produce the inconsistency was the
-- one that did not check for it.
--
-- The user never chose a direction. They dragged from one note to another, and which end the drag
-- started at is an accident of where their pointer was — not a second, different relationship.
--
-- Reproduced before fixing: connect A→B, connect B→A, and `list_relations` returned two rows for
-- the same pair. Both then drew, one on top of the other, and cutting removed both at once because
-- `unrelate_notes` was already undirected — so the second edge was invisible until something
-- counted.
DEFINE FUNCTION OVERWRITE fn::relate_notes(
  $source: record<content_item>,
  $target: record<content_item>,
  $kind: string
) {
  LET $existing = SELECT id FROM relates_to
    WHERE (in = $source AND out = $target)
       OR (in = $target AND out = $source);

  IF array::len($existing) > 0 {
    RETURN $existing[0];
  };

  RETURN RELATE ONLY $source->relates_to->$target CONTENT { kind: $kind };
};

-- What an edge means. `kind` has been a required field since the first migration and every writer
-- passed the literal "relates", so the column existed and said nothing.
--
-- Directed by id rather than by endpoints, unlike unrelate below: the caller has selected a
-- specific edge on the canvas, so there is nothing to resolve and no second edge to catch.
DEFINE FUNCTION OVERWRITE fn::set_relation_kind($relation: record<relates_to>, $kind: string) {
  RETURN UPDATE ONLY $relation SET kind = $kind;
};

-- A sentence where the five verbs do not fit. `label` is `option<string>`, so NONE is how an edge
-- goes back to saying only what its kind says — the field has to be clearable, not just settable.
DEFINE FUNCTION OVERWRITE fn::set_relation_label(
  $relation: record<relates_to>,
  $label: option<string>
) {
  RETURN UPDATE ONLY $relation SET label = $label;
};

-- Undirected from the user's point of view: they connected two notes, so disconnecting removes
-- the edge whichever way round it was drawn.
DEFINE FUNCTION OVERWRITE fn::unrelate_notes(
  $source: record<content_item>,
  $target: record<content_item>
) {
  RETURN DELETE relates_to
    WHERE (in = $source AND out = $target)
       OR (in = $target AND out = $source);
};
