-- Canvas addressing. A route names one `canvas_document`, so the runtime needs to read a canvas
-- by id and to answer "which one should a bare `/` open".
--
-- Bootstrap is not repeated here. `fn::open_default_canvas` already creates the project, the
-- welcome note, and the first canvas together, and duplicating that block would give the database
-- two places that decide what a new install contains.

-- Returns an array of zero or one, deliberately: an empty database is the bootstrap signal, not an
-- error, and `FROM ONLY` makes the zero-row case ambiguous at the call site.
-- `updated_at` is projected because SurrealDB requires an ORDER BY idiom to appear in the
-- selection; `CanvasRecord` drops the undeclared key on the way through ArkType.
DEFINE FUNCTION OVERWRITE fn::most_recent_canvas() {
  RETURN SELECT id, title, revision, layout, updated_at
    FROM canvas_document
    WHERE archived_at = NONE
    ORDER BY updated_at DESC
    LIMIT 1;
};

DEFINE FUNCTION OVERWRITE fn::open_canvas($canvas: record<canvas_document>) {
  RETURN SELECT id, title, revision, layout FROM ONLY $canvas;
};

-- The switcher's list. `layout` is deliberately not projected: a list of canvases would otherwise
-- carry every window of every canvas, which is the whole database in a menu.
DEFINE FUNCTION OVERWRITE fn::list_canvases() {
  RETURN SELECT id, title, revision, updated_at
    FROM canvas_document
    WHERE archived_at = NONE
    ORDER BY updated_at DESC;
};

-- `project:default` is referenced rather than bootstrapped. `fn::open_default_canvas` is the one
-- place a new install is created, and reaching this function means the app already opened.
DEFINE FUNCTION OVERWRITE fn::create_canvas($title: string, $layout: object) {
  RETURN CREATE ONLY canvas_document CONTENT {
    project: project:default,
    title: $title,
    layout: $layout
  };
};

DEFINE FUNCTION OVERWRITE fn::rename_canvas($canvas: record<canvas_document>, $title: string) {
  RETURN UPDATE ONLY $canvas SET title = $title;
};

-- Archiving is the reversible half of removal, and every list already filters on `archived_at`,
-- so an archived canvas simply stops being offered without anything being destroyed.
DEFINE FUNCTION OVERWRITE fn::archive_canvas($canvas: record<canvas_document>) {
  RETURN UPDATE ONLY $canvas SET archived_at = time::now();
};

DEFINE FUNCTION OVERWRITE fn::restore_canvas($canvas: record<canvas_document>) {
  RETURN UPDATE ONLY $canvas SET archived_at = NONE;
};

DEFINE FUNCTION OVERWRITE fn::list_archived_canvases() {
  RETURN SELECT id, title, revision, archived_at
    FROM canvas_document
    WHERE archived_at != NONE
    ORDER BY archived_at DESC;
};

-- The copy shares content. A window carries a `content_item` id, so the duplicate shows the same
-- notes rather than forked copies of them — editing one updates both, which is the point of
-- separating layout from content in the first place.
DEFINE FUNCTION OVERWRITE fn::duplicate_canvas($canvas: record<canvas_document>, $title: string) {
  LET $source = SELECT * FROM ONLY $canvas;

  RETURN CREATE ONLY canvas_document CONTENT {
    project: $source.project,
    title: $title,
    layout: $source.layout
  };
};

-- What a permanent removal actually costs, so the confirmation can state it rather than warn
-- vaguely. Windows are lost; the notes they point at are separate records and are not touched.
DEFINE FUNCTION OVERWRITE fn::canvas_removal_summary($canvas: record<canvas_document>) {
  LET $source = SELECT * FROM ONLY $canvas;

  RETURN {
    title: $source.title,
    windows: array::len($source.layout.windows)
  };
};

DEFINE FUNCTION OVERWRITE fn::delete_canvas($canvas: record<canvas_document>) {
  RETURN DELETE ONLY $canvas RETURN BEFORE;
};
