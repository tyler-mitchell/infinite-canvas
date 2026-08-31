DEFINE FUNCTION OVERWRITE fn::save_canvas(
  $canvas: record<canvas_document>,
  $revision: int,
  $layout: object
) {
  RETURN UPDATE ONLY $canvas
    SET layout = $layout,
        revision += 1
    WHERE revision = $revision;
};

-- Bootstrap creates only missing active project and canvas records.
DEFINE FUNCTION OVERWRITE fn::bootstrap_canvas($layout: object) {
  -- SurrealDB requires an ordered field in the selection.
  LET $existing = SELECT id, created_at FROM ONLY project
    WHERE archived_at = NONE
    ORDER BY created_at
    LIMIT 1;

  LET $project = IF $existing = NONE {
    (CREATE ONLY project CONTENT { title: "Polkadot" }).id
  } ELSE {
    $existing.id
  };

  LET $canvas = SELECT id, updated_at FROM ONLY canvas_document
    WHERE project = $project AND archived_at = NONE
    ORDER BY updated_at DESC
    LIMIT 1;

  LET $target = IF $canvas = NONE {
    (CREATE ONLY canvas_document CONTENT {
      project: $project,
      title: "Main canvas",
      layout: $layout
    }).id
  } ELSE {
    $canvas.id
  };

  RETURN { id: $target };
};
