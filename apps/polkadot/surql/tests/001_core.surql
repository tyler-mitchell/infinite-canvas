LET $project = CREATE ONLY project CONTENT {
  title: "Polkadot proof"
};

LET $canvas = CREATE ONLY canvas_document CONTENT {
  project: $project.id,
  title: "Main canvas",
  layout: {
    version: 4,
    activeWindowId: NULL,
    activeWorkspaceId: NULL,
    camera: { center: { x: 0, y: 0 }, zoom: 1 },
    connections: [],
    groups: [],
    selection: { anchorWindowId: NULL, windowIds: [] },
    windows: [],
    workspaces: []
  }
};

LET $saved = fn::save_canvas($canvas.id, 0, $canvas.layout);
IF $saved.revision != 1 {
  THROW "save_canvas did not advance the expected revision";
};

LET $stale = fn::save_canvas($canvas.id, 0, $canvas.layout);
IF $stale != NONE {
  THROW "save_canvas accepted a stale revision";
};

LET $note = CREATE ONLY content_item CONTENT {
  project: $project.id,
  kind: "note",
  title: "Product thesis",
  content: { text: "Polkadot is a local-first spatial desktop." },
  search_text: "Polkadot local-first spatial desktop"
};

LET $source = CREATE ONLY content_item CONTENT {
  project: $project.id,
  kind: "bookmark",
  title: "Infinite canvas architecture",
  content: { url: "https://example.com/infinite-canvas" },
  search_text: "Infinite canvas architecture"
};

LET $note_id = $note.id;
LET $source_id = $source.id;
LET $relation = RELATE ONLY $note_id->relates_to->$source_id CONTENT {
  kind: "cites",
  label: "supports"
};
LET $other = CREATE ONLY content_item CONTENT {
  project: $project.id,
  kind: "note",
  title: "Other note",
  content: { text: "Keep the unrelated connection." }
};
LET $kept = fn::relate_content_items($note.id, $other.id, "relates");
LET $reused = fn::relate_content_items($other.id, $note.id, "supports");
IF $reused.id != $kept.id {
  THROW "reconnecting a relation changed its identity";
};
fn::relate_content_items($source.id, $other.id, "supports");
fn::unrelate_content_items([[$source.id, $note.id], [$source.id, $other.id]]);
LET $remaining = fn::list_relations($project.id);
IF array::len($remaining) != 1 OR $remaining[0].id != $kept.id {
  THROW "batch removal changed the wrong relations";
};
fn::unrelate_content_items([]);
IF array::len(fn::list_relations($project.id)) != 1 {
  THROW "an empty removal changed relations";
};

RETURN {
  canvas_revision: $saved.revision,
  remaining_relations: $remaining,
  relation_kind: $relation.kind,
  stale_rejected: $stale = NONE
};
