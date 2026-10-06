# Portfolio

Objective: a portfolio is a board on the framework's DOM plane, owned by a person who signs in with
GitHub, whose content and arrangement an agent can author through WebMCP and that persists in
SurrealDB. It incubates in `packages/polkadot-ui/portfolio` (owner decision 2026-09-12) and moves
to its own app unchanged. Nothing in it names polkadot.

Status: spine written 2026-09-12; nothing below is verified live yet. Sign-in and the cloud
endpoint are named where they land and not built.

## Implementation map

| Build need | Owner | Status |
| --- | --- | --- |
| A tenant | `portfolio` table: owner (GitHub login), title, settings, board, revision | target |
| Authored content | `entry` table: portfolio, kind, title, content (flexible), position, revision | target |
| Arrangement | the framework's serialized state, saved on `portfolio.board` with a revision guard | target |
| Engine today | `local-database`: SurrealDB WASM at `indxdb://portfolio`, SurQL installed on open | typechecked |
| Engine later | the same `surrealdb` client against SurrealDB Cloud; `open()` is the only seam | target |
| Sign-in | GitHub OAuth resolving to `portfolio.owner`; record access on `portfolio` and `entry` | not built |
| Reads | React Query `queryOptions` per entry kind, placeholders from the design's defaults | target |
| Agent authoring | WebMCP tools through `model-context`: describe, list, create, save, archive, arrange | target |
| Widgets | one renderer per entry kind; a window per entry, or one window over a kind | target |

## The tables

```sql
-- packages/polkadot-ui/portfolio/surql/schema/001_portfolio.surql — target
DEFINE TABLE IF NOT EXISTS portfolio SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS owner ON TABLE portfolio TYPE string;       -- GitHub login
DEFINE FIELD IF NOT EXISTS title ON TABLE portfolio TYPE string;
DEFINE FIELD IF NOT EXISTS settings ON TABLE portfolio TYPE object FLEXIBLE DEFAULT {};
DEFINE FIELD IF NOT EXISTS board ON TABLE portfolio TYPE option<object> FLEXIBLE;  -- serialized canvas state
DEFINE FIELD IF NOT EXISTS revision ON TABLE portfolio TYPE int DEFAULT 0;

DEFINE TABLE IF NOT EXISTS entry SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS portfolio ON TABLE entry TYPE record<portfolio>;
DEFINE FIELD IF NOT EXISTS kind ON TABLE entry TYPE string;            -- repo, writing, skill, ...
DEFINE FIELD IF NOT EXISTS title ON TABLE entry TYPE string;
DEFINE FIELD IF NOT EXISTS content ON TABLE entry TYPE object FLEXIBLE; -- the kind's own shape
DEFINE FIELD IF NOT EXISTS position ON TABLE entry TYPE int DEFAULT 0;  -- order inside its kind
DEFINE FIELD IF NOT EXISTS revision ON TABLE entry TYPE int DEFAULT 0;
DEFINE FIELD IF NOT EXISTS archived_at ON TABLE entry TYPE option<datetime>;
```

`content` is flexible in the database and typed at the boundary: each kind has one ArkType schema
in `portfolio/content/schema.ts`, and the same schema validates what an agent sends and what the
database returns. An unknown kind is refused at both ends.

## Open and read

```ts
// packages/polkadot-ui/portfolio/data/database.ts — target
export const portfolioDatabase = defineLocalDatabase({
  database: "portfolio", endpoint: "indxdb://portfolio", namespace: "portfolio", surql,
});
// The cloud engine is the same `surrealdb` client on a `wss://` endpoint. Only this file changes.
```

```ts
// packages/polkadot-ui/portfolio/data/queries.ts — target
export const entryQueries = {
  list: (kind: EntryKind) =>
    queryOptions({
      queryKey: ["portfolio", "entries", kind],
      queryFn: () => listEntries(kind),          // validated by the kind's schema
      placeholderData: DEFAULT_ENTRIES[kind],    // the design's figures, until the database answers
    }),
};
```

The database opens lazily and the engine is eleven megabytes, so the board paints from
placeholder data and swaps to stored content when the first query resolves. `isPlaceholderData`
is what a widget reads to say "offline" honestly.

## Author

```ts
// packages/polkadot-ui/portfolio/data/tools.ts — target
defineTextTool({
  name: "entry.create",
  description: "Add an entry to the portfolio. `content` takes the kind's own shape; entry.kinds lists them.",
  inputSchema: EntryInput.toJsonSchema(),
  execute: async (raw) => {
    const input = EntryInput(raw);
    if (input instanceof type.errors) return `Refused: ${input.summary}`;
    const entry = await createEntry(input);
    await queryClient.invalidateQueries({ queryKey: ["portfolio", "entries", input.kind] });
    return `Created ${input.kind} "${entry.title}" [${entry.id}].`;
  },
});
```

Every write invalidates the query it changes, so the board re-reads through the same path a
person's edit would. Arrangement tools call the framework's own actions (`setGroupChildLayouts`,
`dockWindow`, `reorderGroupChild`); the board saves its serialized state to `portfolio.board`
after each document change, revision-guarded like the workbench's canvases.

## Widgets over entries

```ts
// packages/polkadot-ui/portfolio/widgets/kinds.ts — target
export const WIDGET_KINDS: Record<EntryKind, WidgetKind> = {
  repo:    { each: true,  footprint: { span: 5, rows: 3 }, expanded: { span: 7, rows: 4 }, render: RepoCard },
  skill:   { each: true,  footprint: { span: 1, rows: 1 }, tone: "bare", render: Tile },
  writing: { each: false, footprint: { span: 6, rows: 4 }, render: WritingList },
  // ...
};
```

`each: true` gives one window per entry (`${kind}:${entryId}`); `each: false` gives one window
that lists every entry of the kind. A new entry of an `each` kind docks a new window at the centre
of the board, which the flowed container takes as "append".

## Not in this design

- Sign-in. The schema carries `owner` so it lands without a migration; until then one portfolio
  is opened by a fixed owner.
- Cloud. `open()` is the seam; nothing else reads the endpoint.
- Live GitHub figures. A `repo` entry names a repository; a later query fills stars and commits
  through React Query with the entry's own figures as placeholder data.
