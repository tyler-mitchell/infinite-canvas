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
