-- Saved views: a named framing of one canvas.
--
-- Scoped to a `canvas_document` rather than to a project, because the rect is in that canvas's
-- world coordinates and names nothing in another's.
--
-- **A rect, not a camera.** A stored centre and zoom is correct only on the display and pane size
-- it was taken on — restore it on a laptop after saving it on a monitor and the framing is wrong
-- by the ratio of the two. A rect re-fits to whatever viewport it is asked into, which is why
-- every framework entry point on this path (`navigateToRect`, `getFitCamera`) takes one.
--
-- **No `archived_at`, and that is a decision rather than an omission.** Every other table here
-- archives because it holds something a delete would strand: a note carries `relates_to` edges, a
-- canvas carries windows, a project carries both. A view holds a name and four numbers and is
-- referenced by nothing, so restoring one is retyping it — an archive tier would be ceremony
-- around no risk, and a second list to explain in the rail.
DEFINE TABLE IF NOT EXISTS saved_view SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS canvas ON TABLE saved_view TYPE record<canvas_document>;
DEFINE FIELD IF NOT EXISTS title ON TABLE saved_view
  TYPE string
  ASSERT string::len(string::trim($value)) > 0;
DEFINE FIELD IF NOT EXISTS rect ON TABLE saved_view TYPE object;
DEFINE FIELD IF NOT EXISTS rect.x ON TABLE saved_view TYPE number;
DEFINE FIELD IF NOT EXISTS rect.y ON TABLE saved_view TYPE number;
-- Zero-extent rects are refused rather than clamped. `getFitCamera` divides by the extent, so a
-- view saved while the pane was collapsed would not restore as a bad framing — it would restore
-- as an infinite zoom. Refusing at the schema is what keeps that out of every caller.
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
