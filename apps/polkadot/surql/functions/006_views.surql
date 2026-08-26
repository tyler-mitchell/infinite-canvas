-- Saved views. The same four verbs every named thing in this database already has — list, create,
-- rename, remove — plus one this kind needs and the others do not.
--
-- `rect` is projected on the way out because it is the whole point of the record; unlike `layout`
-- on a canvas, four numbers in a list are not the database in a menu.
--
-- Ordered by title rather than by recency, which is the opposite of `list_notes` and deliberate.
-- Notes sort by `updated_at` because the one you touched last is usually the one you want next.
-- A bookmark list is something you learn the shape of, and a list that reorders itself under you
-- cannot be learned — the view you used most would keep moving to the top and taking the position
-- your hand had memorised.
DEFINE FUNCTION OVERWRITE fn::list_saved_views($canvas: record<canvas_document>) {
  RETURN SELECT id, title, rect
    FROM saved_view
    WHERE canvas = $canvas
    ORDER BY title ASC;
};

DEFINE FUNCTION OVERWRITE fn::create_saved_view(
  $canvas: record<canvas_document>,
  $title: string,
  $rect: object
) {
  RETURN CREATE ONLY saved_view CONTENT {
    canvas: $canvas,
    title: $title,
    rect: $rect
  };
};

DEFINE FUNCTION OVERWRITE fn::rename_saved_view($view: record<saved_view>, $title: string) {
  RETURN UPDATE ONLY $view SET title = $title;
};

-- Re-aim an existing view at where the camera is now.
--
-- The verb the other tables have no equivalent of, and the one that makes a bookmark honest. A
-- framing goes stale the moment the thing it points at is moved or grows, and without this the
-- only repair is delete-and-recreate — which loses the name, and with it every place the name was
-- the thing being remembered.
DEFINE FUNCTION OVERWRITE fn::reframe_saved_view($view: record<saved_view>, $rect: object) {
  RETURN UPDATE ONLY $view SET rect = $rect;
};

DEFINE FUNCTION OVERWRITE fn::delete_saved_view($view: record<saved_view>) {
  RETURN DELETE $view;
};
