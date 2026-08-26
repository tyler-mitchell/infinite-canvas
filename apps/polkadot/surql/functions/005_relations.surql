-- Typed edges between notes. `relates_to` has been in the schema since the first migration —
-- `TYPE RELATION IN content_item OUT content_item ENFORCED` — and nothing has ever written one.

-- `in` and `out` are projected under friendlier names; they are SurrealQL's edge endpoints, not a
-- vocabulary the application should have to speak.
DEFINE FUNCTION OVERWRITE fn::list_relations($project: record<project>) {
  RETURN SELECT id, in AS source, out AS target, kind
    FROM relates_to
    WHERE in.project = $project;
};

-- Idempotent: relating twice is the same statement the user already made, and a duplicate edge
-- would draw a second line on top of the first.
DEFINE FUNCTION OVERWRITE fn::relate_notes(
  $source: record<content_item>,
  $target: record<content_item>,
  $kind: string
) {
  LET $existing = SELECT id FROM relates_to WHERE in = $source AND out = $target;

  IF array::len($existing) > 0 {
    RETURN $existing[0];
  };

  RETURN RELATE ONLY $source->relates_to->$target CONTENT { kind: $kind };
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
