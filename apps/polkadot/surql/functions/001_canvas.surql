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
