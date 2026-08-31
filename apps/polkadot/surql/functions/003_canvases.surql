-- This read excludes archived canvases and projects.
DEFINE FUNCTION OVERWRITE fn::most_recent_canvas() {
  RETURN SELECT id, title, revision, layout, updated_at
    FROM canvas_document
    WHERE archived_at = NONE AND project.archived_at = NONE
    ORDER BY updated_at DESC
    LIMIT 1;
};

-- The route reads canvas and project data in one query.
DEFINE FUNCTION OVERWRITE fn::open_canvas($canvas: record<canvas_document>) {
  RETURN SELECT id, title, revision, layout, project.id AS projectId, project.title AS projectTitle
    FROM ONLY $canvas;
};

-- The list omits layout data.
DEFINE FUNCTION OVERWRITE fn::list_canvases($project: record<project>) {
  RETURN SELECT id, title, revision, updated_at
    FROM canvas_document
    WHERE project = $project AND archived_at = NONE
    ORDER BY updated_at DESC;
};

DEFINE FUNCTION OVERWRITE fn::create_canvas($project: record<project>, $title: string, $layout: object) {
  RETURN CREATE ONLY canvas_document CONTENT {
    project: $project,
    title: $title,
    layout: $layout
  };
};

DEFINE FUNCTION OVERWRITE fn::rename_canvas($canvas: record<canvas_document>, $title: string) {
  RETURN UPDATE ONLY $canvas SET title = $title;
};

DEFINE FUNCTION OVERWRITE fn::archive_canvas($canvas: record<canvas_document>) {
  RETURN UPDATE ONLY $canvas SET archived_at = time::now();
};

DEFINE FUNCTION OVERWRITE fn::restore_canvas($canvas: record<canvas_document>) {
  RETURN UPDATE ONLY $canvas SET archived_at = NONE;
};

DEFINE FUNCTION OVERWRITE fn::list_archived_canvases($project: record<project>) {
  RETURN SELECT id, title, revision, archived_at
    FROM canvas_document
    WHERE project = $project AND archived_at != NONE
    ORDER BY archived_at DESC;
};

-- A copy reuses content-item ids and duplicates only the layout.
DEFINE FUNCTION OVERWRITE fn::duplicate_canvas($canvas: record<canvas_document>, $title: string) {
  LET $source = SELECT * FROM ONLY $canvas;

  RETURN CREATE ONLY canvas_document CONTENT {
    project: $source.project,
    title: $title,
    layout: $source.layout
  };
};

-- Deleting a canvas preserves its content items.
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
