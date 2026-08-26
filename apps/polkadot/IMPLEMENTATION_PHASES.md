# Polkadot implementation phases

Product authority: [`PRODUCT_PLAN.md`](./PRODUCT_PLAN.md)  
Stack: TanStack Start, React 19, Legend State 3, Vite+, Tailwind 4,
`@hyphened/infinite-canvas`, ArkType, SurrealDB WASM and IndexedDB  
Estimated core through public beta: about 52 agent-hours  
Estimated expansion phases: about 44 agent-hours  
Expected human review: 5 to 10 minutes at each milestone boundary

Each phase fits one focused implementation session. File lists are target paths
and may shrink when an existing module already owns the behavior. A phase must
split before it exceeds eight touched files or four hours of implementation and
verification.

## Phase 0: application scaffold

Type: Infrastructure  
Status: complete  
Estimated: completed in the onboarding session  
Files: `package.json`, `pnpm-workspace.yaml`, `vite.config.ts`,
`apps/polkadot/package.json`, `apps/polkadot/vite.config.ts`,
`apps/polkadot/tsconfig.json`, `apps/polkadot/src/routes/*`,
`apps/polkadot/src/workspace/workspace-canvas.tsx`

Tasks:

- [x] Generate an official blank TanStack Start React application.
- [x] Integrate it into the root pnpm and Vite+ workspace.
- [x] Add Legend State, the headless framework, Tailwind, Geist, and the generic UI package.
- [x] Mount a parent-owned canvas store through the compound provider and viewport API.
- [x] Add product-owned shell chrome and one canonical `openWindow` action.
- [x] Keep the route shell server-renderable and reserve a client-only module boundary for the future browser database.

Verification:

- [x] `vp check` passes in `apps/polkadot`.
- [x] `vp run polkadot#build` completes client and server builds.
- [ ] Scheduled browser witness shows the shell, initial note, rail toggle, and new note action.

Exit: the app has a real framework-backed execution path and can receive product services.

## Phase 1: database corpus and browser worker

Type: Database  
Status: in progress  
Estimated: 3 hours, 10 minutes human review  
Files: `surql/manifest.json`, `surql/schema/001_core.surql`, `surql/functions/001_canvas.surql`,
`surql/tests/001_core.surql`, `src/database/database.client.ts`,
`apps/polkadot/vite.config.ts`, `apps/polkadot/package.json`,
`patches/@surrealdb__wasm@2.6.1.patch`, `pnpm-workspace.yaml`

Tasks:

- [x] Add compatible `surrealdb` and `@surrealdb/wasm` versions through the workspace catalog.
- [x] Create the project-local SurQL manifest and the project, canvas, content, and relation schema.
- [x] Add the revision-checked canvas save function.
- [x] Start the IndexedDB engine inside the official WASM worker adapter.
- [x] Keep the WASM package out of Vite dependency optimization and out of server imports.
- [x] Add a disposable schema, create, query, relation, and stale-revision proof.
- [x] Pin the 2.6.1 worker engine after the 3.x IndexedDB path failed its browser witness.
- [x] Backport upstream Vite worker injection and import the worker through `?worker`.

Verification:

- [x] `surql_validate` accepts the corpus with strict corpus checks.
- [x] The local SurrealDB runtime executes the manifest and proof file.
- [ ] A browser worker opens `indxdb://polkadot`, writes a record, reloads, and reads it.
- [x] A stale `fn::save_canvas` revision returns no update.
- [x] The database worker is absent from the initial main-thread route chunk.
- [x] The production worker resolves Vite's emitted hashed WASM asset.

Exit: a browser-owned database runs off the main thread and enforces the first durable contracts.

## Phase 2: runtime load and canvas hydration

Type: Integration  
Estimated: 3.5 hours, 5 minutes human review  
Files: `src/runtime/runtime.client.ts`, `src/runtime/runtime-context.tsx`,
`src/database/project-repository.ts`, `src/database/canvas-repository.ts`,
`src/canvas/canvas-store.ts`, `src/routes/index.tsx`,
`src/routes/canvas.$canvasId.tsx`

Tasks:

- [ ] Compose the database, repositories, window registry, canvas store, and canvas handle in one client runtime.
- [ ] Load or create the first project and canvas.
- [ ] Parse the saved layout with the framework parser and normalize it against the registry.
- [ ] Render deterministic loading, ready, empty, and database-failure states.
- [ ] Route `/` to the most recent canvas and `/canvas/$canvasId` to one runtime instance.
- [ ] Ensure route changes dispose subscriptions, database resources, and store references.

Verification:

- [ ] A new database creates one project and canvas and opens it.
- [ ] A saved canvas reloads with the same camera, windows, groups, and workspaces.
- [ ] A malformed layout opens recovery UI while valid content remains queryable.
- [ ] Two canvas routes never share a store instance.
- [ ] Navigating away and back does not duplicate a database or handle subscription.

Exit: route identity reaches one loaded, validated, parent-owned canvas runtime.

## Phase 2b: project and canvas library

Type: UI  
Estimated: 3 hours, 10 minutes human review  
Files: `src/workspace/project-library.tsx`, `src/workspace/canvas-library.tsx`,
`src/workspace/canvas-tabs.tsx`, `src/commands/project-commands.ts`,
`src/commands/canvas-commands.ts`, `src/workspace/project-library.test.tsx`

Tasks:

- [ ] Create, open, rename, duplicate, archive, restore, and permanently remove projects.
- [ ] Create, open, rename, duplicate, archive, restore, and permanently remove canvases.
- [ ] Add recent and recovery collections with explicit empty and failure states.
- [ ] Keep several canvas routes available as tabs without sharing stores.
- [ ] Add route breadcrumbs and browser back/forward behavior.
- [ ] Require explicit confirmation and record counts before permanent removal.

Verification:

- [ ] Every lifecycle command changes one database authority and returns a receipt.
- [ ] Duplicate canvas copies layout and view references while preserving shared content identity.
- [ ] Archive is reversible and permanent removal follows the declared content-retention policy.
- [ ] Tab and browser navigation dispose and restore runtimes without duplicate subscriptions.
- [ ] The last-opened canvas becomes the deterministic root-route destination.

Exit: users can manage the project and canvas documents that contain the daily workflow.

## Phase 3: note content spine

Type: UI  
Estimated: 4 hours, 10 minutes human review  
Files: `src/content/content-types.ts`, `src/content/content-registry.ts`,
`src/content/note/note-schema.ts`, `src/content/note/note-service.ts`,
`src/content/note/note-window.tsx`, `src/commands/create-note.ts`,
`src/workspace/workspace-canvas.tsx`

Tasks:

- [ ] Define ArkType input and output contracts for content references and notes.
- [ ] Derive host TypeScript types from the runtime contracts.
- [ ] Add a note repository path and kind-owned search projection.
- [ ] Replace the scaffold note with an editable, autosaving note body.
- [ ] Provide full and summary representations plus body focus, text selection, and scrolling policy.
- [ ] Create a note through one application command, then open its window through the framework command facade.
- [ ] Render an explicit missing or invalid content recovery body.

Verification:

- [ ] Create, edit, reload, rename, and close a note without losing content.
- [ ] Opening a second view of one note reflects the same durable content.
- [ ] Zooming to summary and back preserves editor state.
- [ ] Camera movement causes no note body reconciliation.
- [ ] Keyboard entry, tab containment, escape, and canvas shortcuts remain coherent.

Exit: one durable content record reaches a live, searchable, reusable spatial view end to end.

## Phase 4: canvas autosave and recovery

Type: Integration  
Estimated: 3 hours, 5 minutes human review  
Files: `src/canvas/canvas-persistence.ts`, `src/database/canvas-repository.ts`,
`src/runtime/runtime.client.ts`, `src/workspace/recovery-shell.tsx`,
`src/canvas/canvas-persistence.test.ts`, `surql/functions/001_canvas.surql`

Tasks:

- [ ] Subscribe to settled canvas state through the parent-held handle.
- [ ] Debounce only after interactions finish and serialize with `handle.snapshot()`.
- [ ] Validate the outgoing host projection and save with an expected revision.
- [ ] Refresh the rebuildable content-view index in the same database transaction.
- [ ] Expose pending, saved, failed, retrying, and conflicted status in the shell.
- [ ] Add recovery for stale revisions, missing content, and invalid framework payloads.

Verification:

- [ ] Move, resize, group, switch workspace, reload, and compare canonical state.
- [ ] One drag creates one durable save after the gesture, never one per frame.
- [ ] A stale revision cannot overwrite a newer group tree.
- [ ] A simulated write failure leaves the prior revision readable and retries once.
- [ ] The UI never reports saved before the database acknowledges the revision.

Exit: layout and content survive reload with honest status and explicit failure recovery.

## Phase 5: application command registry and command center

Type: UI  
Estimated: 4 hours, 10 minutes human review  
Files: `src/commands/command-types.ts`, `src/commands/command-registry.ts`,
`src/commands/command-context.ts`, `src/commands/command-receipt.ts`,
`src/workspace/command-center.tsx`, `src/workspace/workspace-canvas.tsx`,
`src/commands/command-center.test.tsx`

Tasks:

- [ ] Define ArkType-backed product command inputs, risk, availability, and receipts.
- [ ] Adapt framework contextual descriptors into the shared command-center row model.
- [ ] Add content, canvas, creation, and navigation command groups.
- [ ] Support parameter collection for titles, target workspaces, and content kinds.
- [ ] Restore focus to the canvas after closing and preserve input shortcut guards.
- [ ] Keep unavailable framework commands visible and explained.
- [ ] Record the last command receipt for activity and agent reporting.

Verification:

- [ ] `Mod+K`, search, arrow navigation, Enter, and Escape form a complete keyboard flow.
- [ ] Framework and product commands execute through their canonical owners.
- [ ] Disabled commands cannot run and state why.
- [ ] Parameterized commands cannot execute with missing or invalid inputs.
- [ ] Closing the center restores canvas hotkeys.

Exit: every current action is discoverable from one keyboard-first product surface.

## Phase 6: lexical search and window navigation

Type: Database  
Estimated: 3 hours, 5 minutes human review  
Files: `surql/schema/002_search.surql`, `surql/tests/002_search.surql`,
`src/database/search-repository.ts`, `src/content/search-projection.ts`,
`src/workspace/command-center.tsx`, `src/workspace/window-switcher.tsx`

Tasks:

- [ ] Install the full-text analyzer and content search index.
- [ ] Generate kind-owned search text at save boundaries.
- [ ] Query bounded highlighted results with kind, tag, canvas, and recency filters.
- [ ] Merge results with live window presence and canvas metadata.
- [ ] Restore minimized windows, switch workspace when needed, and navigate to existing views.
- [ ] Open a new view when content has no current location.

Verification:

- [ ] Title and body matches return useful highlights.
- [ ] Search meets the 100 ms target over a 10,000-item fixture.
- [ ] Selecting visible, minimized, other-workspace, other-canvas, and unopened results follows the specified path.
- [ ] Camera movement does not re-run database search.
- [ ] Empty and failed queries remain keyboard navigable.

Exit: users can find and return to durable content independently of current layout.

## Phase 7: bookmark capture and clipboard intake

Type: Integration  
Estimated: 3 hours, 10 minutes human review  
Files: `src/content/bookmark/bookmark-schema.ts`,
`src/content/bookmark/bookmark-service.ts`,
`src/content/bookmark/bookmark-window.tsx`, `src/commands/create-bookmark.ts`,
`src/workspace/clipboard-intake.ts`, `src/content/bookmark/bookmark.test.tsx`

Tasks:

- [ ] Parse URL, plain-text, and blank bookmark inputs through ArkType.
- [ ] Store URL identity, title, description, host, fetch status, and safe embed policy.
- [ ] Create a bookmark from command input or clipboard paste.
- [ ] Open external URLs explicitly and show an embed only when policy and response headers permit it.
- [ ] Add search projection and full and summary bodies.
- [ ] Preserve failed metadata fetches as recoverable records.

Verification:

- [ ] Valid URL paste creates one record and one window at the intended placement.
- [ ] Invalid URL paste becomes text or shows a clear rejection according to input intent.
- [ ] Embed refusal falls back to a useful bookmark body.
- [ ] Reload and offline mode keep saved metadata available.
- [ ] Bookmark body never grants untrusted content product-shell authority.

Exit: external sources enter the daily workflow through one durable and safe content kind.

## Phase 8: library, inspector, and reusable views

Type: UI  
Estimated: 4 hours, 10 minutes human review  
Files: `src/workspace/library-rail.tsx`, `src/workspace/inspector.tsx`,
`src/database/content-repository.ts`, `src/commands/open-content-view.ts`,
`src/commands/duplicate-content.ts`, `src/workspace/library.test.tsx`

Tasks:

- [ ] Replace scaffold rail text with recent, all, kind, tag, and recovery collections.
- [ ] Add inspector editing for title, tags, canvas locations, and recovery state.
- [ ] Open another view of existing content without copying it.
- [ ] Separate duplicate view from duplicate content commands.
- [ ] Reveal every known view through the derived content-view index.
- [ ] Keep library and inspector subscriptions bounded to their queries and selection.

Verification:

- [ ] One note can appear in two windows and two canvases with shared content.
- [ ] Duplicate content creates a new record and a new window.
- [ ] Closing a view never deletes content.
- [ ] Missing-content and failed-import collections expose recovery actions.
- [ ] Panning the canvas does not reconcile the library or inspector.

Exit: the canvas acts as a view over a durable content library.

## Phase 9: semantic relations and backlinks

Type: Database  
Estimated: 3 hours, 5 minutes human review  
Files: `surql/schema/003_relations.surql`, `surql/functions/003_relations.surql`,
`surql/tests/003_relations.surql`, `src/database/relation-repository.ts`,
`src/commands/relation-commands.ts`, `src/workspace/inspector.tsx`

Tasks:

- [ ] Add enforced relation records with kind, label, timestamps, and permissions-ready ownership.
- [ ] Implement incoming, outgoing, and bounded neighborhood projections.
- [ ] Add create, relabel, reverse, and delete commands.
- [ ] Show backlinks and outgoing relations in the inspector.
- [ ] Keep relations independent of canvas connections and window geometry.

Verification:

- [ ] Relation creation and traversal return typed compact records.
- [ ] Deleting a connection does not delete its semantic relation.
- [ ] Deleting content follows the declared relation cleanup policy.
- [ ] Backlinks update without reloading the canvas.
- [ ] Invalid endpoints and kinds fail at the database and host boundaries.

Exit: reusable content has a durable graph independent of how it is displayed.

## Phase 10: canvas connections

Type: UI  
Estimated: 4 hours, 10 minutes human review  
Files: `src/canvas/connection-types.ts`, `src/canvas/connection-service.ts`,
`src/canvas/connection-layer.tsx`, `src/canvas/connection-editor.tsx`,
`src/commands/connection-commands.ts`, `src/canvas/connection.test.tsx`

Tasks:

- [ ] Persist explicit canvas connections between chosen source and destination windows.
- [ ] Render paths through framework connector geometry and scene transforms.
- [ ] Register screen-pixel-stable edge targets with the canonical resolver.
- [ ] Add pointer and command flows for create, reconnect, relabel, reroute, inspect, and delete.
- [ ] Keep DOM labels and controls accessible while geometry stays in the scene.
- [ ] Reconcile connections when a window closes, changes canvas, or loses content.

Verification:

- [ ] Preview and commit share the same endpoints and route.
- [ ] Edge selection works at 0.25x, 1x, and 4x zoom.
- [ ] Multiple views of one relation draw only explicit connections.
- [ ] Reconnect changes the connection and semantic relation only when the user chooses that intent.
- [ ] WebGPU loss hides connection visuals without breaking content or navigation.

Exit: semantic relationships have a complete, selectable spatial editing path.

## Phase 11: groups, workspaces, and recipes in product UI

Type: UI  
Estimated: 4 hours, 10 minutes human review  
Files: `src/workspace/group-toolbar.tsx`, `src/workspace/workspace-switcher.tsx`,
`src/workspace/recipe-panel.tsx`, `src/commands/workspace-commands.ts`,
`src/fixtures/first-project.ts`, `src/workspace/organization.test.tsx`

Tasks:

- [ ] Expose dock, undock, group mode, axis, weights, reorder, equalize, and dissolve through contextual product UI.
- [ ] Create, rename, switch, and remove workspaces through parameterized commands.
- [ ] Move complete groups between workspaces.
- [ ] Capture, name, persist, preview, and apply layout recipes.
- [ ] Build the first-run fixture around note, bookmark, relation, group, workspace, and recipe workflows.
- [ ] Keep the framework command center as the common mutation path.

Verification:

- [ ] The first organization workflow in `PRODUCT_PLAN.md` completes by pointer and keyboard.
- [ ] Workspace membership never splits a group.
- [ ] Applying a recipe is one layout undo entry.
- [ ] Renames preserve accessible names and survive reload.
- [ ] The first-run fixture exercises ordinary registry sizes and zoom values.

Exit: the product expresses the framework's local layout and virtual-desktop model through daily work.

## Phase 12: minimap, offscreen cues, and window switcher

Type: UI  
Estimated: 3 hours, 5 minutes human review  
Files: `src/workspace/minimap.tsx`, `src/workspace/offscreen-indicators.tsx`,
`src/workspace/window-switcher.tsx`, `src/workspace/navigation-settings.ts`,
`src/workspace/navigation.test.tsx`

Tasks:

- [ ] Draw a product minimap with groups, windows, viewport, active, and selected states.
- [ ] Add bounded offscreen indicators with an honest hidden count.
- [ ] Add title and kind navigation independent of content search.
- [ ] Preserve zoom when indicators navigate and fit only when explicitly requested.
- [ ] Let users configure minimap, indicator limit, and peripheral density.

Verification:

- [ ] Click and keyboard navigation land on the same target.
- [ ] One group creates one offscreen cue.
- [ ] Limits never imply that hidden results do not exist.
- [ ] A 160-window fixture remains readable and within the overlay frame budget.
- [ ] Minimap and indicators are absent from published views only when policy says so.

Exit: large canvases remain orientable before regions and authored waypoints exist.

## Phase 13: regions and waypoints

Type: Integration  
Estimated: 4 hours, 10 minutes human review  
Files: `surql/schema/004_navigation.surql`,
`src/database/navigation-repository.ts`, `src/canvas/region-layer.tsx`,
`src/commands/navigation-commands.ts`, `src/workspace/navigation-panel.tsx`,
`src/canvas/navigation.test.tsx`

Tasks:

- [ ] Add named regions that own bounds, style, and navigation but never child rects.
- [ ] Register regions as selectable spatial targets.
- [ ] Capture waypoints from camera, selection, region, or explicit target.
- [ ] Search, rename, reorder, open, and delete regions and waypoints.
- [ ] Navigate through canonical camera requests and honor reduced motion.
- [ ] Keep linked canvases as routes rather than live nested input planes.

Verification:

- [ ] Moving a window through a region does not mutate the window through region ownership.
- [ ] Fit-region, select-region, and search-region agree on identity.
- [ ] Waypoint restore returns to the authored target and view policy.
- [ ] Reduced motion makes navigation instantaneous.
- [ ] Region and waypoint records survive canvas layout recovery.

Exit: users can name, search, and return to important areas of a large space.

## Phase 14: visual system and accessibility pass

Type: UI  
Estimated: 4 hours, 15 minutes human review  
Files: `src/styles.css`, `src/workspace/workspace-frame.tsx`,
`src/workspace/theme-controller.tsx`, `src/workspace/preferences.tsx`,
`src/accessibility/workspace-structure.test.tsx`,
`src/accessibility/keyboard-session.test.tsx`

Tasks:

- [ ] Replace scaffold hardcoded colors with semantic application and `--icx-*` tokens.
- [ ] Implement complete dark and light themes across shell, windows, groups, connections, portals, and summaries.
- [ ] Finalize the shared frame grammar and restrained kind accents.
- [ ] Apply reduced-motion, contrast, density, and focus-visible policies.
- [ ] Prove a keyboard-only daily workflow through create, search, edit, arrange, group, workspace, and close.
- [ ] Audit accessible names, relationships, tab order, dialogs, and recovery bodies.

Verification:

- [ ] No product component contains an unexplained literal visual color.
- [ ] Both themes cover every shell and framework slot, including portals.
- [ ] Automated structure checks pass with real groups and content controls.
- [ ] Keyboard session reaches every core verb without a pointer.
- [ ] Browser witness confirms focus, contrast, summaries, and reduced motion at declared checkpoints.

Exit: the core workflow is visually coherent and operable across keyboard, pointer, themes, and scale.

## Phase 15: public-beta gates, export, and documentation

Type: Testing  
Estimated: 4 hours, 15 minutes human review  
Files: `src/export/project-export.ts`, `src/import/project-import.ts`,
`src/benchmarks/product-benchmark.ts`, `src/fixtures/reference-project.ts`,
`src/recovery/recovery.test.ts`, `src/pwa/service-worker.ts`,
`apps/polkadot/README.md`, `apps/polkadot/PRODUCT_PLAN.md`

Tasks:

- [ ] Add versioned open JSON project export and validated import.
- [ ] Add Markdown note export and import.
- [ ] Build a stable reference project used by screenshots, docs, tests, and benchmarks.
- [ ] Add product-shaped launch, pan, zoom, drag, search, autosave, and import measurements.
- [ ] Add corrupt layout, missing content, failed import, migration, WebGPU fallback, and stale revision fixtures.
- [ ] Cache the application shell and required static assets for offline launch without caching private data outside its database authority.
- [ ] Write run, architecture, data ownership, content-kind, and recovery documentation.
- [ ] Wire app check, build, SurQL validation, and focused tests into the root ready gate.

Verification:

- [ ] Export then import yields equivalent durable records and canonical layout.
- [ ] Performance targets are reported with p50 and p95 on a declared reference device.
- [ ] Every recovery fixture leaves the user with a usable shell and explicit next action.
- [ ] A clean clone can install, check, build, and open the reference project from documented commands.
- [ ] An installed production build launches, opens the last local canvas, edits, searches, and saves with the network disabled.
- [ ] The app works without optional WebGPU scene support.

Exit: Polkadot is credible for public local-first beta use and external contribution.

## Phase 16: native assets and image windows

Type: Integration  
Estimated: 4 hours, 10 minutes human review  
Files: `surql/schema/005_assets.surql`, `src/database/asset-repository.ts`,
`src/import/native-file-intake.ts`, `src/canvas/native-drop-adapter.tsx`,
`src/content/image/image-window.tsx`, `src/import/native-file.test.tsx`

Tasks:

- [ ] Prove the offline asset storage backend with size, quota, and recovery behavior.
- [ ] Validate native drag and clipboard image inputs.
- [ ] Keep preview and commit placement identical through a product-local adapter.
- [ ] Add image metadata, intrinsic sizing, full body, summary, search, and export.
- [ ] Preserve failed or interrupted imports as recoverable records.
- [ ] Record adapter friction for the external-drag framework decision.

Verification:

- [ ] Drag, paste, reload, duplicate view, export, and delete follow declared asset ownership.
- [ ] Oversize, unsupported, corrupt, and quota-failed files produce recoverable outcomes.
- [ ] Browser drag never opens the file as a page or creates a duplicate drop.
- [ ] Product-local adapter uses canonical target and placement helpers.
- [ ] Framework promotion is accepted or declined from written evidence.

Exit: the first native file kind works offline and produces a grounded framework-gap decision.

## Phase 17: PDF research workflow

Type: UI  
Estimated: 4 hours, 10 minutes human review  
Files: `src/content/pdf/pdf-service.ts`, `src/content/pdf/pdf-worker.ts`,
`src/content/pdf/pdf-window.tsx`, `src/content/pdf/pdf-search.ts`,
`src/commands/pdf-commands.ts`, `src/content/pdf/pdf.test.tsx`

Tasks:

- [ ] Load and render PDFs off the main thread where supported.
- [ ] Persist page, zoom, and reading position independently from canvas zoom.
- [ ] Extract bounded searchable text and page references.
- [ ] Create note references from selections or page locations.
- [ ] Provide full and summary representations and preserve state while offscreen.
- [ ] Export annotations and source links without embedding proprietary data silently.

Verification:

- [ ] Large PDFs do not block canvas interaction.
- [ ] Search result opens the correct PDF and page.
- [ ] Pan-away and return preserve reading position.
- [ ] Missing or changed source files expose relink behavior.
- [ ] Summary mode remains meaningful across zoom.

Exit: Polkadot supports a complete source-to-note research loop with native files.

## Phase 17a: long-form document capability

Type: UI  
Estimated: 4 hours, 10 minutes human review  
Files: `src/content/document/document-schema.ts`,
`src/content/document/document-service.ts`,
`src/content/document/document-window.tsx`,
`src/content/document/document-outline.tsx`,
`src/commands/document-commands.ts`, `src/content/document/document.test.tsx`

Tasks:

- [ ] Select an editor from a focused proof of composition, serialization, accessibility, and collaboration boundaries.
- [ ] Add structured blocks, outline navigation, autosave, search projection, links, and export.
- [ ] Keep editor undo local and canvas shortcuts guarded at the body boundary.
- [ ] Provide full and summary representations and preserve editor state offscreen.
- [ ] Create notes or relations from selected blocks through named commands.

Verification:

- [ ] A long document edits, reloads, searches, exports, and opens in two views.
- [ ] Camera movement causes no editor reconciliation.
- [ ] Outline navigation and canvas navigation do not fight over focus or shortcuts.
- [ ] Invalid document data opens recovery without losing the raw record.

Exit: long-form writing joins the spatial workflow as a strong content kind rather than a generic placeholder.

## Phase 17b: time-based media capability

Type: UI  
Estimated: 4 hours, 10 minutes human review  
Files: `src/content/media/media-schema.ts`, `src/content/media/media-service.ts`,
`src/content/media/media-window.tsx`, `src/content/media/media-markers.tsx`,
`src/commands/media-commands.ts`, `src/content/media/media.test.tsx`

Tasks:

- [ ] Support local and permitted remote audio and video sources.
- [ ] Persist playback position, transcript status, and authored markers.
- [ ] Create note and relation records from markers or transcript selections.
- [ ] Preserve playback and controls across offscreen culling and workspace changes.
- [ ] Add meaningful summary and search projections without auto-playing media.

Verification:

- [ ] Pan-away, workspace switch, and return preserve declared playback behavior.
- [ ] Marker navigation lands on the correct media time and related note.
- [ ] Missing media offers relink and keeps annotations intact.
- [ ] Media decode and transcript work stay outside the canvas frame budget.

Exit: review of time-based material connects directly to durable spatial notes and relations.

## Phase 17c: table capability

Type: UI  
Estimated: 4 hours, 10 minutes human review  
Files: `src/content/table/table-schema.ts`, `src/content/table/table-service.ts`,
`src/content/table/table-window.tsx`, `src/content/table/table-query.ts`,
`src/commands/table-commands.ts`, `src/content/table/table.test.tsx`

Tasks:

- [ ] Add typed columns, rows, sorting, filtering, selection, and bounded editing.
- [ ] Keep record queries in SurrealDB and virtualize large views.
- [ ] Create notes, bookmarks, or relations from selected rows.
- [ ] Add CSV import/export with ArkType validation and recovery.
- [ ] Provide summary metrics that remain meaningful at far zoom.

Verification:

- [ ] A large table remains responsive during canvas camera movement.
- [ ] Filter, sort, edit, reload, and export preserve typed values.
- [ ] Invalid CSV rows produce a bounded problem report without discarding valid input silently.
- [ ] Selected rows create the intended content or relation through one command.

Exit: structured records coexist with free spatial composition without introducing a global dashboard grid.

## Phase 17d: code capability

Type: UI  
Estimated: 4 hours, 10 minutes human review  
Files: `src/content/code/code-schema.ts`, `src/content/code/code-service.ts`,
`src/content/code/code-window.tsx`, `src/content/code/code-language.ts`,
`src/commands/code-commands.ts`, `src/content/code/code.test.tsx`

Tasks:

- [ ] Add syntax-aware editing, file links, language metadata, search projection, and export.
- [ ] Keep clipboard, selection, IME, and editor shortcuts inside the body contract.
- [ ] Support read-only file-backed snippets before any execution feature.
- [ ] Put optional execution behind an explicit bounded external service and confirmation policy.
- [ ] Provide a concise semantic summary by language, file, and symbol identity.

Verification:

- [ ] Edit, reload, search, copy, and export work without canvas shortcut leakage.
- [ ] File changes and missing files expose explicit refresh or relink states.
- [ ] Camera motion causes no editor reconciliation.
- [ ] No code executes through the content renderer or database implicitly.

Exit: technical material becomes a first-class spatial content kind with a clear execution boundary.

## Phase 18: tours and live presentation

Type: UI  
Estimated: 4 hours, 10 minutes human review  
Files: `surql/schema/006_tours.surql`, `src/database/tour-repository.ts`,
`src/commands/tour-commands.ts`, `src/workspace/tour-editor.tsx`,
`src/workspace/presenter.tsx`, `src/workspace/tour.test.tsx`

Tasks:

- [ ] Create tours from ordered waypoints.
- [ ] Add edit, reorder, preview, present, and resume commands.
- [ ] Add an interruptible camera director outside the reducer.
- [ ] Hide editing chrome while keeping live content and accessible navigation.
- [ ] Respect reduced motion and cancel immediately on direct user input.
- [ ] Record camera-director friction for framework promotion.

Verification:

- [ ] Presentation follows the authored order and targets.
- [ ] Pointer, wheel, keyboard, or touch input cancels motion immediately.
- [ ] Reduced motion uses instantaneous transitions.
- [ ] Editing and presentation share durable waypoint identities.
- [ ] A live tour survives reload and missing targets with explicit recovery.

Exit: a canvas can become an authored live explanation without slide export.

## Phase 19: agent command bridge

Type: Integration  
Estimated: 4 hours, 15 minutes human review  
Files: `src/agent/agent-context.ts`, `src/agent/agent-tools.ts`,
`src/agent/agent-policy.ts`, `src/agent/agent-receipts.ts`,
`src/commands/command-registry.ts`, `src/agent/agent.test.ts`

Tasks:

- [ ] Expose bounded queries for content, relations, windows, regions, waypoints, and current commands.
- [ ] Generate tool contracts from ArkType command inputs where conversion is honest.
- [ ] Execute product and framework commands through the same registries as the UI.
- [ ] Require previews or confirmation for bulk, destructive, and external operations.
- [ ] Return durable receipts with affected records, windows, revisions, and undo semantics.
- [ ] Keep model providers optional and outside command authority.

Verification:

- [ ] Agent creates a note, opens it, relates it, groups its view, and navigates to it through named commands.
- [ ] Invalid and disabled commands cannot bypass UI availability rules.
- [ ] Destructive and bulk commands stop at the approval boundary.
- [ ] No agent tool reaches DOM, raw Legend observables, or unrestricted SurQL.
- [ ] Receipts match the visible and durable result.

Exit: agent control is a safe product capability rather than a separate automation code path.

## Remote design pressure

Remote sync and collaboration are intentionally unscheduled. The local product
must first prove its content, spatial organization, retrieval, media,
presentation, and agent workflows. Durable ids, record revisions, typed
commands, personal view state, and permissions-ready ownership remain active
constraints so later remote work does not require replacing those authorities.

Remote implementation can enter the schedule only after the local capability
milestones are complete and one concrete cross-device or sharing workflow has a
clear owner and acceptance path.

## Frontier activation gates

These are programs rather than scheduled phases.

- Semantic retrieval activates after lexical-search evaluation records repeatable misses.
- Shared live layout activates after a serializable document-mutation protocol preserves group invariants under reordering and replay.
- Dense GPU objects activate after a real canvas exceeds DOM and CPU spatial-target budgets.
- A spatial index activates after profiling shows nearby queries dominate a product path.
- Rasterization activates after a real heavy body misses frame budgets despite correct subscription isolation and culling.
- Columns layout activates after a real workflow needs append-without-resize and shell-local scrolling.
- Recorded walkthroughs activate after tours, media, remote sharing, and permission boundaries are stable.

## Validation posture

- `vp check` and package-local builds run after every phase.
- Pure data, command, query, and geometry behavior gets direct tests.
- SurQL files receive parse and runtime proof at the target version.
- Product-shaped fixtures prove thresholds, summaries, body invalidation, and recovery.
- Browser automation uses one headless `agent-browser` session for one predeclared visible or interactive question inside the scheduled five-minute checkpoint.
- The target URL must pass a terminal HTTP health check before browser launch.
- Every browser checkpoint ends with `agent-browser close`, an inactive session report, and no owned headless Chrome process.
- A green test is evidence for its claim only. It does not replace a usable product workflow.
