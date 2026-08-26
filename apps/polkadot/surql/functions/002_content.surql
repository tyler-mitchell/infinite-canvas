-- Content items: everything a window can be bound to.
--
-- A window's payload holds only a record id, so the canvas layout stays a layout — moving, docking,
-- or closing a window never touches what it shows.
--
-- These functions were `fn::create_note`, `fn::save_note`, and so on, which named the domain
-- narrower than the schema ever did: there has never been a `note` table. A note is a
-- `content_item` with `kind = "note"`, `relates_to` already joins any content item to any other,
-- and `content` has always been FLEXIBLE. The second kind of thing on the canvas would have had to
-- either copy all seven functions or use these, and a copy per kind is a copy per kind forever.
--
-- `$kind` is a parameter where it distinguishes anything and absent where it does not: reading,
-- archiving, and restoring take a record id and were already kind-agnostic in everything but name.

-- `$search_text` is supplied rather than derived, and that is the one thing this file gives up by
-- being generic. A note is searchable by its title and its prose, an image by its title and its
-- description; the shapes have no field in common, so there is no expression here that could find
-- the words. The kind knows, and the kind passes them in. Lowercasing stays here so every caller
-- cannot forget it.
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

-- Optimistic concurrency, matching `fn::save_canvas`: the write lands only if the caller still
-- holds the revision it read. A stale writer gets NONE rather than silently overwriting.
--
-- `content` is replaced wholesale rather than field by field. The old note version set
-- `content.text`, which only worked because it knew there was a `text`; a function that takes an
-- arbitrary content object cannot reach inside it, and should not — the kind hands over the whole
-- shape it means to store.
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

DEFINE FUNCTION OVERWRITE fn::list_content_items($project: record<project>, $kind: string) {
  RETURN SELECT id, kind, title, revision, content, updated_at
    FROM content_item
    WHERE project = $project AND kind = $kind AND archived_at = NONE
    ORDER BY updated_at DESC;
};

DEFINE FUNCTION OVERWRITE fn::read_content_item($item: record<content_item>) {
  RETURN SELECT id, kind, title, revision, content, updated_at FROM ONLY $item;
};

-- Whatever an item is connected to, of any kind, in either direction.
--
-- Undirected, matching every other reader of `relates_to`: `fn::unrelate_content_items` deletes an
-- edge whichever way round it was drawn and `findRelation` finds it either way, because the user
-- who dragged from one window to another did not choose a direction — which end the drag started
-- at is an accident of where the pointer was.
--
-- Both halves are subqueries rather than a `LET`, so this stays one statement. The rule that
-- matters is at the call site — SurrealDB answers with one result per statement, so a caller
-- destructuring `[record]` off a `LET`-then-`RETURN` reads the `LET` — and a single expression here
-- means no caller can get that wrong.
--
-- No project filter, deliberately: an edge already implies both ends are in one project, since
-- `relates_to` is only ever written between two items of the same one. Filtering again would be
-- restating an invariant the graph already holds.
DEFINE FUNCTION OVERWRITE fn::list_related_content_items($item: record<content_item>) {
  RETURN SELECT id, kind, title, revision, content, updated_at
    FROM content_item
    WHERE archived_at = NONE
      AND (id IN (SELECT VALUE out FROM relates_to WHERE in = $item)
        OR id IN (SELECT VALUE in FROM relates_to WHERE out = $item))
    ORDER BY updated_at DESC;
};

-- Archiving is the reversible half of removal, exactly as it is for canvases and projects, and the
-- listing functions have filtered on `archived_at` since the schema was written — so an archived
-- item simply stops being offered without anything being destroyed.
--
-- Reversible is not a softer choice here, it is the correct one: a content item carries
-- `relates_to` edges, and deleting it would have to take them with it or leave the graph pointing
-- at nothing. Archiving leaves both the item and its edges intact, so restoring puts back
-- everything that was there — which a cascade delete could never promise.
DEFINE FUNCTION OVERWRITE fn::archive_content_item($item: record<content_item>) {
  RETURN UPDATE ONLY $item SET archived_at = time::now();
};

DEFINE FUNCTION OVERWRITE fn::restore_content_item($item: record<content_item>) {
  RETURN UPDATE ONLY $item SET archived_at = NONE;
};

DEFINE FUNCTION OVERWRITE fn::list_archived_content_items($project: record<project>, $kind: string) {
  RETURN SELECT id, kind, title, revision, content, archived_at
    FROM content_item
    WHERE project = $project AND kind = $kind AND archived_at != NONE
    ORDER BY archived_at DESC;
};
