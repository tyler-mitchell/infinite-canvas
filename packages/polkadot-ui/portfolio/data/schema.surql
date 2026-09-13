DEFINE TABLE IF NOT EXISTS portfolio SCHEMALESS;

DEFINE FUNCTION OVERWRITE fn::portfolio_open($record: record<portfolio>, $initial: object) -> object {
    LET $current = SELECT * FROM ONLY $record;
    IF $current.content != NONE {
        RETURN $current;
    };

    RETURN UPSERT ONLY $record CONTENT { content: $initial };
};

DEFINE FUNCTION OVERWRITE fn::portfolio_edit($record: record<portfolio>, $change: object) -> object {
    LET $current = SELECT * FROM ONLY $record;
    IF $current.content = NONE {
        RETURN { error: "The portfolio has not loaded." };
    };
    LET $widgets = $current.content.widgets;
    LET $ids = $widgets.map(|$item| $item.id);

    IF $change.operation = "create" AND $change.widget.id IN $ids {
        RETURN { error: "A widget already has that id." };
    };
    IF $change.operation IN ["replace", "remove", "move"] AND $change.id NOT IN $ids {
        RETURN { error: "No widget has that id." };
    };
    IF $change.operation = "replace" AND $widgets.filter(|$item| $item.id = $change.id)[0] != $change.expected {
        RETURN { error: "This content changed after editing started. Your draft is retained. Reopen the editor to load the current content." };
    };

    LET $next = IF $change.operation = "create" {
        array::append($widgets, $change.widget)
    } ELSE IF $change.operation = "replace" {
        $widgets.map(|$item| IF $item.id = $change.id { $change.widget } ELSE { $item })
    } ELSE IF $change.operation = "remove" {
        $widgets.filter(|$item| $item.id != $change.id)
    } ELSE IF $change.operation = "move" {
        LET $item = $widgets.filter(|$item| $item.id = $change.id)[0];
        LET $rest = $widgets.filter(|$item| $item.id != $change.id);
        array::insert($rest, $item, math::min([$change.position, array::len($rest)]))
    } ELSE {
        RETURN { error: "Unknown portfolio operation." };
    };

    UPDATE ONLY $record SET content.widgets = $next;
    RETURN { content: { widgets: $next } };
};
