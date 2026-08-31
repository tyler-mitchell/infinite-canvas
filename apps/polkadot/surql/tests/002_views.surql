-- This test uses two canvases for saved-view scoping.

LET $project = CREATE ONLY project CONTENT {
  title: "Saved views proof"
};

LET $layout = {
  version: 3,
  activeWindowId: NULL,
  activeWorkspaceId: NULL,
  camera: { center: { x: 0, y: 0 }, zoom: 1 },
  groups: [],
  selection: { anchorWindowId: NULL, windowIds: [] },
  windows: [],
  workspaces: []
};

LET $canvas = CREATE ONLY canvas_document CONTENT {
  project: $project.id,
  title: "First canvas",
  layout: $layout
};

LET $other_canvas = CREATE ONLY canvas_document CONTENT {
  project: $project.id,
  title: "Second canvas",
  layout: $layout
};

-- Insertion order differs from title order.
LET $zebra = fn::create_saved_view($canvas.id, "Zebra corner", { x: 100, y: 200, width: 640, height: 480 });
LET $alpha = fn::create_saved_view($canvas.id, "Alpha corner", { x: -50, y: -60, width: 320, height: 240 });
LET $elsewhere = fn::create_saved_view($other_canvas.id, "Only on the second canvas", { x: 0, y: 0, width: 100, height: 100 });

LET $listed = fn::list_saved_views($canvas.id);
IF array::len($listed) != 2 {
  THROW "list_saved_views did not return exactly the views on its own canvas";
};
IF $listed[0].title != "Alpha corner" {
  THROW "list_saved_views is not ordered by title";
};
IF $listed[0].rect.width != 320 OR $listed[0].rect.x != -50 {
  THROW "list_saved_views did not round-trip the stored rect";
};

LET $reframed = fn::reframe_saved_view($alpha.id, { x: 7, y: 8, width: 1024, height: 768 });
IF $reframed.rect.width != 1024 OR $reframed.rect.x != 7 {
  THROW "reframe_saved_view did not replace the rect";
};
IF $reframed.title != "Alpha corner" {
  THROW "reframe_saved_view disturbed the title";
};

LET $renamed = fn::rename_saved_view($alpha.id, "Renamed corner");
IF $renamed.title != "Renamed corner" {
  THROW "rename_saved_view did not change the title";
};
IF $renamed.rect.width != 1024 {
  THROW "rename_saved_view disturbed the rect";
};

LET $ignored = fn::delete_saved_view($zebra.id);
LET $after_delete = fn::list_saved_views($canvas.id);
IF array::len($after_delete) != 1 {
  THROW "delete_saved_view did not remove the view";
};

-- The other canvas must remain unchanged.
LET $other_listed = fn::list_saved_views($other_canvas.id);
IF array::len($other_listed) != 1 OR $other_listed[0].title != "Only on the second canvas" {
  THROW "saved views leaked across canvases";
};

RETURN {
  ordered_first: $listed[0].title,
  reframed_width: $reframed.rect.width,
  renamed_title: $renamed.title,
  remaining_on_canvas: array::len($after_delete),
  remaining_on_other: array::len($other_listed)
};
