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

-- What `/` opens when nothing is open yet.
--
-- This was built on three fixed ids — `project:default`, `content_item:welcome`,
-- `canvas_document:main` — which was right while there was one of everything, and wrong twice once
-- projects were real. Archiving your only project did not empty the app: bootstrap handed the
-- archived project straight back and the shell presented it as current. And seeding every new
-- canvas with one fixed note id meant a second project's first canvas showed the first project's
-- note, which `fn::read_note` would happily load because it takes a record id and asks no
-- questions.
--
-- Now it picks something usable and creates only what is missing. The layout it stores is whatever
-- the caller passes; it seeds no content, so no canvas can reference a note belonging to another
-- project.
DEFINE FUNCTION OVERWRITE fn::bootstrap_canvas($layout: object) {
  -- `created_at` and `updated_at` are projected because SurrealDB requires an ORDER BY idiom to
  -- appear in the selection, which also rules out `SELECT VALUE` here.
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
