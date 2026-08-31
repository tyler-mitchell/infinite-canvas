# Polkadot product plan

Status: active incremental research  
Research date: 2026-08-23  
Repository base: `854c1b859e1e` plus the uncommitted `apps/polkadot` scaffold

## Plan requirements

Polkadot is a production application built on `@hyphened/infinite-canvas`.
This plan defines the product features, execution structure, and data model.
It also defines the product needs that can mature the framework.

The plan answers:

1. What is Polkadot, and what is its primary user workflow?
2. Which durable objects exist, and which framework objects show them?
3. Which content kinds and tools for creation, organization, and navigation
   belong in the product?
4. How do persistence, search, import/export, remote sync, collaboration, and
   agent control fit and preserve the first usable slice?
5. Which behaviors does Polkadot own, and which does the headless framework own?
6. Which implementation order gives each phase a usable product spine?
7. Which observation proves each phase?

The plan must include a prioritized feature catalog, target data model, module
and dependency maps, implementation sequence, and framework feedback ledger.
It must give exit criteria and exact references for each load-bearing decision.

### Product scope

- A local-first, open-source spatial workbench
- Live React applications and content inside canvas windows
- Reusable content in one or more spatial views
- Window groups, workspaces, relationships, navigation, presentation, search,
  automation, and later collaboration
- A desktop shell with consistent visuals and interactions
- Framework changes that a Polkadot requirement justifies.

### Excluded scope

- A framework rewrite before a product requirement proves the need
- Drawing and generic whiteboarding as the product identity
- Selection of a rich-text editor, sync protocol, authentication provider, or
  file backend before the project specifies its owning workflow
- Browser automation for research or diagnosis
- Preservation of an API or schema only because an early scaffold used it.

## Product identity

Polkadot is a spatial desktop for active project work. Each window holds a live
tool or durable content view. The canvas arranges these views. Local groups
form work layouts. Workspaces filter one canvas into named contexts. Search,
waypoints, and commands navigate large spaces.

This product matches the framework's established identity. The repository
describes a spatial window manager. Its main object is a live DOM window.
WebGPU supplies programmable scene content. The framework requirements exclude
whiteboarding, drawing, and document editing. Polkadot supplies editors,
connectors, media, and other product objects as a consumer.

Evidence:

- `README.md:3-9, 20-29`
- `docs/REQUIREMENTS.md:9-44`
- `reference/infinite-canvas/README.md:29-43`.

## Current scaffold

The application has all parts of the initial execution path.

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

The parent owns the canvas store. The framework shows the viewport. The
overlay contains the product chrome. A Legend State observable owns its rail
state. The "New note" control calls the framework's canonical `openWindow`
action.

Proof:

```sh
vp check
# package-local result: formatting, lint, and type checks pass

vp -C apps/polkadot build
# result: TanStack Start client and SSR builds complete
```

The repository toolchain uses Vite+ 0.2.9. Version 0.1.24 built the Start
application but returned 404 for each development route. A generated Start
application and this repository returned HTTP 200 with version 0.2.9. The
upgrade passes the repository check, all 489 framework tests, and all package,
playground, and Polkadot builds.

Status: the headless witness showed the product shell, initial window, library,
and controls. The local database rejected the canvas with the WASM 3.x engine.
Official issue evidence shows that this engine had no viable IndexedDB browser
path. Thus, the browser target uses the compatible 2.6.1 worker engine.
Admission with this target remains unproven. The project pauses browser
automation until the framework-first affordance review ends.

## Current framework capabilities

Current source and canonical consumers expose these product capabilities.

| Product need         | Current authority                                                                      | Product use                                                                                                 | Status   |
| -------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | -------- |
| Parent-owned runtime | `store.tsx` `InfiniteCanvasProviderProps`, `store-injection.test.tsx`                  | Polkadot can own the store and handle, with shell UI outside the framework                                  | observed |
| Live content windows | `types.ts` `InfiniteCanvasWindowDefinition`, `frame-slots.tsx`                         | Each kind can show React DOM with its own chrome and semantic summaries                                     | observed |
| One mutation path    | `types.ts` `InfiniteCanvasCommands`, `commands.ts`                                     | Toolbar, pointer, keyboard, palette, and agents can use the same commands                                   | observed |
| Groups and docking   | `group-tree.ts`, `group-layout.ts`, `group-state.ts`, `group-layer.tsx`                | framework supplies splits, tabs, accordions, docking, reordering, shell movement, and resizing              | observed |
| Workspaces           | `workspace.ts`, `workspace-membership.ts`, `apps/playground/src/routes/workspaces.tsx` | Named virtual desktops can filter one canvas and restore the camera and selection                           | observed |
| Undo and redo        | `history.ts`, interaction checkpoints                                                  | each pointer drag makes one document edit, while camera motion stays outside document history               | observed |
| Layout recipes       | `recipes.ts`, `apps/playground/src/routes/groups.tsx` `RecipeControls`                 | Polkadot can save reusable arrangements and apply them at a world location                                  | observed |
| Spatial targeting    | `spatial-target.ts`, workflow-board and drop-tray routes                               | one hit-order contract covers objects, connections, overlays, window areas, and drops                       | observed |
| Typed drops          | `drop-interaction.ts`, `apps/playground/src/routes/drop-tray.tsx`                      | the preview and commit use the same snapped placement                                                       | observed |
| Connections          | `scene-layer-geometry.ts`, workflow-board route                                        | Product scenes can draw relationships, support selection, and stay outside the window model                 | observed |
| Navigation geometry  | `minimap.ts`, `offscreen.ts`, `camera-navigation.ts`                                   | Pure geometry supports the minimap, offscreen cues, fit, jump, and focus navigation                         | observed |
| Command discovery    | `getInfiniteCanvasContextualCommands`, playground command palette                      | A product command center can list live enablement and navigate to named windows                             | observed |
| Body interaction     | `portal.tsx`, `focus-trap.ts`, body-content and portal routes                          | windows support forms, native scrolling, text selection, menus, and popovers                                | observed |
| Far-zoom meaning     | `detail-level.ts`, `renderSummary`                                                     | Every content kind can replace unreadable bodies with a semantic summary                                    | observed |
| Persistence envelope | `persistence.ts`                                                                       | The framework validates and migrates layout snapshots                                                       | observed |
| Agent handle         | `canvas-handle.ts`                                                                     | Agents and parent-side automation can read snapshots, subscribe to state slices, and use canonical commands | observed |
| Headless styling     | `data-attributes.ts`, `theme.css`, `frame-slots.tsx`                                   | Polkadot can supply its visual identity and keep the framework interaction code                             | observed |

## Draft product object model

The object model remains provisional until the persistence and core-workflow
evidence cycles end.

| Object       | Durable data                                                              | Framework role                                          | Status              |
| ------------ | ------------------------------------------------------------------------- | ------------------------------------------------------- | ------------------- |
| Space        | title, settings, current layout revision                                  | one serialized canvas document                          | inferred            |
| Content item | durable type-specific content and metadata                                | referenced by `window.data`, independent of placement   | inferred            |
| Window       | a spatial view for one content item                                       | `InfiniteCanvasWindow`                                  | observed foundation |
| Group        | a local work layout                                                       | `InfiniteCanvasGroup`                                   | observed foundation |
| Workspace    | camera and selection for a named membership filter                        | `InfiniteCanvasWorkspace`                               | observed foundation |
| Relation     | a typed semantic link between content items                               | product record drawn through connector helpers          | inferred            |
| Connection   | one canvas-specific visual presentation of a relation between two windows | product record drawn and targeted through scene helpers | inferred            |
| Recipe       | reusable arrangement for windows and groups                               | `InfiniteCanvasRecipe` plus product matching rules      | partly observed     |
| Waypoint     | named state for the camera, selection, or target                          | product record applied through camera navigation        | inferred            |
| Tour         | presentation metadata for ordered waypoints                               | product record over waypoints                           | inferred            |
| Asset        | metadata for imported binary or remote media                              | content item reference                                  | unresolved          |

Content and views remain separate. One reused note has two windows and one
content record. A content-record rect binds knowledge to one layout and prevents
reuse.

## Main workflow and content order

The main workflow combines complex project work, different materials, and
active tools:

```txt
capture a source or thought
  -> open it as a live window
  -> read, edit, or operate it in place
  -> arrange it beside related material
  -> connect, group, or assign it to a workspace
  -> retrieve it through search, commands, or a waypoint
  -> turn the live space into an explanation or reusable layout
```

The canonical sample registry shows that window kinds can be tools or content.
Its `control` body uses focus, camera, lifecycle, and open commands in a normal
React window. Thus, Polkadot needs one registry language for durable content
views and live utility windows. It does not need a second panel runtime.

Evidence:

- `apps/playground/src/showcases/sample-layout.tsx:127-328`
- `packages/infinite-canvas/src/types.ts` `InfiniteCanvasWindowDefinition`.

### Content kind sequence

The full product can host many kinds, but the main workflow determines their
order. Each promoted kind needs an edit or use path, semantic summary,
search projection, import/export behavior, and tested body-input policy.

| Tier             | Kind           | User result                                      | Required functions                                                 | Status                        |
| ---------------- | -------------- | ------------------------------------------------ | ------------------------------------------------------------------ | ----------------------------- |
| First spine      | Note           | in-place capture and edit of a thought           | text editing, title, autosave, summary, duplicate view             | accepted direction            |
| First spine      | Bookmark       | keep a source with its URL and metadata          | URL paste, metadata, open externally, optional safe embed, summary | accepted direction            |
| First spine      | Search results | search for an item or window and open it again   | lexical search, keyboard navigation, focus and camera jump         | tool window or command center |
| First spine      | Inspector      | change active-item metadata and relationships    | tags, links, memberships, delete, reveal record                    | shell panel first             |
| Mixed-media tier | Image          | collect and compare visual material              | native-file drop, intrinsic sizing, zoom-safe preview, metadata    | planned                       |
| Mixed-media tier | PDF            | read source material beside notes                | page navigation, text/search bridge, annotation references         | planned                       |
| Mixed-media tier | Audio/video    | review time-based material spatially             | playback preservation, transcript or markers, summary              | planned                       |
| Structured tier  | Document       | develop long-form work                           | block or rich-text editor, outline, export, references             | unresolved editor choice      |
| Structured tier  | Table          | edit records in a spatial view                   | typed columns, sorting, filtering, alternate views                 | planned                       |
| Technical tier   | Code           | keep executable or reference code in context     | syntax, copy, file link, optional execution boundary               | planned                       |
| Composition tier | Canvas link    | move between large spaces and keep them separate | preview, open, backlinks, breadcrumbs                              | planned                       |

The first spine uses Note and Bookmark. Note proves editing and
autosave. Bookmark proves external capture and an embed fallback. Search and
the inspector are product tools for these records. Image and PDF come after
native-file drop and asset storage have an owner.

This order prevents shallow type breadth. Placeholder table, code, PDF, and
media kinds increase registry size but leave the capture-to-return workflow
unfinished.

## Durable data spine

The first data path will use the SurrealDB JavaScript SDK. Its embedded WASM
engine operates in a Web Worker. The official engine supports `indxdb://` for
IndexedDB persistence. Its worker adapter keeps database work off the canvas
thread. Registered remote engines permit a future server connection without a
repository contract change.

Versions on 2026-08-23:

```txt
surrealdb        2.0.8
@surrealdb/wasm  2.6.1

@surrealdb/wasm peer dependency: surrealdb ^2.0.0-0
local surreal binary: 3.2.1
```

The project pins version 2.6.1. The 3.x browser witness failed at the IndexedDB
connection boundary. The upstream 3.x issue records IndexedDB as unavailable.

Version 2.6.1 predates the upstream Vite worker fix. Thus, the workspace carries
the exact `beb9d00` backport. It injects the worker through Vite's `?worker`
loader. The production worker points to the emitted hashed WASM asset. A future
WASM upgrade must prove IndexedDB and worker packaging before it replaces the
pin and patch.

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

The canvas layout remains one framework-owned value. Duplicate database tables
for windows, groups, and workspaces create two writers for the same geometry.
`canvas_document.layout` stores the framework serialization envelope as one
flexible object. Content and relations stay normalized because their identity
and queries apply outside one layout.

The local SurrealDB 3.2.1 database accepted the core schema in memory.

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
revision-checked save. The local parser rejected `FLEXIBLE TYPE object`. The
documentation snapshot shows both orders. `TYPE object FLEXIBLE` is the proven
syntax for this project.

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
durable fields, links, relation shapes, indexes, and the atomic revision check.
The `.surql` schema and framework layout parser remain authoritative. Generated
TypeScript cannot replace these authorities.

The initial reload proof needs one project, one canvas, one note content item,
and one window that references the item. This slice excludes collaboration,
auth, asset blobs, changefeed, and remote conflict resolution.

## Organization and navigation ownership

Each organization concept has one job and cannot share window geometry.

| Concept     | Responsibility                                                      | Window rect ownership                              | Durable owner                                       |
| ----------- | ------------------------------------------------------------------- | -------------------------------------------------- | --------------------------------------------------- |
| Group       | move one local split, tab, or accordion layout as a world object    | framework group tree                               | framework layout snapshot                           |
| Workspace   | filter one canvas by name and restore its camera and selection      | none                                               | framework layout snapshot                           |
| Region      | name an area for meaning, background treatment, fit, and navigation | none by default                                    | product record plus scene representation            |
| Tag         | classify and retrieve content without spatial placement             | none                                               | content metadata or relation                        |
| Recipe      | reusable arrangement applied to existing windows                    | only during application through framework commands | product record containing an `InfiniteCanvasRecipe` |
| Waypoint    | return to named camera and target state                             | none                                               | product record linked to a canvas                   |
| Tour        | give a live explanation through ordered waypoints                   | none                                               | product records over waypoints                      |
| Canvas link | open another canvas document                                        | none                                               | content item linked to another `canvas_document`    |

The framework research defines a group as a local layout boundary. An infinite
world has no natural monitor boundary. Thus, Polkadot excludes one global
tiling tree and dashboard grid. It preserves free placement and permits
structured clusters anywhere.

Evidence:

- `docs/research/grouping-and-docking.md:10-105`
- `packages/infinite-canvas/src/group-tree.ts` `InfiniteCanvasGroupNode`
- `packages/infinite-canvas/src/types.ts` `InfiniteCanvasWorkspace`
- `docs/ROADMAP.md:153-209`.

### Navigation in a large space

Each return path answers a different question.

| User question                             | Product control                                                  | Framework base                                                              |
| ----------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Where is the viewport in the full canvas? | minimap marks the viewport, groups, active item, and selection   | `getInfiniteCanvasMinimapLayout`                                            |
| Which items are near the viewport?        | bounded offscreen indicators with an accurate hidden count       | `getInfiniteCanvasOffscreenIndicators`                                      |
| Where can I find X?                       | command center searches content, windows, canvases, and commands | contextual commands plus window presence                                    |
| How can I restore this work view?         | named waypoint                                                   | camera navigation and selection commands                                    |
| How do I explain this space in order?     | tour with interruptible camera transitions                       | semantic camera requests, with animation in the product or future framework |
| Which work context was active?            | workspace switcher restores the camera and selection             | `InfiniteCanvasWorkspace`                                                   |
| How can I open deeper structure?          | canvas-link window with a route breadcrumb                       | separate canvas documents                                                   |

Nested live canvases remain outside the first architecture. A nested canvas
adds a second camera, input plane, focus model, persistence scope, and command
set. A canvas-link window supplies hierarchy and preview with one active
camera.

### Initial organization workflow

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

Existing framework capabilities or product records support all steps through
workspace assignment. Waypoint capture is the first product-only navigation
value. This workflow can develop the product before another framework capability
is necessary.

## Content intake pipeline

Every intake path must produce one product command. Each path uses the same
rules for records, placement, and errors.

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
`File` stays a prototype-boundary value. `instanceOf` and checks for each kind
validate its size and media type.

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

Content creation and view opening cross two authorities. One database
transaction cannot contain the full operation. An error state keeps the
content record in the library without a view. The user can open it later. A
window with missing content is invalid. It must show an explicit recovery body.

### Input paths

| Input path            | Created value                                 | Initial placement                                    | First tier             |
| --------------------- | --------------------------------------------- | ---------------------------------------------------- | ---------------------- |
| New note button       | intent for a blank note                       | deterministic cascade from the camera center         | first spine            |
| Command center        | content kind with an optional title           | selected region or camera center                     | first spine            |
| URL paste             | trimmed and parsed URL, create bookmark       | known pointer location, otherwise camera center      | first spine            |
| Text paste            | plain text, create note                       | camera center                                        | first spine            |
| Internal tray drag    | typed application payload                     | framework snap preview and the same committed rect   | first spine            |
| Native file drag      | `DataTransfer.files` to validated file intent | product adapter first, framework candidate after use | mixed-media tier       |
| Clipboard file        | clipboard item to validated file intent       | camera center                                        | mixed-media tier       |
| Duplicate view        | id of existing content                        | offset from the source window                        | first spine            |
| Duplicate content     | clone of a content record                     | offset from the source window                        | later explicit command |
| Link existing content | id of existing content                        | selected world point                                 | first spine            |

The current framework drop API accepts a typed payload from `startDrag`. It
resolves one spatial target and calculates one snapped placement. The API draws
guides and passes the same placement to `onDrop`. The 124 package source files
contain no `DataTransfer` reference. Thus, native file drop is a confirmed
product gap.

Evidence:

- `packages/infinite-canvas/src/infinite-canvas.tsx:606-697`
- `packages/infinite-canvas/src/types.ts:540-660`
- `packages/infinite-canvas/src/drop-interaction.ts`
- `apps/playground/src/routes/drop-tray.tsx:140-262`
- Literal Type Atlas scan for `DataTransfer`, 2026-08-23: zero matches in
  `packages/infinite-canvas/src`.

The first native-file implementation stays in the product. It will use the
overlay context's canonical spatial-target resolver and the exported placement
helper. Preview state keeps the calculated placement. The commit uses the same
value. Framework promotion requires a second consumer or proof that the product
must copy framework-owned input lifecycle.

## Commands and agent access

Polkadot needs one command center for framework commands, product commands,
content search, window navigation, and creation actions. Each source remains
separate because it has different availability and input contracts.

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

Status: target. `Type<Input>` represents an ArkType contract. The type
will use the installed API. It will not add an application wrapper for ArkType.

### Sources of commands

| Source                         | Examples                                                          | Availability                                            | Invocation                                               |
| ------------------------------ | ----------------------------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------- |
| Framework descriptor           | focus, arrange, dock, group, workspace, camera, history           | contextual command queries for the current state        | `InfiniteCanvasCommands.executeCommand`                  |
| Parameterized framework action | rename, create workspace, move to a chosen workspace, open window | product supplies the required string, target, or window | typed framework command facade                           |
| Product command                | create content, connect items, capture waypoint, import, export   | application registry with ArkType input                 | service with database ownership and canvas orchestration |
| Search result                  | content, window, canvas, waypoint                                 | SurrealDB query combined with window presence           | canonical commands for focus, open, or navigation        |

The playground command palette proves the framework half. It combines
contextual descriptors with window presence. It restores minimized windows
before navigation. Unavailable commands stay visible and inactive. The palette
returns focus to the canvas after it closes. Polkadot will use this interaction
in its command center.

Polkadot will collect parameters for commands with missing inputs.

Evidence:

- `apps/playground/src/showcases/command-palette.tsx`
- `packages/infinite-canvas/src/commands.ts`
- `packages/infinite-canvas/src/types.ts:1020-1097, 1301-1467`.

### Contract for parents and agents

`createInfiniteCanvasHandle(store)` provides the renderer-free base:

```txt
getState()                 live immutable state
snapshot()                 JSON-safe layout without transient interaction
getContextualCommands()    currently enabled framework commands
commands                   canonical typed mutation facade
subscribe(selector, fn)    settled slice notifications outside tracking context
```

The implementation reads through Legend State but does not expose observables
to the caller. Its subscription queues one microtask and combines batched
commits. It also compares selector identity. The handle is experimental because
spatial queries can join it. Its selected capabilities are stable.

Evidence:

- `packages/infinite-canvas/src/canvas-handle.ts:17-98`
- `packages/infinite-canvas/src/store-injection.test.tsx`
- `packages/infinite-canvas/src/canvas-handle.test.ts`.

The product agent contract adds database queries and application commands to
this handle. It does not send raw reducer actions or edit DOM. It changes
database records only through named commands.

### Agent safety and visible results

| Operation                                  | Default policy                                            | Result                                    |
| ------------------------------------------ | --------------------------------------------------------- | ----------------------------------------- |
| read/search/inspect                        | invoke                                                    | results cite record and canvas identities |
| focus/select/navigate                      | invoke                                                    | camera and selection visibly move         |
| reversible layout command                  | invoke                                                    | framework history receives one entry      |
| create content or relation                 | if placement or targets are ambiguous, preview            | new record and view become selected       |
| bulk mutation                              | require an affected count and preview                     | receipt names all affected ids            |
| delete content                             | require approval unless the user issued the exact command | deletion receipt and recovery policy      |
| export, network fetch, publish, or message | require approval for destination and payload              | durable external-action receipt           |

Every command returns a receipt. It contains the command id, affected record
ids, affected window ids, revision before and after, and undo semantics.
Receipts support activity records and agent reports. They do not form a second
event-sourcing system.

### Undo ownership

Framework history covers windows, groups, workspaces, and their layout
transactions. Editors own content-local undo. A command that creates content
and opens a view crosses both domains. In the first spine, a view undo leaves
the content in the library. Record deletion requires an explicit content
command.

A cross-domain undo stack remains unresolved. Real workflows must show which
compound operations users expect to reverse as one step.

## Visual and interaction rules

The visual system makes different window applications part of one spatial
environment. It uses one set of frame rules, one scale model, and one semantic
token family.
Content kinds can change the body layout, icon, summary, and restrained accent.
They cannot replace the main window controls or interaction cues.

### Ownership of visual layers

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
the product shell. WebGPU owns world geometry and effects that use instancing,
shaders, or camera-synchronized drawing. Main frame chrome stays in the DOM host
beside its body. This location prevents cross-layer drift during camera
movement.

Evidence:

- `packages/infinite-canvas/src/infinite-canvas.tsx:1090-1245`
- `packages/infinite-canvas/src/grid-backdrop.tsx`
- `reference/infinite-canvas/R3F_V10_CAPABILITY_IDEAS.md:180-239, 278-332`.

### Frame rules

| Frame part                 | Required behavior                                                                                    |
| -------------------------- | ---------------------------------------------------------------------------------------------------- |
| Surface                    | quiet opaque or translucent material with stable contrast, while active and selected remain distinct |
| Header                     | drag area, type mark, editable title, state indicators, and standard controls                        |
| Controls                   | same order and meaning across every kind, with unavailable capabilities visibly disabled             |
| Body                       | live React content owned by its kind, with declared scroll, selection, focus, and portal behavior    |
| Active corners and handles | constant screen-space hit size that becomes simpler at summary scale                                 |
| Group shell                | behind members, with visible layout mode and draggable seams, but without another window appearance  |
| Tool window                | denser header and utility body with the same slots and lifecycle                                     |

`renderFrame` remains an override for a semantic variant, such as a
terminal or media lightbox. Ordinary content kinds use the shared frame and
tokens. Different frames weaken focus, control discovery, and theme
completeness.

Evidence:

- `apps/playground/src/routes/custom-frames.tsx`
- `packages/infinite-canvas/src/frame-slots.tsx`
- `packages/infinite-canvas/src/window-frame.tsx`.

### Scale behavior

| Scale    | Window body                                                | Available interaction       |
| -------- | ---------------------------------------------------------- | --------------------------- |
| Full     | full body and chrome                                       | all body and frame controls |
| Summary  | title, icon, state, or count for the kind                  | select, focus, move, expand |
| Overview | use the summary until evidence proves a separate icon lane | navigate and select         |

The framework uses effective screen size and hysteresis to select full or
summary mode. It simplifies framework chrome in the same band. Polkadot must
provide a semantic `renderSummary` for every registered kind. Rasterized small
text cannot replace semantic summaries.

### Theme ownership

The framework stylesheet connects eleven theme values. It derives extended
component tokens from semantic foreground, accent, shadow, raised surface,
muted accent, and accent-surface colors. Consumer CSS proves a full light theme
across normal and portalled content.

Polkadot will define application tokens once. It will map them to the shell and
`--icx-*` contract. The initial design includes dark and light themes. Window
kinds use semantic aliases instead of hardcoded colors. Portals read theme state
from the document root because they mount outside transformed window subtrees.

Temporary hardcoded white and dark fills remain in the scaffold. They document
the scaffold state. The first visual phase must remove them from the target
design system.

Evidence:

- `packages/infinite-canvas/src/theme.css:1-150`
- `packages/infinite-canvas/src/types.ts:450-462`
- `apps/playground/src/canvas-light-theme.css`
- `apps/playground/src/showcases/theme-switcher.tsx`.

### Motion and input

- Direct manipulation has no decorative delay.
- Pointer, wheel, touch, or keyboard input can interrupt camera transitions.
- Docking, snap, selection, and drop previews animate only properties that show
  the state change.
- Content playback and body scroll continue after offscreen culling because
  windows stay mounted.
- A `prefers-reduced-motion` policy disables nonessential transitions and uses
  immediate camera navigation.
- Hover does not contain information that focus cannot expose.
- Pointer thresholds and hit targets stay stable in screen space across zoom.

The 124 framework source files have no `prefers-reduced-motion` rule. Polkadot
owns the first consumer policy. Repeated consumer overrides or a framework
camera animator can justify a later framework motion policy.

### Accessibility baseline

- The product shell has a short and predictable tab order.
- `Tab` from the canvas enters the active window body. `Escape` returns to the
  canvas command surface.
- The command center supports all keyboard navigation. When it closes, it
  restores focus.
- Each content kind declares policies for body focus, text selection, scroll,
  and summary mode.
- Group tabs and accordions keep the framework's roving focus behavior.
- Light and dark themes meet contrast requirements for text, focus, selection,
  guides, and disabled states.
- Tooltips add to accessible names and do not replace them.
- If summary mode removes controls, the command center keeps equivalent
  commands available.

## Performance and recovery budgets

The framework profile found that each camera tick reconciled each live body.
Memoized body output changed 20-window pan from 15.6 fps to 96.9 fps. Drag
changed from 4.4 fps to 58.3 fps in the 2026-06-10 environment. At 80 windows,
pan measured 21.3 fps before later frame memoization and culling work. The later
work exists in the code but has no measurement on representative hardware.

Evidence:

- `docs/research/performance-profile.md`
- `packages/infinite-canvas/src/window-frame.tsx` `isFrameOffscreen`
- `packages/infinite-canvas/src/culling.test.tsx`
- `docs/ROADMAP.md:101-151, 290-354`.

### Product targets

These acceptance targets apply to a declared reference device. They do not
describe the current scaffold.

| Path                      | Acceptance target                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------------- |
| Shell paint               | warm paint in less than 1 second and cold paint in less than 2.5 seconds                    |
| Interactive local canvas  | under 1.5 seconds warm and 3 seconds cold, with database worker startup and layout load     |
| Pan, zoom, and drag       | p95 frame time less than 16.7 ms at 100 simple windows                                      |
| Heavy body isolation      | zero note, PDF, media, or table body reconciliations during camera movement                 |
| Command center open       | visible and ready for keyboard input in less than 50 ms                                     |
| Local lexical search      | first 20 results in less than 100 ms across 10,000 content items                            |
| Local autosave            | enqueue within 250 ms of settled state and become durable within 1 second                   |
| Main-thread database cost | no database task blocks the main thread, and the embedded engine operates in a worker       |
| Import feedback           | durable placeholder or explicit rejection within 100 ms, with later asynchronous extraction |
| Initial client route      | stay less than 200 kB gzip before the lazy database worker and kind-specific editors        |

The scaffold build emits approximately 171.5 kB gzip of JavaScript across the
route and shared entry. It also emits 8.1 kB gzip of CSS. This baseline does not
pass the budget. Route loading and cached shared chunks still need a runtime
trace.

### Runtime requirements

- Window bodies subscribe only to the records and canvas state that they show.
- Overlays can track the camera. Content bodies cannot subscribe to the full
  canvas state.
- Offscreen windows stay mounted. This keeps focus, portals, scroll, playback,
  and uncontrolled inputs.
- Semantic summaries provide readability before rasterization.
- Raster capture stays disabled until a measured body workload proves its need.
- WebGPU scene layers use demand rendering unless a visible feature declares
  an animation budget.
- Search indexes and relation traversal stay in SurrealDB. JavaScript does not
  copy records for filtering.
- Editor and media dependencies load with their window kind. They do not load
  with the initial shell.

### Recovery outcomes

| Error                     | Required outcome                                                                                         |
| ------------------------- | -------------------------------------------------------------------------------------------------------- |
| Invalid framework layout  | framework parser recovers valid windows or opens a recovery view while content records remain intact     |
| Missing content record    | window shows a recoverable missing-content body with remove/relink actions                               |
| Interrupted layout save   | previous revision remains readable, and pending state retries after startup                              |
| Revision conflict         | save refuses a stale revision and shows an explicit conflict path without a hidden last-writer overwrite |
| Failed import             | content placeholder stores the reason and permits retry or removal                                       |
| Failed database migration | app opens a diagnostic recovery shell and does not change the old database further                       |
| WebGPU unavailable        | DOM canvas, windows, groups, navigation, and shell continue without scene enhancements                   |
| Corrupt kind payload      | ArkType reports field problems, and the body shows recovery UI for untrusted `window.data`               |
| Product crash             | last durable local revision opens, and unsaved status does not appear as saved                           |

### Development diagnostics

The product development build needs one bounded diagnostics panel. It reports:

- Current window, group, workspace, and content counts
- Body render counts by kind during the last gesture
- The p50 and p95 frame time for one declared gesture
- Database worker startup, last query, save queue, revision, and last durable
  time
- Live, summary, and raster representation counts
- Scene layer count and active animation policy
- The most recent command receipt and error.

The existing benchmark and raster diagnostics are initial evidence. Product
measurements must use real registries, window sizes, and content bodies. A
synthetic threshold test cannot prove full detail for an ordinary note at 100
percent zoom. It also cannot prove editor isolation from the camera loop.

## Search and relation behavior

The canvas is a view of durable content. Search and backlinks must include an
item without an open window. They must also include items across several
windows and canvases.

### Search fields

When a content kind saves, it produces a bounded lexical projection:

```txt
content_item
├── title          exact identity and title matches
├── search_text    normalized kind-specific body projection
├── tags           structured filters
├── kind           type filter
└── updated_at     recency ordering
```

SurrealDB builds an index for `search_text`. A query does not scan an arbitrary
flexible `content` object. Kind modules own the projection. The note
editor identifies text blocks. The bookmark identifies its host and
description. The PDF pipeline identifies extracted pages.

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

The command center combines these results with current window presence and
canvas metadata:

```txt
result selected
  -> visible view in active workspace: focus and center it
  -> minimized view: restore, focus, and center it
  -> view elsewhere on current canvas: activate its workspace, focus, and center it
  -> view on another canvas: navigate to that canvas and restore its saved context
  -> no existing view: open a new view at the current camera center
```

Cross-canvas location eventually needs a rebuildable `content_view_index` from
saved layout windows. It stores the canvas id, content id, window id, and kind.
It does not store rects or group trees. The framework layout remains the only
geometry authority. The canvas-save transaction refreshes the index. A repair
command rebuilds it from layout snapshots.

### Relations and canvas connections

Content owns each relation. One canvas view owns each connection.

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

This split prevents one permanent pair of window rects for a reusable relation.
A relation can exist without a drawn connection. A canvas can show the same
relation through one selected pair of views. It does not draw every possible
combination.

SurrealDB 3.2.1 accepted the graph record and traversal that follow:

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

### Edit a connection

1. Start at a window port or with a "Connect" command.
2. Show a scene-layer preview from the source rect to the pointer.
3. Use the canonical spatial target pipeline to resolve the destination.
4. If a window body or port is valid, create or select the semantic relation.
5. Create the connection with the exact ids of the source and destination
   windows.
6. Show the path through `getInfiniteCanvasWindowConnectorPath`.
7. Register the path with `createInfiniteCanvasEdgeTargetResolver`. Selection,
   inspection, reconnect, label, route, and delete commands then share one target
   id.

The framework supplies edge hit tests in screen pixels. It also supplies path
geometry, orthogonal-route geometry, scene transforms, label positions, and
non-window selection. The product owns relationship persistence and editing.

Evidence:

- `packages/infinite-canvas/src/spatial-target.ts:215-304`
- `packages/infinite-canvas/src/scene-layer-geometry.ts`
- `apps/playground/src/routes/workflow-board.tsx`.

### Semantic retrieval

Semantic retrieval is an optional later index over content chunks. If a labeled
evaluation shows that lexical search misses important results, semantic
retrieval activates. Embedding generation remains an external or local-model
boundary. Polkadot operates without it. If enabled, SurrealDB owns vector
storage, the vector index, graph filters, permission filters, and hybrid rank
projection. The product command center owns presentation and explicit domain
boosts.

## Remote sync requirements

Local ownership is the build path. Remote behavior adds unscheduled requirements
for identity, revisions, permissions, personal view state, and command
boundaries. It cannot displace the product capabilities that give value to the
local application.

If remote work starts later, features arrive in order of coordination cost:

1. Single-user backup and cross-device sync
2. Published read-only canvases and exports
3. Shared content editing and presence
4. Shared live layout editing.

Each step keeps the local database usable without a network or remote service.
These steps are outside the initial product spine and public-beta critical path.

### Current persistence data

The framework envelope serializes the active window, active workspace, camera,
groups, selection, windows, workspaces, and schema version.
`InfiniteCanvasDocument` defines the undoable subset. This subset contains
windows, groups, workspaces, and the active workspace. A workspace contains
window membership, camera, and selection.

This model supports one user. It is not suitable as a shared multiplayer
record. One person's workspace, camera, selection, and active window cannot
move for all users.

Evidence:

- `packages/infinite-canvas/src/persistence.ts:60-73`
- `packages/infinite-canvas/src/types.ts:289-315, 358-372`
- `packages/infinite-canvas/src/workspace.ts`.

### State ownership split

| Shared project data                  | Personal view data                   | Temporary presence            |
| ------------------------------------ | ------------------------------------ | ----------------------------- |
| durable content records              | active canvas                        | cursor and pointer preview    |
| semantic relation records            | active workspace                     | current gesture               |
| canvas windows and group trees       | camera for each canvas or workspace  | temporary selection broadcast |
| workspace definitions and membership | selection and active window          | typing or editing indicator   |
| explicit canvas connections          | shell preferences                    | temporary user status         |
| recipes and published tours          | command history and recent locations | connection heartbeat          |

The persistence bridge can split the framework envelope for early remote
experiments. It saves shared layout fields to the canvas record. It saves
personal view fields to a user-scoped record. Then it combines both records
before `parseInfiniteCanvasState`. Workspace camera and selection require
explicit mapping because the current framework type bundles them with shared
membership.

This evidence does not request an immediate framework change. A shared-layout
experiment must first prove a consumer adapter for the state split. Repeated
need can justify public serialization helpers for documents and views. It can
also justify a workspace model with separate shared membership and per-user view
state.

### Sync methods

| Need                      | Method                                                              |
| ------------------------- | ------------------------------------------------------------------- |
| connected record updates  | SurrealDB live queries with explicit subscription closure           |
| replayable remote history | bounded `SHOW CHANGES` readers over table changefeeds               |
| offline outgoing work     | typed product commands with idempotency ids in a local outbox       |
| content write conflict    | editor-specific merge protocol or per-record revision check         |
| layout write conflict     | canvas revision check, then a later ordered layout-command protocol |
| permission                | database stores project, canvas, content, and publish policies      |

The outbox stores product commands with ArkType-validated inputs. It excludes
arbitrary SurQL and raw framework actions. A remote acknowledgment stores the
resulting revision and command receipt.

### Merge rules

- Independent content records sync independently.
- When shared editing exists, note or document text uses the selected editor's
  proven collaboration model.
- Semantic relations are database records with normal revision and permission
  rules.
- Camera, selection, and focus stay outside shared layout conflict resolution.
- Field-by-field merges of group trees and window rects break layout invariants.
- Shared layout editing will order named document changes. It will apply them
  through the same framework commands used locally.
- The system rejects a stale full-layout snapshot before it overwrites a newer
  group tree.

### Initial remote proof

Two clients with the same user account open one project. Client A edits a note.
Client B receives the content update through a live query.

Client A moves a window while client B is offline. Client B reconnects and
finds the newer canvas revision. It reloads the shared layout and keeps its
camera and selection. This proof keeps shared concurrent layout editing
disabled.

## Full feature catalog

The priorities have these meanings:

| Priority  | Definition                                                |
| --------- | --------------------------------------------------------- |
| Spine     | required for the first full daily workflow                |
| Core      | required for public beta                                  |
| Expansion | adds to a proven workflow after proof of core reliability |
| Frontier  | evidence-gated research with a named activation condition |

Each feature must pass the same promotion gate:

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

### Application shell and project records

| Feature                              | Priority          | User result                                                               | Current base                               |
| ------------------------------------ | ----------------- | ------------------------------------------------------------------------- | ------------------------------------------ |
| TanStack Start route and SSR shell   | Spine, scaffolded | fast entry with application-owned routes                                  | consumer host                              |
| Parent-owned canvas store and handle | Spine, scaffolded | one runtime serves shell, persistence, commands, and agents               | injected provider and handle               |
| Project library                      | Spine             | project creation, open, rename, copy, archive, and recovery               | product records                            |
| Canvas library                       | Spine             | canvas creation, open, rename, copy, archive, and recovery                | document keys and camera navigation        |
| Recent and recovery views            | Core              | reopen recent work and find import errors or damaged layouts              | product records                            |
| Canvas tabs and route history        | Core              | keep several canvases available and do not nest camera planes             | TanStack Router plus separate stores       |
| Breadcrumbs and canvas links         | Core              | navigate the project and linked-canvas hierarchy                          | route and camera navigation                |
| Preferences                          | Core              | theme, input, motion, density, autosave, and privacy preferences          | policies and tokens                        |
| Offline installation                 | Core              | start and save local work without a network                               | embedded database and Start service worker |
| Responsive shell                     | Core              | use the desktop-first UI on small screens and touch devices               | DOM shell                                  |
| First-run project                    | Core              | learn creation, arrangement, groups, search, and return with real content | commands and seed data                     |

### Content platform

| Feature                              | Priority  | User result                                                                       | Current base                                        |
| ------------------------------------ | --------- | --------------------------------------------------------------------------------- | --------------------------------------------------- |
| Note                                 | Spine     | edit a titled thought with autosave, summary, search, links, and export           | body focus, native text selection, summary          |
| Bookmark                             | Spine     | capture a URL with metadata, safe preview, external open, summary, and search     | typed data in a portal-aware body                   |
| Search results                       | Spine     | search content, windows, canvases, and commands with the keyboard                 | helpers for presence and navigation                 |
| Inspector                            | Spine     | change metadata, tags, relations, memberships, and recovery state                 | overlay or utility window                           |
| Reusable content views               | Core      | show one item in several windows or canvases                                      | separate identities for windows and content         |
| Duplicate view and duplicate content | Core      | choose spatial reuse or a new content copy                                        | canonical open command and product records          |
| Canvas link                          | Core      | see a preview, open another canvas, and use backlinks                             | route navigation from a bookmark-like window        |
| Image                                | Core      | collect and compare offline images with crop metadata and a summary               | body with a native-file adapter                     |
| PDF                                  | Core      | read pages with extracted search text, highlights, and note references            | scroll body and portals stay mounted during culling |
| Document                             | Expansion | write a structured long-form document with an outline and export                  | body for the selected editor                        |
| Audio and video                      | Expansion | keep playback, transcripts, markers, and offscreen state                          | offscreen bodies stay mounted                       |
| Table                                | Expansion | sort, filter, and change typed records through alternate views                    | structured body with data queries                   |
| Code                                 | Expansion | read and copy code with syntax, file links, diffs, and optional bounded execution | editor body with an external execution boundary     |
| Content-kind extension contract      | Expansion | add a kind with schemas, a renderer, summary, search, and commands                | product module contract over the window registry    |

### Canvas controls

| Feature                                                   | Priority  | User result                                               | Current base                               |
| --------------------------------------------------------- | --------- | --------------------------------------------------------- | ------------------------------------------ |
| Pan, zoom, fit, and reset                                 | Spine     | camera navigation over an unbounded world                 | camera commands and policies               |
| Select, multi-select, marquee, and keyboard extension     | Spine     | operate on selection sets without pointer input           | selection model                            |
| Move, resize, pin, minimize, maximize, restore, and close | Spine     | control the full desktop window lifecycle                 | command facade                             |
| Snap guides and hysteresis                                | Spine     | placement with screen-space-stable snap behavior          | snap resolver and overlays                 |
| Align, distribute, swap, nudge, and named placement       | Core      | organize with no manual adjustment of each rect           | arrangement commands                       |
| Undo and redo for layout                                  | Core      | reverse or reapply a spatial edit                         | framework history                          |
| Minimap                                                   | Core      | see the full world and navigate it directly               | minimap geometry                           |
| Offscreen indicators                                      | Core      | find nearby lost windows while the map stays closed       | offscreen geometry                         |
| Window switcher                                           | Core      | find a window by title and state in a large canvas        | current window presence                    |
| Command center                                            | Core      | discover and invoke every available action                | contextual descriptors                     |
| Touch and pen navigation                                  | Expansion | pan, zoom, select, and move directly on supported devices | product proof must define the input policy |

### Spatial structures

| Feature                                           | Priority  | User result                                                                         | Current base                                                    |
| ------------------------------------------------- | --------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Split groups                                      | Core      | build a local workstation at any world position                                     | group tree with its solver                                      |
| Tab and accordion groups                          | Core      | keep related live tools in one shell and preserve identity                          | group layout modes                                              |
| Dock, undock, reorder, resize, equalize, and flip | Core      | edit all group properties with pointer or keyboard                                  | group gestures and commands                                     |
| Named workspaces                                  | Core      | use virtual desktops with membership, camera, and selection                         | workspace model                                                 |
| Move whole groups between workspaces              | Core      | preserve local layout as one object                                                 | group-complete membership                                       |
| Semantic regions                                  | Core      | name, style, fit, search, and navigate to spatial areas that do not own child rects | scene object and spatial target                                 |
| Tags and saved filters                            | Core      | organize content independently from its location                                    | search over product metadata                                    |
| Layout recipes                                    | Core      | save an arrangement and apply it at any world position                              | recipe capture and application                                  |
| Project templates                                 | Expansion | create a canvas, content set, workspaces, and recipes in one operation              | product composition over recipes                                |
| Waypoints                                         | Expansion | save a work view and restore it                                                     | commands for the camera and selection                           |
| Tours and presentation mode                       | Expansion | show live windows and regions in order                                              | waypoints and camera director                                   |
| Region auto-grow and tidy                         | Expansion | keep named areas readable as content changes                                        | product geometry after the product defines the rules            |
| Columns layout                                    | Frontier  | paper-like strip where new items do not resize existing panes                       | activate after split, tabs, and local scroll prove insufficient |

### Relations and retrieval

| Feature                                         | Priority  | User result                                             | Current base                                       |
| ----------------------------------------------- | --------- | ------------------------------------------------------- | -------------------------------------------------- |
| Typed semantic relations                        | Core      | connect reusable content with a relation kind and label | SurrealDB relation records                         |
| Canvas connections                              | Core      | choose which views show a relation                      | scene paths and spatial edge targets               |
| Create, reconnect, relabel, reroute, and delete | Core      | all relationship editing from pointer or command        | spatial target and product commands                |
| Backlinks and neighborhood inspector            | Core      | inspect incoming, outgoing, and nearby content          | graph traversal                                    |
| Lexical search with highlights                  | Spine     | retrieve local content quickly with highlighted matches | runtime-proven full-text index                     |
| Kind, tag, canvas, and recency filters          | Core      | filter results without query syntax                     | indexes over metadata                              |
| Cross-canvas location index                     | Core      | show or open each view of an item                       | derived index of views                             |
| Saved searches                                  | Expansion | keep dynamic collections and work queues                | stored query records                               |
| Semantic search                                 | Frontier  | find related content that lexical search misses         | activate after a labeled retrieval evaluation      |
| Suggested links and clustering                  | Frontier  | propose organization with preview and undo              | agent commands after relation workflows are mature |

### Content capture and transfer

| Feature                                  | Priority  | User result                                                  | Current base                                   |
| ---------------------------------------- | --------- | ------------------------------------------------------------ | ---------------------------------------------- |
| New note and bookmark actions            | Spine     | create a note or bookmark from the shell or command center   | product command for creation                   |
| URL and plain-text paste                 | Spine     | create content from clipboard input at the current view      | ArkType parsing with camera placement          |
| Internal insert tray                     | Core      | drag typed content or tools with an exact snap preview       | typed drop contract                            |
| Native image and PDF drop                | Core      | place external files with identical preview and commit       | product adapter, framework candidate           |
| Clipboard files and images               | Core      | paste media with no temporary file                           | browser clipboard boundary                     |
| Import status and retry                  | Core      | see long import work and recover it                          | lifecycle of a content record                  |
| JSON project export and import           | Core      | full open-data backup and migration path                     | database projections plus framework snapshot   |
| Markdown note export and import          | Core      | move note content between Polkadot and Markdown              | note-kind module                               |
| Static image and PDF canvas export       | Expansion | share a bounded region or one tour step                      | deterministic path for capture                 |
| Published zoomable canvas                | Expansion | share an interactive, read-only canvas                       | remote snapshot on a read-only route           |
| Browser capture extension                | Expansion | add a URL, selection, screenshot, or media item to the inbox | external integration with explicit permissions |
| Video keyframe and PDF highlight capture | Expansion | create reusable items for each media kind                    | commands owned by each kind                    |

### Presentation and saved views

| Feature                                       | Priority  | User result                                              | Current base                         |
| --------------------------------------------- | --------- | -------------------------------------------------------- | ------------------------------------ |
| Fit window, group, selection, region, and all | Core      | frame each type of spatial target in the same way        | camera navigation                    |
| Named waypoint                                | Expansion | return to saved camera and target state                  | waypoint product record              |
| Ordered tour                                  | Expansion | visit live windows and regions in a set order            | camera director                      |
| Presenter mode                                | Expansion | hide edit chrome, show navigation, and keep content live | product shell policy                 |
| Follow presenter                              | Frontier  | receive an authored camera stream                        | presence after remote sync           |
| Recorded walkthrough                          | Frontier  | link timed narration to spatial targets                  | requires both media and tour systems |

### Agent commands and automation

| Feature                                      | Priority  | User result                                                   | Current base                                  |
| -------------------------------------------- | --------- | ------------------------------------------------------------- | --------------------------------------------- |
| Read current canvas and content              | Core      | agent answers from durable records and the live layout        | handle with database queries                  |
| Discover enabled actions                     | Core      | agent offers only commands valid in the current state         | contextual descriptors and app registry       |
| Focus, select, navigate, and arrange         | Core      | see each agent action through canonical commands              | commands on the handle                        |
| Create note, bookmark, relation, and view    | Core      | agent adds durable content through validated product commands | registry of application commands              |
| Command receipt and activity                 | Core      | inspect and report each mutation                              | product command receipt                       |
| Preview and approve destructive or bulk work | Core      | user stays in control of consequential changes                | command risk policy                           |
| Summarize selected material                  | Expansion | create a note with links to its sources                       | relations with an optional model boundary     |
| Tidy or cluster a region                     | Expansion | preview a proposal and apply it as one reversible operation   | recipe and arrangement commands               |
| Build a tour from selected regions           | Expansion | create an editable tour from spatial work                     | waypoint commands                             |
| Local-model provider                         | Frontier  | use private inference without a required cloud service        | provider interface with measured runtime      |
| Extension or macro commands                  | Frontier  | reuse automation through stable command contracts             | activate after command-registry stabilization |

### Persistence and remote access

| Feature                                        | Priority  | User result                                                              |
| ---------------------------------------------- | --------- | ------------------------------------------------------------------------ |
| IndexedDB-backed SurrealDB worker              | Spine     | keep data offline and durable, with queries off the main thread          |
| Autosave with revision checks                  | Spine     | saved status matches durable state and refuses stale writes              |
| Schema manifest, migration, and recovery shell | Core      | failed upgrades keep prior data unchanged and inspectable                |
| Local backups and restore points               | Core      | recover data after user or software errors                               |
| Single-user remote backup                      | Expansion | keep authenticated or encrypted data across devices                      |
| Read-only share and publish                    | Expansion | others can inspect with read-only authority                              |
| Presence                                       | Expansion | collaborators see who is present while personal view state stays private |
| Shared content editing                         | Expansion | edit shared content through kind-specific collaboration and permissions  |
| Comments and review markers                    | Expansion | attach discussions to content, relations, windows, or world targets      |
| Offline command outbox                         | Expansion | reconnect and replay typed mutations with idempotency                    |
| Shared live layout editing                     | Frontier  | order document mutations while each user keeps camera and selection      |

### Product quality and accessibility

| Feature                                | Priority  | Required result                                                                   |
| -------------------------------------- | --------- | --------------------------------------------------------------------------------- |
| Product-shaped check and build gates   | Spine     | each daily change proves that the product consumer builds                         |
| Keyboard-only daily workflow           | Core      | create, find, open, edit, arrange, group, switch, and close with no pointer       |
| Screen-reader structure and names      | Core      | expose clear shell, window, group, dialog, and summary structure                  |
| Reduced motion and high contrast       | Core      | visual polish respects user preferences                                           |
| Light and dark themes                  | Core      | prove all tokens through two distinct themes                                      |
| Recovery fixtures                      | Core      | keep corrupt layouts, missing content, import errors, and migration errors usable |
| Product performance harness            | Core      | report p95 for note, bookmark, group, search, and database paths                  |
| Browser compatibility matrix           | Core      | define a Chromium baseline and exact Firefox and Safari behavior                  |
| Reference project and contributor docs | Core      | external maintainers can start, understand, and extend the app                    |
| Content-kind authoring guide           | Expansion | document a small set of discoverable extension points                             |
| Stable fixture and demo data           | Expansion | use one representative project for screenshots, tests, docs, and benchmarks       |

### Excluded designs

| Excluded design                                                      | Reason                                                                                      |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Global dashboard grid                                                | replaces free placement and local group ownership                                           |
| One root tiling tree                                                 | cannot map to a monitor boundary in an infinite world                                       |
| Generic shape and freehand whiteboard suite                          | adds a second product identity and copies established drawing tools                         |
| Nested live canvas in a window                                       | adds another camera, input plane, focus model, and command scope                            |
| Scene-owned core window UI                                           | reduces DOM accessibility and frame-to-body alignment                                       |
| Always-on AI chat rail                                               | consumes space without changing the work, while agent value must become content or commands |
| Mandatory cloud account                                              | removes local ownership and offline completion                                              |
| Generic CRDT across every record                                     | ignores the different merge invariants of content and layout                                |
| Rasterization enabled by default                                     | adds machinery before measurements show that a product body needs it                        |
| Plugin marketplace before the kind contract passes its exit criteria | freezes the wrong extension boundary                                                        |

## Target application architecture

Polkadot stays one application package until a second real consumer proves a
shared package. Module boundaries exist inside `apps/polkadot`. Several
published packages multiply APIs before the product workflow is known.

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

Status: target. The scaffold has routes plus
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

Routes and components do not issue raw SurQL. Repositories contain no UI
rendering.
Content kinds do not access the global database client. They receive a narrow
content service and canonical commands. The canvas runtime does not interpret
note, bookmark, or media payloads. It reads only the validated content reference
in a window.

### Private editor route

The embedded IndexedDB engine is browser-only. The private editor route returns
a deterministic shell from the server. After hydration, a module with TanStack
Start's `client-only` boundary initializes the database. This boundary keeps
the WASM engine out of server imports. It also preserves the initial
document and prevents hydration races.

Published read-only canvases use a separate later route. The server can render
them from a remote snapshot because they do not depend on the private browser
database.

Evidence:

- TanStack Start React documentation, selective SSR and client-only imports,
  retrieved 2026-08-23
- SurrealDB JavaScript SDK WebAssembly engine documentation, IndexedDB and
  worker engines, retrieved 2026-08-23.

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

Each operation in this structure has an owner and a destination. A replacement
for the note editor, database transport, or command-center UI keeps the same
record and layout paths.

### Framework promotion loop

1. Build the product behavior against current public APIs.
2. Record any product-local adapter and the invariant it must preserve.
3. Measure complexity, duplication, or impossible behavior in a real workflow.
4. Promote only a consumer-neutral capability whose framework ownership is
   established by the evidence.
5. Replace the product adapter with the promoted API and keep the product
   acceptance path as its canonical consumer.

This loop uses Polkadot to prove framework behavior in production. Product
decisions do not automatically become framework policy.

### Browser witness contract

Browser work uses `agent-browser` in headless mode only. A terminal request must
first prove that the target URL returns the expected HTTP status. One
worktree-scoped session and one tab answer one declared product question. Then
`agent-browser close` closes the browser. The postcondition permits no active
browser session or owned headless Chrome process. The committed profile also
enforces a 15-second idle timeout as a second cleanup boundary.

This project prohibits in-app browser automation.

## Delivery sequence

| Milestone                  | Milestone outcome                                                                                      | Main feature families             |
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

| Area                | Questions                                                                      | Coverage                                                           | Next evidence                                                                 |
| ------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| App scaffold        | Can TanStack Start, Vite+, Legend State, and the framework compose?            | covered through check and build                                    | short runtime witness                                                         |
| Product identity    | Is the product a whiteboard, editor, or spatial desktop?                       | repository evidence identifies a spatial desktop                   | reconcile the feature catalog with the desktop identity                       |
| Framework execution | What owns state, interaction, render layers, and commands?                     | covered at the entry spine                                         | inspect product-relevant extension and persistence seams                      |
| Content platform    | Which content kinds form the first usable set?                                 | first spine selects note, bookmark, search, and inspector          | specify full workflows and promotion gates                                    |
| Durable data        | What persists separately from the framework layout?                            | core split and save contract runtime-proven                        | implement a worker-backed reload slice after feature research                 |
| Navigation          | How do users orient, return, search, and give presentations?                   | framework primitives covered                                       | define waypoints, search, and tour workflows                                  |
| Organization        | How do free placement, groups, workspaces, regions, tags, and recipes coexist? | responsibilities separated                                         | prove the first organization workflow                                         |
| External input      | Clipboard, URL, native file, and asset-tray behavior                           | unified intent and error model defined, native gap proven          | implement note, URL, text, and internal drag before files                     |
| Search              | Lexical, graph, metadata, and later semantic retrieval                         | lexical and graph paths runtime-proven, semantic retrieval gated   | define command-center result ranking and view index refresh                   |
| Collaboration       | Shared state, presence, conflicts, permissions                                 | persistent requirements mapped, implementation unscheduled         | revisit after local content and spatial capabilities pass their exit criteria |
| Agent control       | Read, select, create, arrange, explain, and undo                               | command sources, receipts, and approval boundaries defined         | prove one database plus canvas command end to end                             |
| Visual language     | Frame system, canvas background, scale cues, motion, themes                    | ownership and rules defined                                        | derive tokens and prove both themes in product UI                             |
| Performance         | 100+ windows, culling, LOD, raster policy                                      | budgets and recovery contracts defined, current numbers incomplete | build product-shaped benchmarks with real kinds                               |
| Accessibility       | keyboard session, body focus, groups, summaries                                | substantial framework work exists                                  | current code and structural tests, followed by product shell rules            |
| Delivery            | Which slices form the product spine?                                           | open                                                               | complete feature ownership and dependencies first                             |

## Known framework change candidates

These items remain candidates. Polkadot must exercise each item before it
requests a framework change.

| Candidate                           | Current evidence                                                                                                    | Product trigger                                                            |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| External native-file drag           | Internal typed drags exist, but the reference ledger records no external drag state boundary                        | operating-system file drop into a content creation flow                    |
| Dense non-window objects            | scene layers and typed spatial targets exist, but a general dense-object store does not                             | thousands of markers, comments, relation handles, or search results        |
| Spatial index                       | snapping and hit tests remain scan-based                                                                            | measured product layouts where nearby queries dominate work                |
| Animated camera director            | navigation requests are instantaneous                                                                               | waypoints and tours that require interruptible motion                      |
| Product persistence bridge          | framework provider persists only to local storage unless the product injects and observes its own store             | SurrealDB-backed load, save, revisions, and later remote sync              |
| Shared versus personal canvas state | the serialized workspace combines membership with camera and selection                                              | first multi-client layout proof                                            |
| Relationship editing                | connector geometry and edge selection exist. The consumer owns create, reconnect, route, label, and delete behavior | Polkadot's first linked-content workflow                                   |
| Asset storage                       | no current application storage authority                                                                            | imported PDFs, images, audio, and video that must remain available offline |
| Raster defaults                     | experimental and unbounded by default                                                                               | measured large Polkadot spaces with expensive live bodies                  |

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
- `apps/playground/src/showcases/offscreen-indicators.tsx`.

### External authorities read without browser automation

- TanStack Start React documentation, current on 2026-08-23, with build,
  routing, and CLI scaffold guidance
- TanStack CLI repository documentation, current on 2026-08-23, with blank
  React Start scaffold flags
- SurrealDB JavaScript SDK documentation snapshot:
  `doc-sdk-javascript/concepts/web-assembly.mdx`
- SurrealDB JavaScript SDK issue 548, IndexedDB support in the 3.x WASM
  architecture: <https://github.com/surrealdb/surrealdb.js/issues/548>
- SurrealDB JavaScript SDK pull request 507, Vite-compatible worker injection:
  <https://github.com/surrealdb/surrealdb.js/pull/507>
- SurrealDB skill guides: `start-new-project.md`,
  `implementation-patterns.md`, `querying-and-modeling.md`, and
  `types-and-codegen.md`.

## Unresolved questions and resumption point

The next evidence cycle answers one question. Does the injected 2.6.1 worker
admit the local IndexedDB canvas and preserve one new window across reload?

It must resolve:

- Begin only after the development server returns HTTP 200.
- Observe the ready status.
- Create one window and observe the saved status.
- Reload once and make sure that the window remains.
- Close the headless session.
- Make sure that no browser or server process remains.
- If a postcondition fails, keep each later product phase closed.
