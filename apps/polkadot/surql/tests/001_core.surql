LET $project = CREATE ONLY project CONTENT {
  title: "Polkadot proof"
};

LET $canvas = CREATE ONLY canvas_document CONTENT {
  project: $project.id,
  title: "Main canvas",
  layout: {
    version: 3,
    activeWindowId: NULL,
    activeWorkspaceId: NULL,
    camera: { center: { x: 0, y: 0 }, zoom: 1 },
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
LET $default_canvas = fn::open_default_canvas($canvas.layout);

RETURN {
  canvas_revision: $saved.revision,
  default_canvas: $default_canvas.id,
  relation_kind: $relation.kind,
  stale_rejected: $stale = NONE
};
