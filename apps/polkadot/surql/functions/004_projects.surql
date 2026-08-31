DEFINE FUNCTION OVERWRITE fn::list_projects() {
  RETURN SELECT id, title, updated_at
    FROM project
    WHERE archived_at = NONE
    ORDER BY updated_at DESC;
};

DEFINE FUNCTION OVERWRITE fn::read_project($project: record<project>) {
  RETURN SELECT id, title FROM ONLY $project;
};

-- A project starts with one canvas because routes identify canvases.
DEFINE FUNCTION OVERWRITE fn::create_project($title: string, $layout: object) {
  LET $project = CREATE ONLY project CONTENT { title: $title };

  RETURN CREATE ONLY canvas_document CONTENT {
    project: $project.id,
    title: "Main canvas",
    layout: $layout
  };
};

DEFINE FUNCTION OVERWRITE fn::rename_project($project: record<project>, $title: string) {
  RETURN UPDATE ONLY $project SET title = $title;
};

DEFINE FUNCTION OVERWRITE fn::archive_project($project: record<project>) {
  RETURN UPDATE ONLY $project SET archived_at = time::now();
};

DEFINE FUNCTION OVERWRITE fn::restore_project($project: record<project>) {
  RETURN UPDATE ONLY $project SET archived_at = NONE;
};

DEFINE FUNCTION OVERWRITE fn::list_archived_projects() {
  RETURN SELECT id, title, archived_at
    FROM project
    WHERE archived_at != NONE
    ORDER BY archived_at DESC;
};

-- Deleting a project also deletes its canvases and content.
DEFINE FUNCTION OVERWRITE fn::project_removal_summary($project: record<project>) {
  LET $source = SELECT * FROM ONLY $project;
  LET $canvases = SELECT id FROM canvas_document WHERE project = $project;
  LET $notes = SELECT id FROM content_item WHERE project = $project;

  RETURN {
    canvases: array::len($canvases),
    notes: array::len($notes),
    title: $source.title
  };
};

-- Delete relations before their content-item endpoints.
DEFINE FUNCTION OVERWRITE fn::delete_project($project: record<project>) {
  DELETE relates_to WHERE in.project = $project OR out.project = $project;
  DELETE content_item WHERE project = $project;
  DELETE canvas_document WHERE project = $project;

  RETURN DELETE ONLY $project RETURN BEFORE;
};
