# Portfolio

`board/board.tsx` composes the canvas store, component registry, local persistence, and WebMCP tools.

## Content

```text
content/model.ts       Record schemas
content/initial.ts     Initial content
data/schema.surql     Atomic record edits and initial creation
data/portfolio.ts     SurrealDB calls and result parsing
data/mutations.ts     Query-cache updates after writes
```

The database uses `indxdb://portfolio`. Existing content is retained on open.
`widget.replace` requires the unchanged original as `expected`; conflicts preserve the editor draft.
The visible profile editor and content tools use `changePortfolio`.

## Components and layout

```text
widgets/content.tsx   Record-bound components
widgets/authoring.tsx  Components created from props
board/document.ts     Initial layout and content membership
board/layout.ts       Initial grid settings
board/tools.ts        Component and canvas tools
```

Infinite Canvas owns component contracts, property resolution, edits, windows, and groups.
The board stores its canvas snapshot separately from record content.
Layout saves are debounced. Manual resize disables automatic content-height writes.
Saved layouts retain their grid settings and component overrides.

## Tool entry points

- `portfolio.read`, `widget.catalog`, `widget.read`: discover records.
- `widget.create`, `widget.replace`, `widget.remove`, `widget.move`: edit records.
- `component.catalog`, `component.inspect`: discover components and property origins.
- `component.create`, `component.configure`: create and edit component instances.
- `command.list`, `command.execute`: discover and invoke current canvas commands.
- `board.describe`, `board.place`: inspect groups and place grid members.

Paged reads return `nextOffset`. Use that offset to continue the same read.
Component edits require `expectedRevision` from `component.inspect`.
