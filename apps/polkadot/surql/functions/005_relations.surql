-- Relations join all content kinds and expose source and target endpoint names.
DEFINE FUNCTION OVERWRITE fn::list_relations($project: record<project>) {
  RETURN SELECT id, in AS source, out AS target, kind, label
    FROM relates_to
    WHERE in.project = $project;
};

-- Relation identity is undirected and idempotent.
DEFINE FUNCTION OVERWRITE fn::relate_content_items(
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

-- A selected relation updates by id.
DEFINE FUNCTION OVERWRITE fn::set_relation_kind($relation: record<relates_to>, $kind: string) {
  RETURN UPDATE ONLY $relation SET kind = $kind;
};

-- NONE clears the custom label.
DEFINE FUNCTION OVERWRITE fn::set_relation_label(
  $relation: record<relates_to>,
  $label: option<string>
) {
  RETURN UPDATE ONLY $relation SET label = $label;
};

-- Removal matches either endpoint order.
DEFINE FUNCTION OVERWRITE fn::unrelate_content_items(
  $pairs: array<array<record<content_item>>>
) {
  RETURN DELETE relates_to
    WHERE [in, out] IN $pairs OR [out, in] IN $pairs;
};
