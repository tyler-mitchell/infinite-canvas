-- A saved view stores a canvas-specific rect and has no archive state.
DEFINE TABLE IF NOT EXISTS saved_view SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS canvas ON TABLE saved_view TYPE record<canvas_document>;
DEFINE FIELD IF NOT EXISTS title ON TABLE saved_view
  TYPE string
  ASSERT string::len(string::trim($value)) > 0;
DEFINE FIELD IF NOT EXISTS rect ON TABLE saved_view TYPE object;
DEFINE FIELD IF NOT EXISTS rect.x ON TABLE saved_view TYPE number;
DEFINE FIELD IF NOT EXISTS rect.y ON TABLE saved_view TYPE number;
-- Positive extents prevent an infinite fit zoom.
DEFINE FIELD IF NOT EXISTS rect.width ON TABLE saved_view
  TYPE number
  ASSERT $value > 0;
DEFINE FIELD IF NOT EXISTS rect.height ON TABLE saved_view
  TYPE number
  ASSERT $value > 0;
DEFINE FIELD IF NOT EXISTS created_at ON TABLE saved_view
  TYPE datetime
  DEFAULT ALWAYS time::now()
  READONLY;
DEFINE FIELD IF NOT EXISTS updated_at ON TABLE saved_view
  TYPE datetime
  VALUE time::now();
DEFINE INDEX IF NOT EXISTS saved_view_canvas
  ON TABLE saved_view FIELDS canvas;
