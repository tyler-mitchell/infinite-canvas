DEFINE TABLE IF NOT EXISTS project SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS title ON TABLE project
  TYPE string
  ASSERT string::len(string::trim($value)) > 0;
DEFINE FIELD IF NOT EXISTS archived_at ON TABLE project TYPE option<datetime>;
DEFINE FIELD IF NOT EXISTS created_at ON TABLE project
  TYPE datetime
  DEFAULT ALWAYS time::now()
  READONLY;
DEFINE FIELD IF NOT EXISTS updated_at ON TABLE project
  TYPE datetime
  VALUE time::now();

DEFINE TABLE IF NOT EXISTS canvas_document SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS project ON TABLE canvas_document TYPE record<project>;
DEFINE FIELD IF NOT EXISTS title ON TABLE canvas_document
  TYPE string
  ASSERT string::len(string::trim($value)) > 0;
DEFINE FIELD IF NOT EXISTS revision ON TABLE canvas_document
  TYPE int
  DEFAULT 0
  ASSERT $value >= 0;
DEFINE FIELD IF NOT EXISTS layout ON TABLE canvas_document TYPE object FLEXIBLE;
DEFINE FIELD IF NOT EXISTS archived_at ON TABLE canvas_document TYPE option<datetime>;
DEFINE FIELD IF NOT EXISTS created_at ON TABLE canvas_document
  TYPE datetime
  DEFAULT ALWAYS time::now()
  READONLY;
DEFINE FIELD IF NOT EXISTS updated_at ON TABLE canvas_document
  TYPE datetime
  VALUE time::now();
DEFINE INDEX IF NOT EXISTS canvas_document_project
  ON TABLE canvas_document FIELDS project;

DEFINE TABLE IF NOT EXISTS content_item SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS project ON TABLE content_item TYPE record<project>;
DEFINE FIELD IF NOT EXISTS kind ON TABLE content_item
  TYPE string
  ASSERT string::len(string::trim($value)) > 0;
DEFINE FIELD IF NOT EXISTS title ON TABLE content_item
  TYPE string
  ASSERT string::len(string::trim($value)) > 0;
DEFINE FIELD IF NOT EXISTS content ON TABLE content_item TYPE object FLEXIBLE;
DEFINE FIELD IF NOT EXISTS search_text ON TABLE content_item TYPE string DEFAULT "";
DEFINE FIELD IF NOT EXISTS tags ON TABLE content_item TYPE array<string> DEFAULT [];
DEFINE FIELD IF NOT EXISTS revision ON TABLE content_item
  TYPE int
  DEFAULT 0
  ASSERT $value >= 0;
DEFINE FIELD IF NOT EXISTS archived_at ON TABLE content_item TYPE option<datetime>;
DEFINE FIELD IF NOT EXISTS created_at ON TABLE content_item
  TYPE datetime
  DEFAULT ALWAYS time::now()
  READONLY;
DEFINE FIELD IF NOT EXISTS updated_at ON TABLE content_item
  TYPE datetime
  VALUE time::now();
DEFINE INDEX IF NOT EXISTS content_item_project
  ON TABLE content_item FIELDS project;
DEFINE INDEX IF NOT EXISTS content_item_kind
  ON TABLE content_item FIELDS kind;

DEFINE TABLE IF NOT EXISTS relates_to
  TYPE RELATION IN content_item OUT content_item ENFORCED SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS kind ON TABLE relates_to
  TYPE string
  ASSERT string::len(string::trim($value)) > 0;
DEFINE FIELD IF NOT EXISTS label ON TABLE relates_to TYPE option<string>;
DEFINE FIELD IF NOT EXISTS created_at ON TABLE relates_to
  TYPE datetime
  DEFAULT ALWAYS time::now()
  READONLY;
