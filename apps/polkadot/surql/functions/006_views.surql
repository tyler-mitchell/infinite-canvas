-- Views include rect data and sort by title.
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

-- Reframe updates the rect without changing the name.
DEFINE FUNCTION OVERWRITE fn::reframe_saved_view($view: record<saved_view>, $rect: object) {
  RETURN UPDATE ONLY $view SET rect = $rect;
};

DEFINE FUNCTION OVERWRITE fn::delete_saved_view($view: record<saved_view>) {
  RETURN DELETE $view;
};
