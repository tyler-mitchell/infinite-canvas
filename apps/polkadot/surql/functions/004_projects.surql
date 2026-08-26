-- Projects. The schema has modelled them since the first migration — `project` is a table and
-- both `canvas_document` and `content_item` carry an indexed link to it — while the application
-- pretended there was exactly one. These functions are the app catching up.

DEFINE FUNCTION OVERWRITE fn::list_projects() {
  RETURN SELECT id, title, updated_at
    FROM project
    WHERE archived_at = NONE
    ORDER BY updated_at DESC;
};

DEFINE FUNCTION OVERWRITE fn::read_project($project: record<project>) {
  RETURN SELECT id, title FROM ONLY $project;
};

-- A project is created with its first canvas, because an empty project has nowhere to route: the
-- app addresses a canvas, never a project, so a project with no canvas would be unreachable the
-- moment it was made.
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

-- What removing a project actually destroys. Unlike a canvas — which is an arrangement whose
-- notes outlive it — a project owns its content outright, so this is the one place in the app
-- where writing is genuinely lost and the confirmation has to say so with real numbers.
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

-- The cascade, in dependency order. Edges first: `relates_to` is an ENFORCED relation between
-- `content_item` records, so deleting the vertices while their edges remain would leave the graph
-- pointing at records that no longer exist. Nothing writes those edges yet — mentions will — and
-- a cascade that is only correct until a feature lands is not correct.
DEFINE FUNCTION OVERWRITE fn::delete_project($project: record<project>) {
  DELETE relates_to WHERE in.project = $project OR out.project = $project;
  DELETE content_item WHERE project = $project;
  DELETE canvas_document WHERE project = $project;

  RETURN DELETE ONLY $project RETURN BEFORE;
};
