# Polkadot product plan

Status: active incremental research  
Research date: 2026-08-23  
Repository base: `854c1b859e1e` plus the uncommitted `apps/polkadot` scaffold

## Research contract

Polkadot is a production application built on `@hyphened/infinite-canvas`. The
research goal is to define the complete product feature set, its end-to-end
execution structure, the data model that supports it, and the concrete product
needs that should mature the framework.

The plan must answer:

1. What is Polkadot's product identity and primary user workflow?
2. Which durable objects exist, and which framework objects are views over them?
3. Which content kinds, creation flows, organization tools, and navigation tools
   belong in the product?
4. How do local persistence, search, import/export, remote sync, collaboration,
   and agent control fit without weakening the first usable slice?
5. Which behavior belongs to Polkadot and which belongs to the headless
   framework?
6. What implementation order produces a usable product spine at every phase?
7. What observable behavior proves each phase?

Completion requires a feature catalogue with priorities, a target data model, a
module and dependency map, an implementation sequence with exit criteria, a
framework feedback ledger, and precise references for every load-bearing
decision.

### Scope

- a local-first, open-source spatial workbench
- live React applications and content inside canvas windows
- reusable content shown through one or more spatial views
- window groups, workspaces, relationships, navigation, presentation, search,
  automation, and later collaboration
- a polished desktop shell and coherent interaction language
- framework changes justified by concrete Polkadot use

### Current non-scope

- rewriting the framework before a product requirement proves the need
- making drawing and generic whiteboarding the product identity
- choosing a rich-text editor, sync protocol, authentication provider, or file
  backend before its owning workflow is specified
- using browser automation for research or diagnosis
- preserving an API or schema merely because an early scaffold used it

## Current product thesis

Polkadot is a spatial desktop for active project work. A window contains a live
tool or a view of durable content. The canvas arranges those views, local groups
compose them into working layouts, and workspaces filter one canvas into named
contexts. Search, waypoints, and the command system make large spaces
navigable.

This follows the framework's established identity. The repository describes a
spatial window manager whose primary object is a live DOM window, with WebGPU
reserved for programmable scene content. The framework requirements place
whiteboarding, drawing, and document editing outside the framework itself.
Polkadot can supply editors, connectors, media, and other product objects as a
consumer without teaching the framework those domains.

Evidence:

- `README.md:3-9, 20-29`
- `docs/REQUIREMENTS.md:9-44`
- `reference/infinite-canvas/README.md:29-43`

## Running scaffold

The application already has a complete initial execution path.

```txt
apps/polkadot/
├── src/
│   ├── routes/
│   │   ├── __root.tsx
│   │   └── index.tsx
│   ├── workspace/
│   │   └── workspace-canvas.tsx
│   ├── router.tsx
│   └── styles.css
├── package.json
├── tsconfig.json
└── vite.config.ts
```

```tsx
// apps/polkadot/src/workspace/workspace-canvas.tsx
const [store] = useState(() => createInfiniteCanvasStore(initialState));

return (
  <InfiniteCanvas.Provider store={store}>
    <InfiniteCanvas.Viewport
      hud={false}
      renderOverlay={() => <WorkspaceOverlay />}
      windowDefinitions={windowDefinitions}
    />
  </InfiniteCanvas.Provider>
);
```

The parent owns the canvas store. The framework renders the viewport. Product
chrome lives in the overlay, and its rail state is a Legend State observable.
The "New note" control calls the framework's canonical `openWindow` action.

Proof:

```sh
vp check
# package-local result: formatting, lint, and type checks pass

vp -C apps/polkadot build
# result: TanStack Start client and SSR builds complete
```

The repository toolchain is pinned at Vite+ 0.2.9. Version 0.1.24 built the Start
application but served every development route as 404. A clean generated Start
app and the repository both returned HTTP 200 under 0.2.9. The deliberate upgrade
passes the full repository check, all 489 framework tests, the package build,
the playground build, and the Polkadot client/server build.

Status: the headless witness rendered the product shell, initial window, library,
and controls. The local database did not admit the canvas under the WASM 3.x
engine. Official issue evidence shows that engine did not provide a viable
IndexedDB browser path, so the browser target is now the compatible 2.6.1 worker
engine. Admission under that target remains unproven. Browser automation is
paused while the framework-first affordance review closes.

## Established framework capabilities

The following are observed in the current source or its canonical consumers.
They are available to the product now.

| Product need         | Existing authority                                                                     | Product implication                                                                                                     | Status   |
| -------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | -------- |
| Parent-owned runtime | `store.tsx` `InfiniteCanvasProviderProps`; `store-injection.test.tsx`                  | Polkadot can own the store, create a handle, and place shell UI outside the framework                                   | observed |
| Live content windows | `types.ts` `InfiniteCanvasWindowDefinition`; `frame-slots.tsx`                         | Each content kind can render normal React DOM with type-specific chrome and semantic summaries                          | observed |
| One mutation path    | `types.ts` `InfiniteCanvasCommands`; `commands.ts`                                     | Toolbar, pointer, keyboard, palette, and agents can converge on the same commands                                       | observed |
| Groups and docking   | `group-tree.ts`, `group-layout.ts`, `group-state.ts`, `group-layer.tsx`                | Split panes, tabs, accordions, docking, reordering, shell movement, and shell resizing need no product reimplementation | observed |
| Workspaces           | `workspace.ts`, `workspace-membership.ts`, `apps/playground/src/routes/workspaces.tsx` | Named virtual desktops can filter one canvas and restore camera and selection                                           | observed |
| Undo and redo        | `history.ts`, interaction checkpoints                                                  | A pointer drag is one document edit while camera motion stays outside document history                                  | observed |
| Layout recipes       | `recipes.ts`, `apps/playground/src/routes/groups.tsx` `RecipeControls`                 | Polkadot can persist reusable arrangements and apply them at a world location                                           | observed |
| Spatial targeting    | `spatial-target.ts`, workflow-board and drop-tray routes                               | Consumer objects, connections, overlays, window areas, and drops can share one hit-order contract                       | observed |
| Typed drops          | `drop-interaction.ts`, `apps/playground/src/routes/drop-tray.tsx`                      | Insert trays can preview and commit the exact same snapped placement                                                    | observed |
| Connections          | `scene-layer-geometry.ts`, workflow-board route                                        | Product relationships can render and participate in selection without becoming windows                                  | observed |
| Navigation geometry  | `minimap.ts`, `offscreen.ts`, `camera-navigation.ts`                                   | Minimap, offscreen cues, fit, jump, and focus navigation already have pure geometry                                     | observed |
| Command discovery    | `getInfiniteCanvasContextualCommands`; playground command palette                      | A product command center can list live enablement and navigate to named windows                                         | observed |
| Body interaction     | `portal.tsx`, `focus-trap.ts`, body-content and portal routes                          | Forms, native scrolling, text selection, menus, and popovers can live inside windows                                    | observed |
| Far-zoom meaning     | `detail-level.ts`; `renderSummary`                                                     | Every content kind can replace unreadable bodies with a meaningful summary                                              | observed |
| Persistence envelope | `persistence.ts`                                                                       | The framework owns validation and migration of layout snapshots                                                         | observed |
| Agent handle         | `canvas-handle.ts`                                                                     | Agents and parent-side automation can read snapshots, subscribe to state slices, and execute canonical commands         | observed |
| Headless styling     | `data-attributes.ts`, `theme.css`, `frame-slots.tsx`                                   | Polkadot owns its visual identity without forking interaction code                                                      | observed |

## Provisional product object model

The object split below is a working hypothesis. It will be promoted only after
the persistence and core-workflow evidence cycles close.

| Object       | Owns                                                                      | Relationship to the framework                              | Status              |
| ------------ | ------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------- |
| Space        | title, settings, current layout revision                                  | one serialized canvas document                             | inferred            |
| Content item | durable type-specific content and metadata                                | referenced by `window.data`; independent of placement      | inferred            |
| Window       | one spatial view of a content item                                        | `InfiniteCanvasWindow`                                     | observed foundation |
| Group        | a local working layout                                                    | `InfiniteCanvasGroup`                                      | observed foundation |
| Workspace    | a named membership filter with camera and selection                       | `InfiniteCanvasWorkspace`                                  | observed foundation |
| Relation     | a meaningful link between content items                                   | product record rendered through connector helpers          | inferred            |
| Connection   | one canvas-specific visual presentation of a relation between two windows | product record rendered and targeted through scene helpers | inferred            |
| Recipe       | reusable window and group arrangement                                     | `InfiniteCanvasRecipe` plus product matching rules         | partly observed     |
| Waypoint     | named camera, selection, or target state                                  | product record applied through camera navigation           | inferred            |
| Tour         | ordered waypoints with presentation metadata                              | product record over waypoints                              | inferred            |
| Asset        | imported binary or remote media metadata                                  | referenced by a content item                               | unresolved          |

The key separation is content versus view. Reusing a note in two spaces should
create two windows over one content record. Copying a window's rect into the
content record would couple durable knowledge to one layout and prevent reuse.

## Primary workflow and content strategy

The primary user is doing complex project work with heterogeneous material and
several active tools. Their continuous session is:

```txt
capture a source or thought
  -> open it as a live window
  -> read, edit, or operate it in place
  -> arrange it beside related material
  -> connect, group, or assign it to a workspace
  -> retrieve it through search, commands, or a waypoint
  -> turn the live space into an explanation or reusable layout
```

The canonical sample registry establishes that window kinds can be tools as
well as content. Its `control` body executes focus, camera, lifecycle, and open
commands from inside a normal React window. Polkadot therefore needs one
registry language for durable content views and live utility windows; it does
not need a second panel runtime.

Evidence:

- `apps/playground/src/showcases/sample-layout.tsx:127-328`
- `packages/infinite-canvas/src/types.ts` `InfiniteCanvasWindowDefinition`

### Content kind ladder

The full product can host many kinds, but their order must follow the session
above. Each promoted kind needs a strong edit or use path, a semantic summary,
search projection, import/export behavior, and a tested body-input policy.

| Tier                | Kind           | User outcome                                        | Required behavior                                                  | Status                        |
| ------------------- | -------------- | --------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------- |
| First spine         | Note           | capture and edit a thought in place                 | text editing, title, autosave, summary, duplicate view             | accepted direction            |
| First spine         | Bookmark       | keep a source with useful identity                  | URL paste, metadata, open externally, optional safe embed, summary | accepted direction            |
| First spine         | Search results | find and reopen any item or window                  | lexical search, keyboard navigation, focus and camera jump         | tool window or command center |
| First spine         | Inspector      | edit metadata and relationships for the active item | tags, links, memberships, delete, reveal record                    | shell panel first             |
| Mixed-media tranche | Image          | collect and compare visual material                 | native-file drop, intrinsic sizing, zoom-safe preview, metadata    | planned                       |
| Mixed-media tranche | PDF            | read source material beside notes                   | page navigation, text/search bridge, annotation references         | planned                       |
| Mixed-media tranche | Audio/video    | review time-based material spatially                | playback preservation, transcript or markers, summary              | planned                       |
| Structured tranche  | Document       | develop long-form work                              | block or rich-text editor, outline, export, references             | unresolved editor choice      |
| Structured tranche  | Table          | work with records in a spatial view                 | typed columns, sorting, filtering, alternate views                 | planned                       |
| Technical tranche   | Code           | keep executable or reference code in context        | syntax, copy, file link, optional execution boundary               | planned                       |
| Composition tranche | Canvas link    | move between large spaces without flattening them   | preview, open, backlinks, breadcrumbs                              | planned                       |

The first product spine uses two durable kinds. Note proves editing and
autosave. Bookmark proves external capture and a representation with an embed
fallback. Search and the inspector are product tools over those records. Image
and PDF follow once native-file drop and asset storage have an owning path.

This order avoids shallow type breadth. A placeholder table, code editor, PDF
viewer, and media player would make the registry look large while leaving the
capture-to-return workflow unfinished.

## Durable data spine

The first data path will use the SurrealDB JavaScript SDK with the embedded
WASM engine in a Web Worker. The official engine supports `indxdb://` for
IndexedDB persistence and provides a worker adapter for keeping database work
off the canvas thread. Registering remote engines beside the worker engine
keeps a future server connection available without changing the repository
contract.

Versions checked on 2026-08-23:

```txt
surrealdb        2.0.8
@surrealdb/wasm  2.6.1

@surrealdb/wasm peer dependency: surrealdb ^2.0.0-0
local surreal binary: 3.2.1
```

The 2.6.1 pin is deliberate. The 3.x browser witness failed at the IndexedDB
connection boundary, and the upstream 3.x tracking issue records IndexedDB as
unavailable there. Version 2.6.1 predates the upstream Vite worker fix, so the
workspace carries the exact `beb9d00` backport and injects the worker through
Vite's `?worker` loader. The production worker now points at the emitted hashed
WASM asset. A future WASM upgrade must prove both IndexedDB and worker packaging
before replacing the pin and patch.

The durable split is:

```txt
SurrealDB
├── project              ownership boundary and project metadata
├── canvas_document      one revisioned framework layout snapshot
├── content_item         reusable typed content independent of placement
└── relates_to           meaningful content-to-content edge with metadata

Infinite-canvas store
├── windows              views whose data carries a content record id
├── groups               local window layouts
├── workspaces           membership filters and saved camera/selection
└── camera + selection   canvas document state
```

The canvas layout remains one framework-owned value. Normalizing its windows,
groups, and workspaces into duplicate database tables would create two writers
for the same rects and group trees. `canvas_document.layout` stores the
framework serialization envelope as one flexible object. Content and relations
stay normalized because they have identity and queries outside any one layout.

The core schema shape below executed successfully against the local SurrealDB
3.2.1 in an in-memory database.

```surql
DEFINE TABLE canvas_document SCHEMAFULL;
DEFINE FIELD project ON TABLE canvas_document TYPE record<project>;
DEFINE FIELD title ON TABLE canvas_document
  TYPE string ASSERT string::len($value) > 0;
DEFINE FIELD revision ON TABLE canvas_document TYPE int DEFAULT 0;
DEFINE FIELD layout ON TABLE canvas_document TYPE object FLEXIBLE;
DEFINE FIELD created_at ON TABLE canvas_document
  TYPE datetime DEFAULT ALWAYS time::now() READONLY;
DEFINE FIELD updated_at ON TABLE canvas_document
  TYPE datetime VALUE time::now();

DEFINE TABLE content_item SCHEMAFULL;
DEFINE FIELD project ON TABLE content_item TYPE record<project>;
DEFINE FIELD kind ON TABLE content_item TYPE string;
DEFINE FIELD title ON TABLE content_item
  TYPE string ASSERT string::len($value) > 0;
DEFINE FIELD content ON TABLE content_item TYPE object FLEXIBLE;

DEFINE TABLE relates_to
  TYPE RELATION IN content_item OUT content_item ENFORCED SCHEMAFULL;
DEFINE FIELD kind ON TABLE relates_to TYPE string;
DEFINE FIELD label ON TABLE relates_to TYPE option<string>;

DEFINE FUNCTION fn::save_canvas(
  $canvas: record<canvas_document>,
  $revision: int,
  $layout: object
) {
  RETURN UPDATE ONLY $canvas
    SET layout = $layout, revision += 1
    WHERE revision = $revision;
};
```

Runtime result:

```json
{
  "canvas": "canvas_document:bheabpenluycbn4w9a1y",
  "revision": 1,
  "title": "Main canvas"
}
```

Status: runtime-proven for schema creation, record creation, and a
revision-checked save. The local parser rejected `FLEXIBLE TYPE object` even
though the documentation snapshot shows both orders; `TYPE object FLEXIBLE` is
the proven syntax for this project.

### Load and save path

```txt
route loader
  -> open database worker
  -> load canvas_document + referenced content items
  -> parse layout through parseInfiniteCanvasState(baseState)
  -> normalize against the current window registry
  -> create parent-owned InfiniteCanvasStore
  -> render Provider(store) -> Viewport -> window bodies
  -> observe the parent-held InfiniteCanvasHandle
  -> wait until interaction is null, debounce, handle.snapshot()
  -> validate the host payload, fn::save_canvas(expected revision, layout)
```

The framework parser owns layout recovery and migration. ArkType owns raw host
inputs, content-kind payloads, and database result projections. SurQL owns
durable fields, links, relation shape, indexes, and the atomic revision check.
Generated TypeScript must never outrank the `.surql` schema or the framework's
layout parser.

The initial reload proof needs one project, one canvas, one note content item,
and one window that references it. Collaboration, auth, asset blobs, changefeed,
and remote conflict resolution stay outside that slice.

## Organization and navigation model

Each organizing concept has one job. Sharing names or visual treatments must
not let two concepts claim the same window geometry.

| Concept     | Exact responsibility                                                           | Owns window rects?                             | Durable owner                                       |
| ----------- | ------------------------------------------------------------------------------ | ---------------------------------------------- | --------------------------------------------------- |
| Group       | local split, tabs, or accordion layout that moves as one world object          | yes, through the framework group tree          | framework layout snapshot                           |
| Workspace   | named membership filter over one canvas, with restored camera and selection    | no                                             | framework layout snapshot                           |
| Region      | named spatial area used for meaning, background treatment, fit, and navigation | no by default                                  | product record plus scene representation            |
| Tag         | non-spatial content classification and retrieval                               | no                                             | content metadata or relation                        |
| Recipe      | reusable arrangement applied to existing windows                               | only while applying through framework commands | product record containing an `InfiniteCanvasRecipe` |
| Waypoint    | named camera and target state used to return to a location                     | no                                             | product record linked to a canvas                   |
| Tour        | ordered waypoints used for a live explanation                                  | no                                             | product records over waypoints                      |
| Canvas link | navigates to another canvas document                                           | no                                             | content item linked to another `canvas_document`    |

The framework's group research defines a group as a local layout boundary. A
single global tiling tree and dashboard grid are rejected because an infinite
world has no natural monitor boundary. Polkadot preserves free placement and
lets structured clusters exist anywhere.

Evidence:

- `docs/research/grouping-and-docking.md:10-105`
- `packages/infinite-canvas/src/group-tree.ts` `InfiniteCanvasGroupNode`
- `packages/infinite-canvas/src/types.ts` `InfiniteCanvasWorkspace`
- `docs/ROADMAP.md:153-209`

### Large-space orientation stack

The product uses several complementary return paths. Each answers a different
question.

| User question                               | Product affordance                                                  | Existing framework base                                                            |
| ------------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Where am I relative to everything?          | minimap with viewport, groups, active, and selected marks           | `getInfiniteCanvasMinimapLayout`                                                   |
| What is just outside this view?             | bounded offscreen indicators with an honest hidden count            | `getInfiniteCanvasOffscreenIndicators`                                             |
| Where is the thing called X?                | command center search over content, windows, canvases, and commands | contextual commands plus window presence                                           |
| How do I return to this exact working view? | named waypoint                                                      | camera navigation and selection commands                                           |
| How do I explain this space in order?       | tour with interruptible camera transitions                          | semantic camera requests; animation remains a product or future framework boundary |
| Which context was I working in?             | workspace switcher with camera and selection restoration            | `InfiniteCanvasWorkspace`                                                          |
| How do I move into deeper structure?        | canvas-link window and route breadcrumb                             | separate canvas documents                                                          |

Nested live canvases remain outside the first architecture. A canvas inside a
canvas introduces a second camera, input plane, focus model, persistence scope,
and command surface. A canvas-link window provides hierarchy and preview while
keeping one active camera.

### First organization workflow

```txt
create a note and a bookmark
  -> connect them with a labeled relation
  -> dock them into a local split group
  -> rename the group
  -> assign the complete group to a Research workspace
  -> save the arrangement as a recipe
  -> search for the bookmark by title
  -> jump to it and fit its group
  -> save the current view as a waypoint
```

Everything through workspace assignment uses existing framework affordances or
product records. Waypoint capture is the first product-only navigation value.
This workflow can mature the product before it asks the framework for another
primitive.

## Creation and import pipeline

Every intake path should produce one product command rather than invent its own
record, placement, and error behavior.

```ts
// Target host-boundary contract
type CreateContentViewIntent = Readonly<{
  canvasId: string;
  source:
    | Readonly<{ type: "blank"; kind: "note" }>
    | Readonly<{ type: "url"; value: string }>
    | Readonly<{ type: "text"; value: string }>
    | Readonly<{ type: "file"; file: File }>;
  placement:
    | Readonly<{ type: "camera-center" }>
    | Readonly<{ type: "world-point"; point: Readonly<{ x: number; y: number }> }>
    | Readonly<{ type: "preview"; rect: InfiniteCanvasRect }>;
}>;
```

Status: target. ArkType will parse command, URL, and clipboard inputs. A native
`File` stays a prototype-boundary value and is validated with `instanceOf` plus
kind-specific size and media checks.

```txt
button / command / paste / internal drag / native drop
  -> parse CreateContentViewIntent
  -> derive content kind and initial metadata
  -> create durable content record
  -> resolve or reuse the exact preview placement
  -> open a window through InfiniteCanvasCommands.openWindow
  -> schedule the canvas snapshot save
  -> report import work or failure on the content record
```

Creating content and opening its view cross two authorities, so pretending the
operation is one database transaction would be false. The safe failure state is
a content record in the library with no view. The user can open it later. A
window that points at missing content is invalid and must render an explicit
recovery body rather than disappear.

### Intake paths

| Input                 | Normalization                                 | Placement                                            | First supported tranche |
| --------------------- | --------------------------------------------- | ---------------------------------------------------- | ----------------------- |
| New note button       | blank note intent                             | camera center with deterministic cascade             | first spine             |
| Command center        | kind plus optional title                      | camera center or selected region                     | first spine             |
| URL paste             | trimmed and parsed URL; create bookmark       | pointer location when known, otherwise camera center | first spine             |
| Text paste            | plain text; create note                       | camera center                                        | first spine             |
| Internal tray drag    | typed app payload                             | framework snap preview and exact committed rect      | first spine             |
| Native file drag      | `DataTransfer.files` to validated file intent | product adapter first, framework candidate after use | mixed-media tranche     |
| Clipboard file        | clipboard item to validated file intent       | camera center                                        | mixed-media tranche     |
| Duplicate view        | existing content id                           | offset from source window                            | first spine             |
| Duplicate content     | cloned content record                         | offset from source window                            | later explicit command  |
| Link existing content | existing content id                           | chosen world point                                   | first spine             |

The current framework drop API accepts a typed payload started through
`startDrag`, resolves one spatial target, computes one snapped placement, draws
guides, and passes that same placement to `onDrop`. The package contains no
`DataTransfer` reference across 124 source files. Native file drop is therefore
a confirmed product gap rather than an undocumented current affordance.

Evidence:

- `packages/infinite-canvas/src/infinite-canvas.tsx:606-697`
- `packages/infinite-canvas/src/types.ts:540-660`
- `packages/infinite-canvas/src/drop-interaction.ts`
- `apps/playground/src/routes/drop-tray.tsx:140-262`
- literal Type Atlas scan for `DataTransfer`, 2026-08-23: zero matches in
  `packages/infinite-canvas/src`

The first native-file implementation stays product-local. It will use the
overlay context's canonical spatial-target resolver and the exported placement
helper, keep the computed placement as preview state, and commit that exact
value. Promotion into the framework requires a second real consumer or evidence
that product-local integration must copy framework-owned input lifecycle.

## Command and agent model

Polkadot needs one command center that merges framework commands, product
commands, content search, window navigation, and creation actions. The sources
remain separate because their availability and input contracts differ.

```ts
// Target common command descriptor
type ApplicationCommand<Input = void> = Readonly<{
  id: string;
  label: string;
  description: string;
  group: "canvas" | "content" | "create" | "edit" | "navigate" | "view";
  risk: "reversible" | "destructive" | "external";
  input: Type<Input>;
  isEnabled: (context: CommandContext) => boolean;
  execute: (input: Input, context: CommandContext) => Promise<CommandReceipt>;
}>;
```

Status: target. `Type<Input>` represents an ArkType contract. The concrete type
will use the installed API rather than introducing an application wrapper over
ArkType.

### Command sources

| Source                         | Examples                                                          | Discovery                                                    | Execution                                         |
| ------------------------------ | ----------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------- |
| Framework descriptor           | focus, arrange, dock, group, workspace, camera, history           | current contextual command queries                           | `InfiniteCanvasCommands.executeCommand`           |
| Parameterized framework action | rename, create workspace, move to a chosen workspace, open window | product supplies the missing string, target, or window value | typed framework command facade                    |
| Product command                | create content, connect items, capture waypoint, import, export   | application registry with ArkType input                      | service owning database plus canvas orchestration |
| Search result                  | content, window, canvas, waypoint                                 | SurrealDB query plus current window presence                 | focus/open/navigate through canonical commands    |

The playground command palette already proves the framework half. It combines
contextual descriptors with window presence, restores minimized windows before
navigating, keeps unavailable commands visible but inert, and returns focus to
the canvas after closing. Polkadot promotes that interaction into its main
command center and adds parameter collection instead of hiding commands whose
inputs are absent.

Evidence:

- `apps/playground/src/showcases/command-palette.tsx`
- `packages/infinite-canvas/src/commands.ts`
- `packages/infinite-canvas/src/types.ts:1020-1097, 1301-1467`

### Parent and agent contract

`createInfiniteCanvasHandle(store)` provides the correct renderer-free base:

```txt
getState()                 live immutable state
snapshot()                 JSON-safe layout without transient interaction
getContextualCommands()    currently enabled framework commands
commands                   canonical typed mutation facade
subscribe(selector, fn)    settled slice notifications outside tracking context
```

The implementation reads through Legend State without exposing observables to
the caller. Its subscription queues one microtask, collapses batched commits,
and compares selector identity. The handle is experimental because spatial
queries may still join it; the curated primitives it exposes are stable.

Evidence:

- `packages/infinite-canvas/src/canvas-handle.ts:17-98`
- `packages/infinite-canvas/src/store-injection.test.tsx`
- `packages/infinite-canvas/src/canvas-handle.test.ts`

The product agent contract adds database queries and application commands beside
this handle. It never sends raw reducer actions, edits DOM, or mutates database
records outside a named command.

### Agent safety and witnessability

| Operation                                  | Default policy                                         | Visible result                            |
| ------------------------------------------ | ------------------------------------------------------ | ----------------------------------------- |
| read/search/inspect                        | execute                                                | results cite record and canvas identities |
| focus/select/navigate                      | execute                                                | camera and selection visibly move         |
| reversible layout command                  | execute                                                | framework history receives one entry      |
| create content or relation                 | preview when placement or targets are ambiguous        | new record and view become selected       |
| bulk mutation                              | require a count and preview                            | receipt lists affected ids                |
| delete content                             | confirm unless a user already issued the exact command | deletion receipt and recovery policy      |
| export, network fetch, publish, or message | confirm destination and payload                        | durable external-action receipt           |

Every command returns a receipt with command id, affected record ids, affected
window ids, revision before and after, and undo semantics. Receipts are product
values for activity and agent reporting. They are not a second event-sourcing
system.

### Undo boundary

Framework history covers windows, groups, workspaces, and their layout
transactions. Editors own their content-local undo. A command that creates a
content record and opens a view crosses both domains. In the first spine,
undoing the view leaves the content safely in the library. Deleting that record
requires an explicit content command. A unified cross-domain undo stack remains
open until real workflows show which compound operations users expect to
reverse as one step.

## Visual and interaction language

Polkadot should read as one spatial environment even when its windows contain
very different applications. The visual system uses one base frame grammar,
one scale model, and one semantic token family. Content kinds can change body
layout, icon, summary, and a restrained accent. They do not replace the core
window controls or interaction cues.

### Layer ownership

```txt
fixed product shell and desktop portals
interaction overlays and command center
optional WebGPU screen-space effects
window plane
group shells
product world scene: relations, regions, waypoints
adaptive grid and background
```

The DOM owns text, controls, bodies, focus, menus, tooltips, window frames, and
the product shell. WebGPU owns world geometry and effects that benefit from
instancing, shaders, or camera-synchronized drawing. Core frame chrome stays in
the DOM host beside its body so camera movement cannot create cross-layer
drift.

Evidence:

- `packages/infinite-canvas/src/infinite-canvas.tsx:1090-1245`
- `packages/infinite-canvas/src/grid-backdrop.tsx`
- `reference/infinite-canvas/R3F_V10_CAPABILITY_IDEAS.md:180-239, 278-332`

### Frame grammar

| Element                    | Product rule                                                                                             |
| -------------------------- | -------------------------------------------------------------------------------------------------------- |
| Surface                    | quiet opaque or translucent material with stable contrast; active and selected remain distinguishable    |
| Header                     | drag region, type mark, editable title, state indicators, canonical controls                             |
| Controls                   | same order and meaning across every kind; unavailable capabilities remain visibly disabled               |
| Body                       | kind-owned live React content with explicit scroll, selection, focus, and portal policy                  |
| Active corners and handles | constant screen-space hit size; simplify at summary scale                                                |
| Group shell                | visually behind members; layout mode and draggable seams are evident without looking like another window |
| Tool window                | denser header and utility body, using the same slots and lifecycle                                       |

`renderFrame` remains an escape hatch for a real semantic variant such as a
terminal or media lightbox. Ordinary content kinds use the shared frame and
tokens. A collection of bespoke frames would weaken focus, control discovery,
and theme completeness.

Evidence:

- `apps/playground/src/routes/custom-frames.tsx`
- `packages/infinite-canvas/src/frame-slots.tsx`
- `packages/infinite-canvas/src/window-frame.tsx`

### Scale model

| Band     | Window representation                                              | Interaction                         |
| -------- | ------------------------------------------------------------------ | ----------------------------------- |
| Full     | complete body and chrome                                           | all body and frame controls         |
| Summary  | kind-specific title, icon, state, or count                         | select, focus, move, open full view |
| Overview | summary stays visible until evidence supports a separate icon lane | navigation and selection only       |

The framework already selects full versus summary from effective screen size
with hysteresis, and simplifies framework chrome on the same band. Polkadot must
provide a useful `renderSummary` for every registered kind. Rasterizing small
text does not create meaning and never replaces semantic summaries.

### Theme system

The framework stylesheet currently bridges eleven theme values and derives its
extended component tokens from semantic foreground, accent, shadow, raised
surface, muted accent, and accent-surface colors. Consumer CSS has already
proven a complete light look across normal and portalled content.

Polkadot will define application tokens once and map them into both the shell
and `--icx-*` contract. Dark and light are first-class from the initial design
phase. Window kinds use semantic aliases rather than hardcoded colors. Portals
read theme state from the document root because they mount outside transformed
window subtrees.

The current scaffold contains temporary hardcoded whites and dark fills. They
are scaffold evidence, not the target design system, and the first visual phase
must remove them.

Evidence:

- `packages/infinite-canvas/src/theme.css:1-150`
- `packages/infinite-canvas/src/types.ts:450-462`
- `apps/playground/src/canvas-light-theme.css`
- `apps/playground/src/showcases/theme-switcher.tsx`

### Motion and input

- direct manipulation has no decorative delay
- camera transitions are interruptible by pointer, wheel, touch, or keyboard
- docking, snap, selection, and drop previews animate only properties that
  clarify the state change
- content playback and body scroll survive offscreen culling because windows
  stay mounted
- a `prefers-reduced-motion` policy disables nonessential transitions and uses
  instantaneous camera navigation
- hover never carries information that focus cannot expose
- pointer thresholds and hit targets remain screen-space stable across zoom

The framework source has no `prefers-reduced-motion` rule across 124 files.
Polkadot owns the first consumer policy. Repeated consumer overrides or a future
framework camera animator may justify a framework-level motion policy later.

### Accessibility baseline

- the product shell has a short, predictable tab order
- `Tab` from the canvas enters the active window body; `Escape` returns to the
  canvas command surface
- command center search is fully keyboard navigable and restores focus on close
- every content kind declares a body focus, text-selection, scroll, and summary
  policy
- group tabs and accordions retain the framework's roving focus behavior
- light and dark themes meet text, focus, selection, guide, and disabled-state
  contrast requirements
- tooltips supplement accessible names and never replace them
- summary-mode control removal keeps equivalent commands available in the
  command center

## Performance and reliability budgets

The framework's measured profile found a specific failure: every camera tick
reconciled every live body. Memoizing body output changed 20-window pan from
15.6 fps to 96.9 fps and drag from 4.4 fps to 58.3 fps in the 2026-06-10
environment. At 80 windows, pan still measured 21.3 fps before later frame
memoization and culling work. Those later tranches are structurally present and
not measured on representative hardware.

Evidence:

- `docs/research/performance-profile.md`
- `packages/infinite-canvas/src/window-frame.tsx` `isFrameOffscreen`
- `packages/infinite-canvas/src/culling.test.tsx`
- `docs/ROADMAP.md:101-151, 290-354`

### Product budgets

These are acceptance targets for a declared reference device, not claims about
the current scaffold.

| Path                      | Target                                                                                        |
| ------------------------- | --------------------------------------------------------------------------------------------- |
| Shell paint               | under 1 second warm and 2.5 seconds cold                                                      |
| Interactive local canvas  | under 1.5 seconds warm and 3 seconds cold, including database worker startup and layout load  |
| Pan, zoom, and drag       | p95 frame under 16.7 ms at 100 simple windows                                                 |
| Heavy body isolation      | camera movement causes zero note editor, PDF page, media player, or table body reconciliation |
| Command center open       | visible and keyboard-ready within 50 ms                                                       |
| Local lexical search      | first 20 results within 100 ms over 10,000 content items                                      |
| Local autosave            | enqueue within 250 ms of settled state; durable within 1 second                               |
| Main-thread database cost | no database task blocks the main thread; embedded engine runs in a worker                     |
| Import feedback           | durable placeholder or explicit rejection within 100 ms; extraction continues asynchronously  |
| Initial client route      | stay below 200 kB gzip before the lazy database worker and kind-specific editors              |

The scaffold build currently emits roughly 171.5 kB gzip of JavaScript across
the route and shared entry, plus 8.1 kB gzip of CSS. This is a baseline, not a
budget pass, because route loading behavior and cached shared chunks still need
a runtime trace.

### Runtime rules

- window bodies subscribe only to the records and canvas state they render
- overlays may follow the camera; content bodies may not subscribe to the full
  canvas state
- offscreen windows stay mounted so focus, portals, scroll, playback, and
  uncontrolled inputs survive
- semantic summaries precede rasterization as the readability mechanism
- raster capture stays disabled until a measured body workload proves the need
- WebGPU scene layers use demand rendering unless a visible feature declares an
  animation budget
- search indexes and relation traversal stay in SurrealDB rather than copying
  records into JavaScript for filtering
- editor and media dependencies load with their window kind, never with the
  initial shell

### Recovery contracts

| Failure                   | Required outcome                                                                                                 |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Invalid framework layout  | framework parser recovers valid windows or opens a layout recovery view; content records remain intact           |
| Missing content record    | window renders a recoverable missing-content body with remove/relink actions                                     |
| Interrupted layout save   | previous revision remains readable; pending state retries after startup                                          |
| Revision conflict         | save refuses stale revision and exposes an explicit conflict path; no last-writer overwrite disguised as success |
| Failed import             | content placeholder records the reason and offers retry or removal                                               |
| Failed database migration | app opens a diagnostic recovery shell without mutating the old database further                                  |
| WebGPU unavailable        | DOM canvas, windows, groups, navigation, and shell continue; scene enhancements disappear cleanly                |
| Corrupt kind payload      | ArkType reports field problems; body renders recovery UI instead of trusting `window.data`                       |
| Product crash             | last durable local revision opens; unsaved status is never shown as saved                                        |

### Development instruments

The product development build needs one bounded diagnostics panel that reports:

- current window, group, workspace, and content counts
- body render counts by kind during the last gesture
- p50 and p95 frame time for one predeclared gesture
- database worker startup, last query, save queue, revision, and last durable time
- live versus summary versus raster representation counts
- scene layer count and active animation policy
- most recent command receipt and failure

The existing benchmark and raster diagnostics are starting evidence. Product
measurements should use real registries, real window sizes, and real content
bodies. A synthetic threshold test cannot establish that an ordinary note is
full detail at 100 percent zoom or that an editor stays out of the camera loop.

## Search and relationships

The canvas is a view over durable content. Search and backlinks must work when
an item has no open window, appears in several windows, or lives on another
canvas.

### Search projection

Every content kind produces a bounded lexical projection when it saves:

```txt
content_item
├── title          exact identity and title matches
├── search_text    normalized kind-specific body projection
├── tags           structured filters
├── kind           type filter
└── updated_at     recency ordering
```

The database indexes `search_text`. It does not inspect an arbitrary flexible
`content` object at query time. Kind modules own projection because only the
note editor knows which blocks are text, the bookmark knows its host and
description, and the PDF pipeline knows extracted pages.

```surql
DEFINE ANALYZER content_text
  TOKENIZERS class, punct
  FILTERS lowercase, ascii;

DEFINE INDEX content_search ON TABLE content_item
  FIELDS search_text
  FULLTEXT ANALYZER content_text BM25 HIGHLIGHTS;

SELECT
  id,
  kind,
  title,
  search::score(0) AS score,
  search::highlight("[", "]", 0) AS match
FROM content_item
WHERE search_text @0@ $query
ORDER BY score DESC
LIMIT 20;
```

Status: runtime-proven on SurrealDB 3.2.1 for matching and highlights.

The command center merges these results with current window presence and
canvas metadata:

```txt
result selected
  -> visible view in active workspace: focus and center it
  -> minimized view: restore, focus, and center it
  -> view elsewhere on current canvas: activate its workspace, focus, and center it
  -> view on another canvas: navigate to that canvas and restore its saved context
  -> no existing view: open a new view at the current camera center
```

Cross-canvas location eventually needs a rebuildable `content_view_index`
derived from saved layout windows. It stores canvas id, content id, window id,
and kind, without rects or group trees. The framework layout remains the only
geometry authority. The canvas-save transaction refreshes the index; a repair
command can rebuild it from layout snapshots.

### Semantic relation and visual connection

A relation belongs to content. A connection belongs to one canvas view.

```txt
content_item A -> relates_to { kind, label } -> content_item B

canvas_connection
├── canvas_document
├── relation
├── from_window_id
├── to_window_id
├── route
└── optional waypoints and presentation style
```

This split prevents a reusable relation from choosing one permanent pair of
window rects. A relation may exist without a drawn connection. A canvas may
show the same relation through one chosen pair of views rather than drawing
every possible combination.

The graph record and traversal below executed successfully on SurrealDB 3.2.1:

```surql
DEFINE TABLE relates_to
  TYPE RELATION IN content_item OUT content_item ENFORCED SCHEMAFULL;
DEFINE FIELD kind ON TABLE relates_to TYPE string;
DEFINE FIELD label ON TABLE relates_to TYPE option<string>;

RELATE $note_id->relates_to->$source_id
  CONTENT { kind: "cites", label: "supports" };

SELECT
  ->relates_to.{ kind, label, out.{ id, kind, title } } AS relations
FROM ONLY $note_id;
```

Runtime result:

```json
{
  "kind": "cites",
  "label": "supports",
  "out": {
    "kind": "bookmark",
    "title": "Infinite canvas architecture"
  }
}
```

### Connection editing

1. Start from a window port or a "Connect" command.
2. Render a scene-layer preview from the source rect to the pointer.
3. Resolve the destination through the canonical spatial target pipeline.
4. On a valid window body or port, create or choose the semantic relation.
5. Create the canvas connection with the exact source and destination window ids.
6. Render the path through `getInfiniteCanvasWindowConnectorPath`.
7. Register the path with `createInfiniteCanvasEdgeTargetResolver` so selection,
   inspect, reconnect, label, route, and delete commands share one target id.

The framework currently supplies edge hit testing in screen pixels, path and
orthogonal-route geometry, scene transforms, label positions, and non-window
selection. Relationship persistence and editing remain product responsibilities.

Evidence:

- `packages/infinite-canvas/src/spatial-target.ts:215-304`
- `packages/infinite-canvas/src/scene-layer-geometry.ts`
- `apps/playground/src/routes/workflow-board.tsx`

### Semantic retrieval

Semantic retrieval is an optional later index over content chunks. It activates
only after a labeled evaluation set shows lexical search missing important
results. Embedding generation remains an external or local-model boundary;
Polkadot works fully without it. When enabled, SurrealDB owns vector storage,
the vector index, graph and permission filters, and hybrid rank projection.
The product command center owns presentation and explicit domain boosts.

## Remote sync as persistent design pressure

Local ownership is the build path. Remote behavior is unscheduled design
pressure on identity, revisions, permissions, personal view state, and command
boundaries. It must not displace the product capabilities that make the local
application worth using.

If remote work later activates, features arrive in increasing order of
coordination cost:

1. single-user backup and cross-device sync
2. published read-only canvases and exports
3. shared content editing and presence
4. shared live layout editing

Each step keeps the local database usable when the network or remote service is
absent. None belongs in the initial product spine or public-beta critical path.

### Current persistence fact

The framework serialization envelope contains the active window, active
workspace, camera, groups, selection, windows, workspaces, and schema version.
`InfiniteCanvasDocument` names the undoable subset as windows, groups,
workspaces, and active workspace. A workspace itself contains window membership,
camera, and selection.

This is coherent for one user and unsuitable as a naive shared multiplayer
record. One person's workspace switch, camera, selection, and active window
must not move everyone else.

Evidence:

- `packages/infinite-canvas/src/persistence.ts:60-73`
- `packages/infinite-canvas/src/types.ts:289-315, 358-372`
- `packages/infinite-canvas/src/workspace.ts`

### Shared and personal state split

| Shared project state                 | Personal view state                  | Ephemeral presence            |
| ------------------------------------ | ------------------------------------ | ----------------------------- |
| content records                      | active canvas                        | cursor and pointer preview    |
| semantic relations                   | active workspace                     | current gesture               |
| canvas windows and group trees       | camera by canvas/workspace           | transient selection broadcast |
| workspace definitions and membership | selection and active window          | typing or editing indicator   |
| explicit canvas connections          | shell preferences                    | short-lived user status       |
| recipes and published tours          | command history and recent locations | connection heartbeat          |

The persistence bridge can split the framework envelope for early remote
experiments. It saves shared layout fields to the canvas record and personal
view fields to a user-scoped record, then combines them before
`parseInfiniteCanvasState`. Workspace camera and selection require explicit
mapping because the current framework type bundles them with shared membership.

This is a framework pressure point rather than an immediate change request. A
shared-layout experiment must first prove whether a consumer adapter is clear
enough. Repeated need may justify public document/view serialization helpers or
a workspace model that separates shared membership from per-user view state.

### Sync mechanisms

| Need                      | Mechanism                                                             |
| ------------------------- | --------------------------------------------------------------------- |
| connected record updates  | SurrealDB live queries with explicit subscription close               |
| replayable remote history | table changefeeds and bounded `SHOW CHANGES` readers                  |
| offline outgoing work     | local outbox of typed product commands with idempotency ids           |
| content write conflict    | per-record revision check or editor-specific merge protocol           |
| layout write conflict     | canvas revision check; later an ordered layout-command protocol       |
| permission                | project, canvas, content, and publish policy in the database boundary |

The outbox carries product commands and their ArkType-validated inputs. It does
not carry arbitrary SurQL or raw framework actions. A remote acknowledgement
records the resulting revision and command receipt.

### Merge posture

- independent content records sync independently
- note or document text adopts the selected editor's proven collaboration model
  when shared editing is implemented
- semantic relations are database records with normal revision and permission
  rules
- camera, selection, and focus never enter shared layout conflict resolution
- group trees and window rects cannot be merged field by field without breaking
  layout invariants
- shared layout editing eventually orders named document mutations and applies
  them through the same framework commands used locally
- a stale whole-layout snapshot is rejected rather than allowed to overwrite a
  newer group tree

### First remote proof

Two clients signed in as the same user open one project. Client A edits a note;
client B receives the content update through a live query. Client A then moves a
window while client B is offline. Client B reconnects, detects the newer canvas
revision, and reloads the shared layout while preserving its own camera and
selection. Shared concurrent layout editing remains disabled in this proof.

## Full feature catalogue

Priority vocabulary:

| Priority  | Meaning                                                      |
| --------- | ------------------------------------------------------------ |
| Spine     | required for the first complete daily workflow               |
| Core      | required for a credible public beta                          |
| Expansion | extends a proven workflow after the core is reliable         |
| Frontier  | evidence-gated research with a concrete activation condition |

Every feature must pass the same promotion gate:

```txt
named user workflow
  + one durable data owner
  + canonical command path
  + keyboard and pointer access
  + semantic summary when spatial
  + recovery behavior
  + performance budget
  + product-shaped verification
```

### Application shell and project lifecycle

| Feature                              | Priority          | Product result                                                          | Framework base                              |
| ------------------------------------ | ----------------- | ----------------------------------------------------------------------- | ------------------------------------------- |
| TanStack Start route and SSR shell   | Spine, scaffolded | fast application entry and route ownership                              | consumer host                               |
| Parent-owned canvas store and handle | Spine, scaffolded | shell, persistence, commands, and agents share one runtime              | provider injection and handle               |
| Project library                      | Spine             | create, open, rename, duplicate, archive, and recover projects          | product data                                |
| Canvas library                       | Spine             | create, open, rename, duplicate, archive, and recover canvas documents  | document key and camera navigation          |
| Recent and recovery views            | Core              | reopen last work and find failed imports or damaged layouts             | product data                                |
| Canvas tabs and route history        | Core              | keep several canvases available without nesting camera planes           | TanStack Router plus separate stores        |
| Breadcrumbs and canvas links         | Core              | move through project and linked-canvas hierarchy                        | camera and route navigation                 |
| Preferences                          | Core              | theme, input, motion, density, autosave, and privacy settings           | policies and tokens                         |
| Offline installation                 | Core              | local work launches and saves without a network                         | Start service worker plus embedded database |
| Responsive shell                     | Core              | desktop-first UI remains usable on small screens and touch devices      | DOM shell                                   |
| First-run project                    | Core              | teaches create, arrange, group, search, and return through real content | seed data and commands                      |

### Content platform

| Feature                              | Priority  | Product result                                                                            | Framework base                               |
| ------------------------------------ | --------- | ----------------------------------------------------------------------------------------- | -------------------------------------------- |
| Note                                 | Spine     | editable thought with title, autosave, summary, search, links, and export                 | native text selection, body focus, summary   |
| Bookmark                             | Spine     | URL capture with metadata, safe preview, external open, summary, and search               | typed data and portal-aware body             |
| Search results                       | Spine     | keyboard search across content, windows, canvases, and commands                           | presence and navigation helpers              |
| Inspector                            | Spine     | edit metadata, tags, relations, memberships, and recovery state                           | overlay or utility window                    |
| Reusable content views               | Core      | one item can appear in several windows or canvases                                        | window identity separate from content id     |
| Duplicate view and duplicate content | Core      | make spatial reuse and true copy distinct commands                                        | canonical open and product records           |
| Canvas link                          | Core      | preview and open another canvas with backlinks                                            | bookmark-like window plus route navigation   |
| Image                                | Core      | offline visual collection, comparison, crop metadata, and summary                         | native file adapter and body                 |
| PDF                                  | Core      | page viewing, extracted search text, highlights, and note references                      | scroll body, portals, culling preservation   |
| Document                             | Expansion | long-form structured writing with outline and export                                      | editor-specific body                         |
| Audio and video                      | Expansion | playback, transcript, markers, and preserved offscreen state                              | mounted offscreen bodies                     |
| Table                                | Expansion | typed records, sorting, filtering, and alternate views                                    | structured body and data query               |
| Code                                 | Expansion | syntax, file links, copy, diffs, and optional bounded execution                           | editor body; execution remains external      |
| Content-kind extension contract      | Expansion | external maintainers can add a kind with schemas, renderer, summary, search, and commands | window registry plus product module contract |

### Canvas manipulation

| Feature                                                   | Priority  | Product result                                        | Framework base                      |
| --------------------------------------------------------- | --------- | ----------------------------------------------------- | ----------------------------------- |
| Pan, zoom, fit, and reset                                 | Spine     | stable navigation over an unbounded world             | camera commands and policies        |
| Select, multi-select, marquee, and keyboard extension     | Spine     | operate on coherent sets without pointer dependence   | selection model                     |
| Move, resize, pin, minimize, maximize, restore, and close | Spine     | desktop window lifecycle                              | command facade                      |
| Snap guides and hysteresis                                | Spine     | precise placement with stable screen-space feel       | snap resolver and overlays          |
| Align, distribute, swap, nudge, and named placement       | Core      | organize without hand-tuning every rect               | arrangement commands                |
| Undo and redo for layout                                  | Core      | reversible spatial experimentation                    | framework history                   |
| Minimap                                                   | Core      | world overview and direct navigation                  | minimap geometry                    |
| Offscreen indicators                                      | Core      | find nearby lost windows without opening a map        | offscreen geometry                  |
| Window switcher                                           | Core      | find by title and state at high window counts         | window presence                     |
| Command center                                            | Core      | discover and run every available action               | contextual descriptors              |
| Touch and pen navigation                                  | Expansion | direct pan, zoom, select, and move on capable devices | input policy requires product proof |

### Spatial organization

| Feature                                           | Priority  | Product result                                                                     | Framework base                                                  |
| ------------------------------------------------- | --------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Split groups                                      | Core      | compose local workstations anywhere in the world                                   | group tree and solver                                           |
| Tab and accordion groups                          | Core      | keep related live tools in one shell without losing identity                       | group layout modes                                              |
| Dock, undock, reorder, resize, equalize, and flip | Core      | full pointer and keyboard group editing                                            | group commands and gestures                                     |
| Named workspaces                                  | Core      | virtual desktops with membership, camera, and selection                            | workspace model                                                 |
| Move complete groups between workspaces           | Core      | preserve local layout as one object                                                | group-complete membership                                       |
| Semantic regions                                  | Core      | name, style, fit, search, and navigate to spatial areas without owning child rects | scene object and spatial target                                 |
| Tags and saved filters                            | Core      | organize content independently of where it appears                                 | product metadata and search                                     |
| Layout recipes                                    | Core      | save and reapply arrangements at any world location                                | recipe capture and apply                                        |
| Project templates                                 | Expansion | create a canvas, content set, workspaces, and recipes together                     | product composition over recipes                                |
| Waypoints                                         | Expansion | save and restore a working view                                                    | camera and selection commands                                   |
| Tours and presentation mode                       | Expansion | tell a live spatial story without exporting dead slides                            | waypoints and camera director                                   |
| Region auto-grow and tidy                         | Expansion | keep named areas readable as content changes                                       | product geometry, promoted only after rules are clear           |
| Columns layout                                    | Frontier  | paper-like strip where appending does not resize existing panes                    | activate after split, tabs, and local scroll prove insufficient |

### Relationships and retrieval

| Feature                                         | Priority  | Product result                                                 | Framework base                                               |
| ----------------------------------------------- | --------- | -------------------------------------------------------------- | ------------------------------------------------------------ |
| Typed semantic relations                        | Core      | connect reusable content with kind and label                   | SurrealDB relation records                                   |
| Canvas connections                              | Core      | choose which views visually present a relation                 | scene paths and spatial edge targets                         |
| Create, reconnect, relabel, reroute, and delete | Core      | complete relationship editing from pointer or command          | spatial target and product commands                          |
| Backlinks and neighborhood inspector            | Core      | see incoming, outgoing, and nearby knowledge                   | graph traversal                                              |
| Lexical search with highlights                  | Spine     | fast offline retrieval                                         | full-text index, runtime-proven                              |
| Kind, tag, canvas, and recency filters          | Core      | narrow retrieval without query syntax                          | indexed metadata                                             |
| Cross-canvas location index                     | Core      | reveal or open every existing view of an item                  | derived view index                                           |
| Saved searches                                  | Expansion | persistent dynamic collections and work queues                 | query records                                                |
| Semantic search                                 | Frontier  | recover conceptually related material missed by lexical search | activate only after labeled retrieval evaluation             |
| Suggested links and clustering                  | Frontier  | propose useful organization with preview and undo              | agent commands; activate after relation workflows are mature |

### Capture, import, and export

| Feature                                  | Priority  | Product result                                                  | Framework base                                 |
| ---------------------------------------- | --------- | --------------------------------------------------------------- | ---------------------------------------------- |
| New note and bookmark actions            | Spine     | create from shell or command center                             | product create command                         |
| URL and plain-text paste                 | Spine     | turn clipboard input into content at the current view           | ArkType input parsing and camera placement     |
| Internal insert tray                     | Core      | drag typed content and tools with exact snapped previews        | typed drop contract                            |
| Native image and PDF drop                | Core      | place external files while keeping preview and commit identical | product adapter, framework candidate           |
| Clipboard files and images               | Core      | paste media without saving a temporary file first               | browser clipboard boundary                     |
| Import status and retry                  | Core      | long work remains visible and recoverable                       | content record lifecycle                       |
| JSON project export and import           | Core      | complete open data backup and migration path                    | database projections plus framework snapshot   |
| Markdown note export and import          | Core      | content remains portable outside Polkadot                       | kind module                                    |
| Static image and PDF canvas export       | Expansion | share a bounded region or tour step                             | deterministic capture path                     |
| Published zoomable canvas                | Expansion | share an interactive read-only spatial artifact                 | read-only route and remote snapshot            |
| Browser capture extension                | Expansion | clip a URL, selection, screenshot, or media into the inbox      | external integration with explicit permissions |
| Video keyframe and PDF highlight capture | Expansion | create medium-specific reusable items                           | kind-specific commands                         |

### Presentation and return navigation

| Feature                                       | Priority  | Product result                                              | Framework base                           |
| --------------------------------------------- | --------- | ----------------------------------------------------------- | ---------------------------------------- |
| Fit window, group, selection, region, and all | Core      | consistent framing for every spatial target                 | camera navigation                        |
| Named waypoint                                | Expansion | return to an authored camera and target state               | product record                           |
| Ordered tour                                  | Expansion | move through live windows and regions in sequence           | camera director                          |
| Presenter mode                                | Expansion | hide editing chrome, show navigation, and keep content live | product shell policy                     |
| Follow presenter                              | Frontier  | participants follow an authored camera stream               | collaboration presence after remote sync |
| Recorded walkthrough                          | Frontier  | time-based narration linked to spatial targets              | media and tour systems must exist first  |

### Agent and automation

| Feature                                      | Priority  | Product result                                                        | Framework base                                 |
| -------------------------------------------- | --------- | --------------------------------------------------------------------- | ---------------------------------------------- |
| Read current canvas and content              | Core      | agent can answer from durable records and live layout                 | database queries and handle                    |
| Discover enabled actions                     | Core      | agent offers only commands valid now                                  | contextual descriptors and app registry        |
| Focus, select, navigate, and arrange         | Core      | visible agent control through canonical commands                      | handle commands                                |
| Create note, bookmark, relation, and view    | Core      | agent adds durable work through validated product commands            | application command registry                   |
| Command receipt and activity                 | Core      | every mutation is inspectable and reportable                          | product receipt                                |
| Preview and confirm destructive or bulk work | Core      | user stays in control of consequential changes                        | command risk policy                            |
| Summarize selected material                  | Expansion | produce a note linked to its sources                                  | optional model boundary plus relations         |
| Tidy or cluster a region                     | Expansion | propose an arrangement, preview it, apply as one reversible operation | recipe and arrange commands                    |
| Build a tour from selected regions           | Expansion | turn spatial work into an editable narrative                          | waypoint commands                              |
| Local-model provider                         | Frontier  | optional private inference without a cloud dependency                 | provider interface and measured runtime        |
| Extension or macro commands                  | Frontier  | reusable automation over stable command contracts                     | activate after the command registry stabilizes |

### Persistence, sharing, and collaboration

| Feature                                        | Priority  | Product result                                                       |
| ---------------------------------------------- | --------- | -------------------------------------------------------------------- |
| IndexedDB-backed SurrealDB worker              | Spine     | offline durable data without main-thread query work                  |
| Autosave with revision checks                  | Spine     | honest saved state and stale-write refusal                           |
| Schema manifest, migration, and recovery shell | Core      | upgrades fail safely and remain inspectable                          |
| Local backups and restore points               | Core      | recover from user and software mistakes                              |
| Single-user remote backup                      | Expansion | encrypted or authenticated cross-device continuity                   |
| Read-only share and publish                    | Expansion | others can inspect without editing authority                         |
| Presence                                       | Expansion | collaborators see who is present without sharing personal view state |
| Shared content editing                         | Expansion | kind-specific collaboration with permissions                         |
| Comments and review markers                    | Expansion | discussion anchors to content, relation, window, or world target     |
| Offline command outbox                         | Expansion | reconnect and replay typed mutations safely                          |
| Shared live layout editing                     | Frontier  | ordered document mutations with personal camera and selection        |

### Quality, accessibility, and maintainability

| Feature                                | Priority  | Product result                                                                    |
| -------------------------------------- | --------- | --------------------------------------------------------------------------------- |
| Product-shaped check and build gates   | Spine     | every daily change proves the actual consumer builds                              |
| Keyboard-only daily workflow           | Core      | create, find, open, edit, arrange, group, switch, and close without pointer       |
| Screen-reader structure and names      | Core      | shell, windows, groups, dialogs, and summaries remain understandable              |
| Reduced motion and high contrast       | Core      | visual polish respects user settings                                              |
| Light and dark themes                  | Core      | token completeness is proven in two distinct looks                                |
| Recovery fixtures                      | Core      | corrupt layout, missing content, failed import, and migration failure stay usable |
| Product performance harness            | Core      | real note, bookmark, group, search, and database paths report p95                 |
| Browser compatibility matrix           | Core      | Chromium baseline with explicit Firefox and Safari behavior                       |
| Reference project and contributor docs | Core      | external maintainers can run, understand, and extend the app                      |
| Content-kind authoring guide           | Expansion | extension points stay small and discoverable                                      |
| Stable fixture and demo data           | Expansion | screenshots, tests, docs, and benchmarks use the same representative project      |

### Deliberate exclusions

| Exclusion                                        | Reason                                                                                 |
| ------------------------------------------------ | -------------------------------------------------------------------------------------- |
| Global dashboard grid                            | conflicts with free placement and local group ownership                                |
| One root tiling tree                             | an infinite world has no monitor boundary                                              |
| Generic shape and freehand whiteboard suite      | creates a second product identity and duplicates mature drawing tools                  |
| Nested live canvas in a window                   | introduces a second camera, input plane, focus model, and command scope                |
| Scene-owned core window UI                       | weakens DOM accessibility and frame/body alignment                                     |
| Always-on AI chat rail                           | consumes space without changing the work; agent value must land as content or commands |
| Mandatory cloud account                          | breaks local ownership and offline completion                                          |
| Generic CRDT across every record                 | content and layout have different merge invariants                                     |
| Rasterization enabled by default                 | adds complexity before a measured product body needs it                                |
| Plugin marketplace before a stable kind contract | freezes the wrong extension boundary                                                   |

## Target application architecture

Polkadot stays one application package until a second real consumer proves a
shared package. Module boundaries exist inside `apps/polkadot`; publishing
several packages now would multiply APIs before the product workflow is known.

```txt
apps/polkadot/
├── surql/
│   ├── manifest.json
│   ├── schema/
│   ├── functions/
│   └── tests/
└── src/
    ├── routes/             TanStack Start route and document shells
    ├── runtime/            client lifecycle and dependency composition
    ├── database/           worker client and typed repository boundaries
    ├── commands/           product command registry, input schemas, receipts
    ├── content/            kind registry and kind-owned modules
    ├── canvas/             store creation, persistence, relations, scene layers
    ├── workspace/          shell, library, command center, inspector
    └── ui/                 product composites over the generic ui package
```

Status: target. The scaffold currently has routes plus
`workspace/workspace-canvas.tsx`.

### Dependency direction

```txt
routes
  -> runtime
      -> database repositories
      -> application commands
      -> content registry
      -> canvas runtime
workspace UI
  -> runtime services + commands
content kind
  -> content contracts + framework window context + generic UI
canvas runtime
  -> @hyphened/infinite-canvas
database repositories
  -> SurrealDB SDK contracts and .surql-owned behavior
```

Routes and components never issue raw SurQL. Repositories never render UI.
Content kinds do not access the global database client; they receive a narrow
content service and canonical commands. The canvas runtime does not interpret
note, bookmark, or media payloads beyond the validated content reference held
by a window.

### Private editor route

The embedded IndexedDB engine is browser-only. The private editor route renders
a deterministic shell on the server, then initializes the database through a
module marked with TanStack Start's `client-only` boundary after hydration. This
prevents server code from importing the WASM engine while preserving a useful
initial document and avoiding hydration races.

Published read-only canvases are a separate later route. They can use server
rendering against a remote snapshot because they do not depend on the private
browser database.

Evidence:

- TanStack Start React documentation, selective SSR and client-only imports,
  retrieved 2026-08-23
- SurrealDB JavaScript SDK WebAssembly engine documentation, IndexedDB and
  worker engines, retrieved 2026-08-23

### End-to-end product spine

```txt
/canvas/$canvasId client route
  -> create runtime
  -> start SurrealDB worker and install manifest
  -> load project, canvas, content, and view index
  -> parse and registry-normalize framework layout
  -> create InfiniteCanvasStore + InfiniteCanvasHandle
  -> render workspace shell
      -> InfiniteCanvas.Provider(store)
          -> InfiniteCanvas.Viewport(registry, overlay, scene layers)
              -> content window body
  -> execute application command
      -> database mutation
      -> canonical framework command
      -> command receipt
  -> observe settled canvas state
  -> snapshot, validate, revision-check, save, refresh view index
```

Every operation in this structure has an owner and a destination. Replacing the
note editor, database transport, or command-center UI does not require deciding
again how records reach windows or how layout changes become durable.

### Framework maturation loop

1. Build the product behavior against current public APIs.
2. Record any product-local adapter and the invariant it must preserve.
3. Measure complexity, duplication, or impossible behavior in a real workflow.
4. Promote only a consumer-neutral capability whose framework ownership is
   established by the evidence.
5. Replace the product adapter with the promoted API and keep the product
   acceptance path as its canonical consumer.

This loop makes Polkadot the framework's production proving ground without
turning every product decision into framework policy.

### Browser witness contract

Browser work uses `agent-browser` in headless mode only. A witness is admitted
only after a terminal request proves the target URL returns the expected HTTP
status. One worktree-scoped session and one tab answer one predeclared product
question, then `agent-browser close` retires the browser. The postcondition is
no active browser session and no owned headless Chrome process. The committed
profile enforces a 15-second idle timeout as a second cleanup boundary.

In-app browser automation is prohibited for this project.

## Delivery sequence

| Milestone                  | Complete outcome                                                                                       | Main feature families             |
| -------------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------- |
| 0. Scaffold                | Start app builds with Legend State, parent-owned canvas, product shell, and one canonical open action  | app scaffold                      |
| 1. Local document          | one project and canvas reload from SurrealDB after layout and content edits                            | database, runtime, note           |
| 2. Daily spine             | create/edit notes, capture bookmarks, search, inspect, duplicate views, and recover failures           | content, command center, autosave |
| 3. Spatial organization    | connect content, group windows, switch workspaces, save recipes, use minimap and offscreen navigation  | relations, groups, navigation     |
| 4. Public beta             | two themes, keyboard workflow, recovery fixtures, product benchmarks, import/export, first-run project | quality and open-source readiness |
| 5. Mixed media             | image and PDF intake, offline assets, extraction, semantic summaries                                   | files and media                   |
| 6. Presentation and agents | waypoints, tours, read/command agent contract, previews, summaries, tidy proposals                     | presentation and automation       |
| 7. Structured tools        | document, time-based media, table, and code capabilities promoted one at a time                        | content expansion                 |
| 8. Frontier                | semantic retrieval, optional remote continuity, shared layout editing, dense GPU objects, columns      | evidence-gated work               |

## Provisional feature coverage map

| Area                | Questions                                                                      | Coverage                                                           | Next evidence                                                      |
| ------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| App scaffold        | Can TanStack Start, Vite+, Legend State, and the framework compose?            | covered through check and build                                    | short runtime witness                                              |
| Product identity    | Is the product a whiteboard, editor, or spatial desktop?                       | strong repository answer                                           | reconcile feature catalogue against the desktop identity           |
| Framework execution | What owns state, interaction, render layers, and commands?                     | covered at the entry spine                                         | inspect product-relevant extension and persistence seams           |
| Content platform    | Which content kinds form the first coherent set?                               | first spine selected: note, bookmark, search, inspector            | specify complete workflows and promotion gates                     |
| Durable data        | What persists separately from the framework layout?                            | core split and save contract runtime-proven                        | implement a worker-backed reload slice after feature research      |
| Navigation          | How do users orient, return, search, and present?                              | framework primitives covered                                       | define waypoints, search, and tour workflows                       |
| Organization        | How do free placement, groups, workspaces, regions, tags, and recipes coexist? | responsibilities separated                                         | prove the first organization workflow                              |
| External input      | Clipboard, URL, native file, and asset-tray behavior                           | unified intent and failure model defined; native gap proven        | implement note, URL, text, and internal drag before files          |
| Search              | Lexical, graph, metadata, and later semantic retrieval                         | lexical and graph paths runtime-proven; semantic retrieval gated   | define command-center result ranking and view index refresh        |
| Collaboration       | Shared state, presence, conflicts, permissions                                 | persistent design pressure mapped; implementation unscheduled      | revisit after local content and spatial capabilities are complete  |
| Agent control       | Read, select, create, arrange, explain, and undo                               | command sources, receipts, and approval boundaries defined         | prove one database plus canvas command end to end                  |
| Visual language     | Frame system, canvas background, scale cues, motion, themes                    | ownership and rules defined                                        | derive tokens and prove both themes in product UI                  |
| Performance         | 100+ windows, culling, LOD, raster policy                                      | budgets and recovery contracts defined; current numbers incomplete | build product-shaped benchmarks with real kinds                    |
| Accessibility       | keyboard session, body focus, groups, summaries                                | substantial framework work exists                                  | current code and structural tests, followed by product shell rules |
| Delivery            | Which slices form the product spine?                                           | open                                                               | complete feature ownership and dependencies first                  |

## Known framework pressure points

These remain candidates. Polkadot must exercise them before requesting a
framework change.

| Pressure point                      | Current evidence                                                                                                             | Product trigger                                                        |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| External native-file drag           | Internal typed drags exist; reference ledger records no external drag state boundary                                         | dropping a file from the operating system into a content creation flow |
| Dense non-window objects            | scene layers and typed spatial targets exist; a general dense-object store does not                                          | thousands of markers, comments, relation handles, or search results    |
| Spatial index                       | snapping and hit tests remain scan-based                                                                                     | measured product layouts where nearby queries dominate work            |
| Animated camera director            | navigation requests are instantaneous                                                                                        | waypoints and tours that require interruptible motion                  |
| Product persistence bridge          | framework provider persists only to local storage unless the product injects and observes its own store                      | SurrealDB-backed load, save, revisions, and later remote sync          |
| Shared versus personal canvas state | the serialized workspace combines membership with camera and selection                                                       | first multi-client layout proof                                        |
| Relationship editing                | connector geometry and edge selection exist; complete create, reconnect, route, label, and delete behavior is consumer-owned | Polkadot's first linked-content workflow                               |
| Asset storage                       | no current application storage authority                                                                                     | imported PDFs, images, audio, and video that must work offline         |
| Raster defaults                     | experimental and unbounded by default                                                                                        | measured large Polkadot spaces with expensive live bodies              |

## Curated references

### Repository authorities

- `README.md`
- `docs/README.md`
- `docs/REQUIREMENTS.md`
- `docs/ROADMAP.md`
- `docs/research/feature-landscape-2026.md`
- `docs/research/acceptance-scenarios.md`
- `docs/research/api-friction-backlog.md`
- `docs/research/body-content-contract.md`
- `docs/research/state-focus-and-recipes.md`
- `docs/research/risk-register.md`
- `packages/infinite-canvas/README.md`
- `packages/infinite-canvas/src/infinite-canvas.tsx` `InfiniteCanvasDesktop`, `InfiniteCanvasViewport`
- `packages/infinite-canvas/src/types.ts` `InfiniteCanvasState`, `InfiniteCanvasCommands`, `InfiniteCanvasWindowDefinition`
- `packages/infinite-canvas/src/store.tsx` `InfiniteCanvasProvider`
- `packages/infinite-canvas/src/canvas-handle.ts` `InfiniteCanvasHandle`
- `packages/infinite-canvas/src/index.ts`
- `apps/playground/src/routes/workflow-board.tsx`
- `apps/playground/src/routes/drop-tray.tsx`
- `apps/playground/src/routes/workspaces.tsx`
- `apps/playground/src/routes/body-content.tsx`
- `apps/playground/src/showcases/command-palette.tsx`
- `apps/playground/src/showcases/minimap.tsx`
- `apps/playground/src/showcases/offscreen-indicators.tsx`

### External authorities read without browser automation

- TanStack Start React documentation, current on 2026-08-23: build from
  scratch, routing, and CLI scaffold guidance
- TanStack CLI repository documentation, current on 2026-08-23: blank React
  Start scaffold flags
- SurrealDB JavaScript SDK documentation snapshot:
  `doc-sdk-javascript/concepts/web-assembly.mdx`
- SurrealDB JavaScript SDK issue 548, IndexedDB support in the 3.x WASM
  architecture: <https://github.com/surrealdb/surrealdb.js/issues/548>
- SurrealDB JavaScript SDK pull request 507, Vite-compatible worker injection:
  <https://github.com/surrealdb/surrealdb.js/pull/507>
- SurrealDB skill guides: `start-new-project.md`,
  `implementation-patterns.md`, `querying-and-modeling.md`, and
  `types-and-codegen.md`

## Unresolved questions and resumption point

The next evidence cycle owns one question: does the injected 2.6.1 worker admit
the local IndexedDB canvas and preserve one new window across reload?

It must resolve:

- begin only after the development server returns HTTP 200
- observe the ready status, create one window, and observe the saved status
- reload once and verify that window remains
- close the headless session and confirm no browser or server process remains
- keep every later product phase closed if any postcondition fails
