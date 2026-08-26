-- Notes are `content_item` records. A window's payload holds only the record id, so the canvas
-- layout stays a layout: moving, docking, or closing a window never touches what was written.

-- The project is passed in, not assumed. This hardcoded `project:default`, so a note created on
-- another project's canvas was filed under the first project and vanished from the canvas it was
-- made on.
DEFINE FUNCTION OVERWRITE fn::create_note($project: record<project>, $title: string, $text: string) {
  RETURN CREATE ONLY content_item CONTENT {
    project: $project,
    kind: "note",
    title: $title,
    content: { text: $text },
    search_text: string::lowercase(string::concat($title, " ", $text))
  };
};

-- Optimistic concurrency, matching `fn::save_canvas`: the write lands only if the caller still
-- holds the revision it read. A stale writer gets NONE rather than silently overwriting.
DEFINE FUNCTION OVERWRITE fn::save_note(
  $note: record<content_item>,
  $revision: int,
  $title: string,
  $text: string
) {
  RETURN UPDATE ONLY $note
    SET title = $title,
        content.text = $text,
        search_text = string::lowercase(string::concat($title, " ", $text)),
        revision += 1
    WHERE revision = $revision;
};

DEFINE FUNCTION OVERWRITE fn::list_notes($project: record<project>) {
  RETURN SELECT id, title, revision, content, updated_at
    FROM content_item
    WHERE project = $project AND kind = "note" AND archived_at = NONE
    ORDER BY updated_at DESC;
};

DEFINE FUNCTION OVERWRITE fn::read_note($note: record<content_item>) {
  RETURN SELECT id, title, revision, content, updated_at FROM ONLY $note;
};
