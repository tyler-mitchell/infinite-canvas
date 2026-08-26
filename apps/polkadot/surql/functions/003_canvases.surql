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
