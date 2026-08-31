# Polkadot implementation phases

- Product authority: [`PRODUCT_PLAN.md`](./PRODUCT_PLAN.md)
- Stack: TanStack Start, React 19, Legend State 3, Vite+, Tailwind 4,
  `@hyphened/infinite-canvas`, ArkType, SurrealDB WASM and IndexedDB
- Estimated core through public beta: about 52 agent-hours
- Estimated expansion phases: about 44 agent-hours
- Expected human review: 5 to 10 minutes at each milestone boundary

Each phase fits one focused implementation session. A target file list can
shrink for behavior that an existing module owns. If a phase will exceed eight
files or four hours for implementation and verification, split it.

## Phase 0: application scaffold

Type: Infrastructure  
Status: complete  
Estimated: completed in the onboarding session  
Files: `package.json`, `pnpm-workspace.yaml`, `vite.config.ts`,
`apps/polkadot/package.json`, `apps/polkadot/vite.config.ts`,
`apps/polkadot/tsconfig.json`, `apps/polkadot/src/routes/*`,
`apps/polkadot/src/workspace/workspace-canvas.tsx`

Tasks:

- [x] Create an official blank TanStack Start React application.
- [x] Add it to the root pnpm and Vite+ workspace.
- [x] Add Legend State, the headless framework, Tailwind, Geist, and the generic UI package.
- [x] Mount a parent-owned canvas store through the compound provider and viewport API.
- [x] Add product-owned shell chrome and one canonical `openWindow` action.
- [x] Keep the route shell server-renderable. Reserve a client-only module boundary for the future browser database.

Verification:

- [x] The `vp check` command succeeds in `apps/polkadot`.
- [x] The `vp run polkadot#build` command completes client and server builds.
- [ ] A scheduled browser witness shows the shell, initial note, rail toggle, and new note action.

Exit: the app's framework path accepts product services.

## Phase 1: database corpus and browser worker

Type: Database  
Status: complete  
Estimated: 3 hours, 10 minutes human review  
Files: `surql/manifest.json`, `surql/schema/001_core.surql`, `surql/functions/001_canvas.surql`,
`surql/tests/001_core.surql`, `src/database/database.client.ts`,
`apps/polkadot/vite.config.ts`, `apps/polkadot/package.json`,
`patches/@surrealdb__wasm@2.6.1.patch`, `pnpm-workspace.yaml`

Tasks:

- [x] Add compatible `surrealdb` and `@surrealdb/wasm` versions to the workspace catalog.
- [x] Create the project-local SurQL manifest and the project, canvas, content, and relation schema.
- [x] Add the revision-checked canvas save function.
- [x] Start the IndexedDB engine inside the official WASM worker adapter.
- [x] Keep the WASM package out of Vite dependency optimization and server imports.
- [x] Add a disposable proof for schema, record creation, queries, relations, and stale revisions.
- [x] Pin the 2.6.1 worker engine after browser proof failed for the 3.x IndexedDB path.
- [x] Backport the upstream Vite worker injection. Import the worker through `?worker`.

Verification:

- [x] The `surql_validate` command accepts the corpus with strict corpus checks.
- [x] The local SurrealDB runtime processes the manifest and proof file.
- [x] A browser worker opens `indxdb://polkadot`, writes a record, reloads, and reads it.
- [x] A stale `fn::save_canvas` revision returns no update.
- [x] The database worker is absent from the initial main-thread route chunk.
- [x] The production worker resolves Vite's emitted hashed WASM asset.

Exit: the browser database enforces the first durable contracts outside the main thread.

## Phase 2: runtime load and canvas hydration

Type: Integration  
Status: complete, one verification deferred  
Estimated: 3.5 hours, 5 minutes human review  
Files: `src/runtime/runtime.client.ts`, `src/runtime/runtime-context.tsx`,
`src/database/project-repository.ts`, `src/database/canvas-repository.ts`,
`src/canvas/canvas-store.ts`, `src/routes/index.tsx`,
`src/routes/canvas.$canvasId.tsx`

Tasks:

- [x] Compose the database, repositories, window registry, canvas store, and canvas handle in one client runtime.
- [x] Load or create the first project and canvas.
- [x] Parse the saved layout with the framework parser. Normalize the parsed layout against the registry.
- [x] Render deterministic loading, ready, empty, and database-failure states.
- [x] Route `/` to the most recent canvas. Route `/canvas/$canvasId` to one runtime instance.
- [x] On each route change, dispose subscriptions, database resources, and store references.

We omitted `project-repository.ts` and `canvas-repository.ts`.
`database.client.ts` owns connection lifecycle, SurQL installation, and
validation. The omitted files only re-exported it and owned no behavior.

Verification:

- [x] A new database creates one project and canvas and opens it.
- [x] A saved canvas reloads with the same camera, windows, groups, and workspaces.
- [x] A malformed layout opens recovery UI while valid content remains queryable.
- [x] Two canvas routes never share a store instance.
- [x] Navigating away and back does not duplicate a database or handle subscription.

Browser evidence outside the suite:

- A zoom changed `canvas_document:main` from revision 0 to 1 and `camera.zoom`
  from 1 to 1.405.
- A reload restored 140% and put the window at `scale(1.40493)`.
- A second canvas opened at 100% and `scale(1)`. Main remained at 140% and
  `scale(1.40493)`. Thus, the two routes did not share a store.
- A layout of `{ notACanvas: true }` opened "This canvas layout is damaged".
- A layout that named `chart` and `timeline` opened the canvas with its valid
  note. The HUD showed "2 window kinds could not be opened: chart, timeline".
- One zoom after main → second → main increased the revision by exactly 1.
  No subscription remained after the route change.

The first item stayed open for a long time because the proof seemed to require
an erase of this browser's IndexedDB. Archive is reversible, and
`fn::most_recent_canvas` filters archived rows. Thus, archiving every project
simulates an empty database exactly. The procedure restores the state afterward.

The proof found a bootstrap defect. Bootstrap used fixed record IDs and returned
the archived project instead of a new workspace. This silently reversed the
only project archive. We corrected `fn::bootstrap_canvas`. The next witness
created a fresh project and empty canvas. The archived project remained unchanged.

Exit: route identity loads one validated, parent-owned canvas runtime.

## Phase 2b: project and canvas library

Type: UI  
Estimated: 3 hours, 10 minutes human review  
Files: `src/workspace/project-library.tsx`, `src/workspace/canvas-library.tsx`,
`src/workspace/canvas-tabs.tsx`, `src/commands/project-commands.ts`,
`src/commands/canvas-commands.ts`, `src/workspace/project-library.test.tsx`

Tasks:

- [x] Add commands to create, open, rename, archive, restore, and permanently remove projects.
      Make removal cascade to canvases, notes, and relation edges. Require users
      to type the project name before permanent removal. Record the retention
      decision in `AFFORDANCE_AUDIT.md`. Keep project duplication unavailable.
- [x] Add commands to create, open, rename, duplicate, archive, restore, and permanently remove canvases.
- [ ] Add recent and recovery collections with explicit empty and failure states.
- [ ] Keep several canvas routes available as tabs without sharing stores.
- [ ] Add route breadcrumbs and browser back/forward behavior.
- [x] Require explicit confirmation and record counts before permanent removal.

Project copies lack a policy for shared or forked notes. Canvas copies have a
clear policy.

Verification:

- [x] Every lifecycle command changes one database authority and returns a receipt.
- [x] Duplicate canvas copies layout and view references while preserving shared content identity.
- [x] Archive is reversible and permanent removal obeys the declared content-retention policy.
- [ ] Tab and browser navigation dispose and restore runtimes without duplicate subscriptions.
- [x] The last-opened canvas becomes the deterministic root-route destination.

Witnessed in the browser:

- Duplication produced a copy with windows that reference the source
  `content_item:welcome`. Thus, both canvases share the content identity.
- Archiving removed the canvas from the switcher, placed it under an "Archived"
  group, and navigated away from it. Restore returned it to the active list.
- The removal confirmation used the live, singular count "and its 1 window".
- After confirmation, `content_item:welcome` still contained its text.

The switcher omits the "recent" collection, empty state, and failure state
because it requires an existing canvas. Tabs and breadcrumbs remain unchanged.
Project support remains the unstarted half of this phase. The app hardcodes
`project:default`.

Exit: users manage project and canvas documents for daily work.

## Phase 3: note content spine

Type: UI  
Estimated: 4 hours, 10 minutes human review  
Files: `src/content/content-types.ts`, `src/content/content-registry.ts`,
`src/content/note/note-schema.ts`, `src/content/note/note-service.ts`,
`src/content/note/note-window.tsx`, `src/commands/create-note.ts`,
`src/workspace/workspace-canvas.tsx`

Tasks:

- [ ] Define ArkType input and output contracts for content references and notes. Derive host TypeScript types from them.
- [ ] Add a note repository path and kind-owned search projection.
- [ ] Replace the scaffold note with an editable, autosaving note body.
- [ ] Provide full and summary representations. Define policies for body focus, text selection, and scrolling.
- [ ] Create a note through one application command. Open the note window through the framework command facade.
- [ ] Render an explicit missing or invalid content recovery body.

Verification:

- [ ] A note retains content through creation, edits, reloads, renames, and close actions.
- [ ] Opening a second view of one note reflects the same durable content.
- [ ] Zooming to the summary and back preserves editor state.
- [ ] Camera movement causes no note body reconciliation.
- [ ] Keyboard input, tab containment, escape, and canvas shortcuts remain compatible.

Exit: one durable record produces a live, searchable, reusable spatial view end to end.

## Phase 4: canvas autosave and recovery

Type: Integration  
Estimated: 3 hours, 5 minutes human review  
Files: `src/canvas/canvas-persistence.ts`, `src/database/canvas-repository.ts`,
`src/runtime/runtime.client.ts`, `src/workspace/recovery-shell.tsx`,
`src/canvas/canvas-persistence.test.ts`, `surql/functions/001_canvas.surql`

Tasks:

- [ ] Subscribe to settled canvas state through the parent-held handle. After interactions finish, debounce the save.
- [ ] Serialize the state with `handle.snapshot()`.
- [ ] Validate the outgoing host projection. Save the projection with an expected revision.
- [ ] Refresh the rebuildable content-view index in the same database transaction.
- [ ] Expose pending, saved, failed, retrying, and conflicted status in the shell.
- [ ] Recover from stale revisions, missing content, and invalid framework payloads.

Verification:

- [ ] The canonical state matches after move, resize, group, workspace-switch, and reload actions.
- [ ] Each drag creates one durable save after the gesture and no frame-level saves.
- [ ] A stale revision cannot overwrite a newer group tree.
- [ ] A simulated write failure leaves the prior revision readable and retries once.
- [ ] The UI never reports saved before the database acknowledges the revision.

Exit: reload preserves layout and content with accurate save status and error recovery.

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
- [ ] After the command center closes, restore focus to the canvas. Preserve input shortcut guards.
- [ ] Keep unavailable framework commands visible with explanations.
- [ ] Record the last command receipt for activity and agent reports.

Verification:

- [ ] `Mod+K`, search, arrow navigation, Enter, and Escape form the full keyboard flow.
- [ ] Canonical owners process framework and product commands.
- [ ] Disabled commands remain inactive and show the reason.
- [ ] Parameterized commands reject missing or invalid inputs.
- [ ] Closing the center restores canvas hotkeys.

Exit: the command center exposes every action through the keyboard.

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
- [ ] Restore minimized windows. Navigate to existing views.
- [ ] If a result uses another workspace, switch there before navigation.
- [ ] If content has no current location, open a new view.

Verification:

- [ ] Matches in titles and bodies return useful highlights.
- [ ] Search meets the 100 ms target over a 10,000-item fixture.
- [ ] Visible, minimized, other-workspace, other-canvas, and unopened results use their specified paths.
- [ ] Camera movement does not start another database search.
- [ ] Empty and failed queries remain keyboard navigable.

Exit: users find and reopen durable content independent of the current layout.

## Phase 7: bookmark capture and clipboard intake

Type: Integration  
Estimated: 3 hours, 10 minutes human review  
Files: `src/content/bookmark/bookmark-schema.ts`,
`src/content/bookmark/bookmark-service.ts`,
`src/content/bookmark/bookmark-window.tsx`, `src/commands/create-bookmark.ts`,
`src/workspace/clipboard-intake.ts`, `src/content/bookmark/bookmark.test.tsx`

Tasks:

- [ ] Parse URL, plain-text, and blank bookmark inputs through ArkType. Store URL identity, title, description, host, fetch status, and safe embed policy.
- [ ] Create a bookmark from command input or clipboard paste.
- [ ] Open external URLs only after an explicit action. If policy and response headers permit it, show an embed.
- [ ] Add search projection and full and summary bodies.
- [ ] Preserve failed metadata fetches as recoverable records.

Verification:

- [ ] Valid URL paste creates one record and one window at the intended placement.
- [ ] An invalid URL paste becomes text or shows a clear rejection according to input intent.
- [ ] Embed refusal shows a useful bookmark body.
- [ ] Saved metadata remains available after a reload and in offline mode.
- [ ] Bookmark body never grants untrusted content product-shell authority.

Exit: external sources enter daily work as durable bookmarks without product-shell authority.

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
- [ ] Keep the duplicate-view and duplicate-content commands separate.
- [ ] Reveal every known view through the derived content-view index.
- [ ] Keep library and inspector subscriptions bounded to their queries and selection.

Verification:

- [ ] One note can appear in two windows and two canvases with shared content.
- [ ] Duplicate content creates a new record and a new window.
- [ ] A closed view never deletes content.
- [ ] Missing-content and failed-import collections expose recovery actions.
- [ ] A canvas pan does not reconcile the library or inspector.

Exit: the canvas shows views from a durable content library.

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
- [ ] A connection deletion does not delete its semantic relation.
- [ ] A content deletion obeys the declared relation cleanup policy.
- [ ] Backlinks update without reloading the canvas.
- [ ] Invalid endpoints and kinds fail at the database and host boundaries.

Exit: reusable content has a durable graph independent of its views.

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
- [ ] Keep DOM labels and controls accessible. Keep connection geometry in the scene.
- [ ] When a window closes, changes canvas, or loses content, reconcile its connections.

Verification:

- [ ] The preview and committed connection share the same endpoints and route.
- [ ] At 0.25x, 1x, and 4x zoom, edge selection works.
- [ ] Multiple views of one relation draw only explicit connections.
- [ ] Reconnect changes the connection and semantic relation only after explicit user choice.
- [ ] If WebGPU fails, connection visuals hide while content and navigation continue.

Exit: semantic relationships have a full, selectable spatial-editing path.

## Phase 11: groups, workspaces, and recipes in product UI

Type: UI  
Estimated: 4 hours, 10 minutes human review  
Files: `src/workspace/group-toolbar.tsx`, `src/workspace/workspace-switcher.tsx`,
`src/workspace/recipe-panel.tsx`, `src/commands/workspace-commands.ts`,
`src/fixtures/first-project.ts`, `src/workspace/organization.test.tsx`

Tasks:

- [ ] Expose dock, undock, group mode, axis, weights, reorder, equalize, and dissolve through contextual product UI.
- [ ] Add parameterized commands to create, rename, switch, and remove workspaces.
- [ ] Move whole groups between workspaces.
- [ ] Add commands for layout recipe capture, naming, storage, preview, and application.
- [ ] Build the first-run fixture around note, bookmark, relation, group, workspace, and recipe workflows.
- [ ] Route each mutation through the framework command center.

Verification:

- [ ] The first organization workflow in `PRODUCT_PLAN.md` completes with pointer and keyboard input.
- [ ] Workspace membership never splits a group.
- [ ] A recipe application creates one layout undo entry.
- [ ] Accessible names remain after renames and reload.
- [ ] The first-run fixture exercises ordinary registry sizes and zoom values.

Exit: daily workflows expose the framework's local layout and virtual desktops.

## Phase 12: minimap, offscreen cues, and window switcher

Type: UI  
Estimated: 3 hours, 5 minutes human review  
Files: `src/workspace/minimap.tsx`, `src/workspace/offscreen-indicators.tsx`,
`src/workspace/window-switcher.tsx`, `src/workspace/navigation-settings.ts`,
`src/workspace/navigation.test.tsx`

Tasks:

- [ ] Draw a product minimap with groups, windows, viewport, active, and selected states.
- [ ] Add bounded offscreen indicators that report the hidden count.
- [ ] Add title and kind navigation independent of content search.
- [ ] When an indicator navigates, preserve zoom.
- [ ] Fit the target only after an explicit request.
- [ ] Let users configure minimap, indicator limit, and peripheral density.

Verification:

- [ ] Click and keyboard navigation use the same target.
- [ ] One group creates one offscreen cue.
- [ ] Limits report the existence of hidden results.
- [ ] A 160-window fixture remains readable and meets the overlay frame budget.
- [ ] The policy must exclude the minimap and indicators before published views omit them.

Exit: users navigate large canvases before regions and authored waypoints exist.

## Phase 13: regions and waypoints

Type: Integration  
Estimated: 4 hours, 10 minutes human review  
Files: `surql/schema/004_navigation.surql`,
`src/database/navigation-repository.ts`, `src/canvas/region-layer.tsx`,
`src/commands/navigation-commands.ts`, `src/workspace/navigation-panel.tsx`,
`src/canvas/navigation.test.tsx`

Tasks:

- [ ] Add named regions that own bounds, style, and navigation. Prevent regions from owning child rects.
- [ ] Register regions as selectable spatial targets.
- [ ] Capture waypoints from camera, selection, region, or explicit target.
- [ ] Add commands to search, rename, reorder, open, and delete regions and waypoints.
- [ ] Navigate through canonical camera requests. Obey the reduced-motion preference.
- [ ] Represent linked canvases as routes. Exclude live nested input planes.

Verification:

- [ ] When a window moves through a region, region ownership does not change the window.
- [ ] Fit-region, select-region, and search-region agree on identity.
- [ ] Waypoint restore returns to the authored target and view policy.
- [ ] Reduced motion makes navigation instantaneous.
- [ ] Canvas layout recovery preserves region and waypoint records.

Exit: users name, search, and return to important large-canvas areas.

## Phase 14: visual system and accessibility pass

Type: UI  
Estimated: 4 hours, 15 minutes human review  
Files: `src/styles.css`, `src/workspace/workspace-frame.tsx`,
`src/workspace/theme-controller.tsx`, `src/workspace/preferences.tsx`,
`src/accessibility/workspace-structure.test.tsx`,
`src/accessibility/keyboard-session.test.tsx`

Tasks:

- [ ] Replace scaffold hardcoded colors with semantic application and `--icx-*` tokens.
- [ ] Implement full dark and light themes across shell, windows, groups, connections, portals, and summaries.
- [ ] Define the shared frame system and restrained kind accents.
- [ ] Apply reduced-motion, contrast, density, and focus-visible policies.
- [ ] Add a keyboard-only proof for create, search, edit, arrange, group, workspace, and close actions.
- [ ] Examine accessible names, relationships, tab order, dialogs, and recovery bodies.

Verification:

- [ ] No product component contains an unexplained literal visual color.
- [ ] Both themes cover every shell, framework slot, and portal.
- [ ] Automated structure checks pass with real groups and content controls.
- [ ] The keyboard session completes every core action without a pointer.
- [ ] Browser witness shows focus, contrast, summaries, and reduced motion at declared checkpoints.

Exit: the core workflow has consistent visuals and works with keyboard, pointer, themes, and scale.

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
- [ ] Build a stable reference project for screenshots, docs, tests, and benchmarks.
- [ ] Measure product launch, pan, zoom, drag, search, autosave, and import behavior.
- [ ] Add corrupt layout, missing content, failed import, migration, WebGPU fallback, and stale revision fixtures.
- [ ] Cache the application shell and required static assets for offline launch. Do not cache private data outside its database authority.
- [ ] Write operation, architecture, data ownership, content-kind, and recovery documentation.
- [ ] Wire app check, build, SurQL validation, and focused tests into the root ready gate.

Verification:

- [ ] An export-import cycle yields equivalent durable records and canonical layout.
- [ ] The report gives p50 and p95 for each performance target on a declared reference device.
- [ ] Every recovery fixture leaves the user with a usable shell and explicit next action.
- [ ] A clean clone installs, passes checks, builds, and opens the reference project with documented commands.
- [ ] An installed production build launches, opens the last local canvas, edits, searches, and saves with the network disabled.
- [ ] The app works without optional WebGPU scene support.

Exit: Polkadot meets the gates for a public local-first beta and external contributions.

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
- [ ] Record adapter problems for the external-drag framework decision.

Verification:

- [ ] Asset ownership remains correct after drag, paste, reload, duplicate-view, export, and delete actions.
- [ ] Oversize, unsupported, corrupt, and quota-failed files produce recoverable outcomes.
- [ ] Browser drag never opens the file as a page or creates a duplicate drop.
- [ ] Product-local adapter uses canonical target and placement helpers.
- [ ] Written evidence determines acceptance or rejection of framework promotion.

Exit: the first native file kind works offline and produces an evidence-based framework-gap decision.

## Phase 17: PDF research workflow

Type: UI  
Estimated: 4 hours, 10 minutes human review  
Files: `src/content/pdf/pdf-service.ts`, `src/content/pdf/pdf-worker.ts`,
`src/content/pdf/pdf-window.tsx`, `src/content/pdf/pdf-search.ts`,
`src/commands/pdf-commands.ts`, `src/content/pdf/pdf.test.tsx`

Tasks:

- [ ] When supported, load and render PDFs outside the main thread.
- [ ] Persist page, zoom, and reading position independently from canvas zoom.
- [ ] Extract bounded searchable text and page references.
- [ ] Create note references from selections or page locations.
- [ ] Provide full and summary representations. Preserve state while offscreen.
- [ ] Export annotations and source links. Do not embed proprietary data without notice.

Verification:

- [ ] Large PDFs do not block canvas interaction.
- [ ] A search result opens the correct PDF and page.
- [ ] The reading position remains unchanged after a pan away and return.
- [ ] Missing or changed source files expose relink behavior.
- [ ] Summary mode stays useful at each zoom level.

Exit: native files support the full source-to-note research loop.

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
- [ ] Keep editor undo local. Guard canvas shortcuts at the body boundary.
- [ ] Provide full and summary representations. Preserve editor state offscreen.
- [ ] Create notes or relations from selected blocks through named commands.

Verification:

- [ ] A long document edits, reloads, searches, exports, and opens in two views.
- [ ] Camera movement causes no editor reconciliation.
- [ ] Outline and canvas navigation keep separate focus and shortcut control.
- [ ] Invalid document data opens recovery without losing the raw record.

Exit: dedicated long-form content joins the spatial workflow.

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
- [ ] Add useful summary and search projections. Prevent media autoplay.

Verification:

- [ ] Pan-away, workspace switch, and return preserve declared playback behavior.
- [ ] Marker navigation goes to the correct media time and related note.
- [ ] The missing-media state shows relink behavior and preserves annotations.
- [ ] Media decode and transcript work stay outside the canvas frame budget.

Exit: time-based material links to durable spatial notes and relations.

## Phase 17c: table capability

Type: UI  
Estimated: 4 hours, 10 minutes human review  
Files: `src/content/table/table-schema.ts`, `src/content/table/table-service.ts`,
`src/content/table/table-window.tsx`, `src/content/table/table-query.ts`,
`src/commands/table-commands.ts`, `src/content/table/table.test.tsx`

Tasks:

- [ ] Add typed columns, rows, sorting, filtering, selection, and bounded editing.
- [ ] Keep record queries in SurrealDB. Virtualize large views.
- [ ] Create notes, bookmarks, or relations from selected rows.
- [ ] Add CSV import/export with ArkType validation and recovery.
- [ ] Show useful summary metrics at far zoom.

Verification:

- [ ] A large table remains responsive during canvas camera movement.
- [ ] Filter, sort, edit, reload, and export preserve typed values.
- [ ] Invalid CSV rows produce a bounded problem report. The importer does not silently discard valid input.
- [ ] Selected rows create the intended content or relation through one command.

Exit: structured records and free spatial composition need no global dashboard grid.

## Phase 17d: code capability

Type: UI  
Estimated: 4 hours, 10 minutes human review  
Files: `src/content/code/code-schema.ts`, `src/content/code/code-service.ts`,
`src/content/code/code-window.tsx`, `src/content/code/code-language.ts`,
`src/commands/code-commands.ts`, `src/content/code/code.test.tsx`

Tasks:

- [ ] Add syntax-aware editing, file links, language metadata, search projection, and export.
- [ ] Keep clipboard, selection, IME, and editor shortcuts inside the body contract.
- [ ] Support read-only file-backed snippets before execution features.
- [ ] Put optional execution behind an explicit bounded external service and confirmation policy.
- [ ] Provide a concise semantic summary by language, file, and symbol identity.

Verification:

- [ ] Edit, reload, search, copy, and export work without canvas shortcut leakage.
- [ ] File changes and missing files produce explicit refresh or relink states.
- [ ] Camera motion causes no editor reconciliation.
- [ ] No code executes through the content renderer or database implicitly.

Exit: a dedicated spatial content kind gives technical material an execution boundary.

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
- [ ] Hide editing chrome. Keep live content and accessible navigation available.
- [ ] Obey the reduced-motion preference. Cancel camera motion immediately after direct user input.
- [ ] Record camera-director problems for framework promotion.

Verification:

- [ ] Presentation uses the authored order and targets.
- [ ] Pointer, wheel, keyboard, or touch input cancels motion immediately.
- [ ] Reduced motion uses instantaneous transitions.
- [ ] Editing and presentation share durable waypoint identities.
- [ ] A live tour remains available after reload. Missing targets show explicit recovery.

Exit: a canvas shows authored live explanations without slide export.

## Phase 19: agent command bridge

Type: Integration  
Estimated: 4 hours, 15 minutes human review  
Files: `src/agent/agent-context.ts`, `src/agent/agent-tools.ts`,
`src/agent/agent-policy.ts`, `src/agent/agent-receipts.ts`,
`src/commands/command-registry.ts`, `src/agent/agent.test.ts`

Tasks:

- [ ] Expose bounded queries for content, relations, windows, regions, waypoints, and current commands.
- [ ] Generate tool contracts from ArkType command inputs. Preserve the input contract during conversion.
- [ ] Route product and framework commands through the same registries as the UI.
- [ ] Require previews or confirmation for bulk, destructive, and external operations.
- [ ] Return durable receipts with affected records, windows, revisions, and undo semantics.
- [ ] Keep model providers optional and outside command authority.

Verification:

- [ ] The agent creates a note, opens it, relates it, groups its view, and navigates to it through named commands.
- [ ] Invalid and disabled commands cannot bypass UI availability rules.
- [ ] Destructive and bulk commands stop at the approval boundary.
- [ ] No agent tool accesses DOM, raw Legend observables, or unrestricted SurQL.
- [ ] Receipts match the visible and durable result.

Exit: agent control uses product safety rules and no separate automation path.

## Remote design pressure

The schedule excludes remote sync and collaboration. First, the local product
must prove its content, spatial organization, retrieval, media, presentation,
and agent workflows. Durable IDs, record revisions, typed commands, personal
view state, and permissions-ready ownership remain active constraints. Later
remote work must preserve those authorities.

Remote implementation enters the schedule only after the local milestones are
completed. One concrete cross-device or sharing workflow must also have an owner
and acceptance path.

## Frontier activation gates

These programs remain outside the scheduled phases:

- Semantic retrieval activates after lexical-search evaluation records repeatable misses.
- Shared live layout activates after a serializable document-mutation protocol preserves group invariants under reordering and replay.
- Dense GPU objects activate after a real canvas exceeds DOM and CPU spatial-target budgets.
- A spatial index activates after profiling shows nearby queries dominate a product path.
- Rasterization activates after a real heavy body misses frame budgets despite correct subscription isolation and culling.
- Columns layout activates after a real workflow needs append-without-resize and shell-local scrolling.
- Recorded walkthroughs activate after tours, media, remote sharing, and permission boundaries are stable.

## Validation posture

Use this validation process:

- After each phase, use `vp check`.
- After each phase, build the package locally.
- Add direct tests for pure data, command, query, and geometry behavior.
- At the target version, get parse and runtime proof for each SurQL file.
- Use product-shaped fixtures to prove thresholds, summaries, body invalidation, and recovery.
- For each scheduled five-minute checkpoint, use one headless `agent-browser` session for one predeclared visible or interactive question.
- Before browser launch, make the target URL pass a terminal HTTP health check.
- End every browser checkpoint with `agent-browser close`, an inactive session report, and no owned headless Chrome process.
- Treat a passing test as support only for its claim. Require separate proof for a usable product workflow.
