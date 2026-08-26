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

-- Archiving is the reversible half of removal, exactly as it is for canvases and projects, and
-- `fn::list_notes` has filtered on `archived_at` since the schema was written — so an archived note
-- simply stops being offered without anything being destroyed.
--
-- Reversible is not a softer choice here, it is the correct one: a note carries `relates_to` edges,
-- and deleting it would have to take them with it or leave the graph pointing at nothing. Archiving
-- leaves both the note and its edges intact, so restoring puts back everything that was there —
-- which a cascade delete could never promise.
DEFINE FUNCTION OVERWRITE fn::archive_note($note: record<content_item>) {
  RETURN UPDATE ONLY $note SET archived_at = time::now();
};

DEFINE FUNCTION OVERWRITE fn::restore_note($note: record<content_item>) {
  RETURN UPDATE ONLY $note SET archived_at = NONE;
};

DEFINE FUNCTION OVERWRITE fn::list_archived_notes($project: record<project>) {
  RETURN SELECT id, title, revision, content, archived_at
    FROM content_item
    WHERE project = $project AND kind = "note" AND archived_at != NONE
    ORDER BY archived_at DESC;
};
