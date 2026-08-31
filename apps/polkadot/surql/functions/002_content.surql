-- Content items separate layout and use kind-specific search text.
DEFINE FUNCTION OVERWRITE fn::create_content_item(
  $project: record<project>,
  $kind: string,
  $title: string,
  $content: object,
  $search_text: string
) {
  RETURN CREATE ONLY content_item CONTENT {
    project: $project,
    kind: $kind,
    title: $title,
    content: $content,
    search_text: string::lowercase($search_text)
  };
};

-- Revision guards stale writes. Content replaces the complete object.
DEFINE FUNCTION OVERWRITE fn::save_content_item(
  $item: record<content_item>,
  $revision: int,
  $title: string,
  $content: object,
  $search_text: string
) {
  RETURN UPDATE ONLY $item
    SET title = $title,
        content = $content,
        search_text = string::lowercase($search_text),
        revision += 1
    WHERE revision = $revision;
};

-- NONE lists every content kind.
DEFINE FUNCTION OVERWRITE fn::list_content_items($project: record<project>, $kind: option<string>) {
  RETURN SELECT id, kind, title, revision, content, updated_at
    FROM content_item
    WHERE project = $project
      AND ($kind = NONE OR kind = $kind)
      AND archived_at = NONE
    ORDER BY updated_at DESC;
};

DEFINE FUNCTION OVERWRITE fn::read_content_item($item: record<content_item>) {
  RETURN SELECT id, kind, title, revision, content, updated_at FROM ONLY $item;
};

-- Relations are undirected.
DEFINE FUNCTION OVERWRITE fn::list_related_content_items($item: record<content_item>) {
  RETURN SELECT id, kind, title, revision, content, updated_at
    FROM content_item
    WHERE archived_at = NONE
      AND (id IN (SELECT VALUE out FROM relates_to WHERE in = $item)
        OR id IN (SELECT VALUE in FROM relates_to WHERE out = $item))
    ORDER BY updated_at DESC;
};

-- Archive preserves the item and its relations.
DEFINE FUNCTION OVERWRITE fn::archive_content_item($item: record<content_item>) {
  RETURN UPDATE ONLY $item SET archived_at = time::now();
};

DEFINE FUNCTION OVERWRITE fn::restore_content_item($item: record<content_item>) {
  RETURN UPDATE ONLY $item SET archived_at = NONE;
};

DEFINE FUNCTION OVERWRITE fn::list_archived_content_items(
  $project: record<project>,
  $kind: option<string>
) {
  RETURN SELECT id, kind, title, revision, content, archived_at
    FROM content_item
    WHERE project = $project
      AND ($kind = NONE OR kind = $kind)
      AND archived_at != NONE
    ORDER BY archived_at DESC;
};
