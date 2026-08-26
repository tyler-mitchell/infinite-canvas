DEFINE FUNCTION OVERWRITE fn::save_canvas(
  $canvas: record<canvas_document>,
  $revision: int,
  $layout: object
) {
  RETURN UPDATE ONLY $canvas
    SET layout = $layout,
        revision += 1
    WHERE revision = $revision;
};

DEFINE FUNCTION OVERWRITE fn::open_default_canvas($layout: object) {
  LET $project = SELECT * FROM ONLY project:default;

  IF $project = NONE {
    CREATE ONLY project:default CONTENT {
      title: "Polkadot"
    };
  };

  -- The canvas seed references this note by id, so it must exist before the layout is stored.
  LET $welcome = SELECT * FROM ONLY content_item:welcome;

  IF $welcome = NONE {
    CREATE ONLY content_item:welcome CONTENT {
      project: project:default,
      kind: "note",
      title: "Welcome",
      content: { text: "" },
      search_text: "welcome"
    };
  };

  LET $canvas = SELECT * FROM ONLY canvas_document:main;

  RETURN IF $canvas = NONE {
    CREATE ONLY canvas_document:main CONTENT {
      project: project:default,
      title: "Main canvas",
      layout: $layout
    }
  } ELSE {
    $canvas
  };
};
