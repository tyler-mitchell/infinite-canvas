# Polkadot roadmap

Polkadot is an open-source, local-first spatial workbench on `@hyphened/infinite-canvas`.
It also exercises the framework through product requirements.
A missing generic capability appears as an operation that the application cannot do.

One ownership rule applies.
Polkadot adds a discovered gap to the framework only through a generic capability.
For example, `renderBackdrop` gives consumers the product-neutral operation "replace the ground".
A `dotField` property encodes one product feature in the framework.

## Pacing

Each item that follows is one sprint.
A session completes one item with its required proof or completes no item.

An incomplete feature can appear completed.
Later work then depends on behavior that has no full implementation.
This problem occurred twice:

- One pass implemented the dot field, and later work deleted it.
- The first design pass changed tokens and presented that change as a product identity.

In both cases, the incomplete work occupied the place of the real feature.

## The bar

The product bar requires more than "a working canvas app".
Linear, Raycast, and Arc are the reference products.
Review enforces these rules:

- **Use a hairline for separation.** This rule replaced "use light for depth" on 2026-09-06.
  The owner supplied a reference and asked for its exact style.

  Measured from that reference: page 0, panel L 0.134, card L 0.159, hairline L 0.252, all neutral.
  The surface scale now spans L 0 to L 0.19.
  Lightness cannot separate two surfaces across that range, so a hairline does it.
  Every window, dialog, panel, list and card draws one, and `FLOATING_SURFACE` owns the recipe.

  The hairline is solid, not translucent white.
  One value must hold over a window body, a canvas, and black.
  An alpha edge changes with whatever it covers.

  A bevel and a hairline are two edges for one job, so the specular top edge is gone.
  Shadows are short: a large soft shadow needs a ground lighter than the shadow, and black leaves
  nothing to darken.

- **Keep the ink warm and the ground neutral.** This rule also changed on 2026-09-06.
  The reference measures neutral at every surface level, and its ink measures warm at hue 85 to 91.
  Polkadot already used hue 85 for ink and kept it.
  The ground lost its blue component, because a tinted ground was what made the interface read grey.
  The accent is now the only colour on screen, which is what makes a selected connector legible.

- **Set chrome in the mono face and prose in the sans face.**
  The reference measures monospace throughout: glyph advances of 13 to 16 pixels, and 28 where a
  space falls.
  Every label here is a name, an id, a count, or a state, and a uniform advance aligns a column of
  them.
  A note body is writing, and a fixed pitch slows reading, so content keeps `--font-sans`.
- **Use springs for spatial motion.** Do not use linear ramps or CSS transitions for that motion.
  Use `--ease-settle` and `--ease-swift` so individual sites do not define the easing again.
- **Keep the ground still.** This rule replaced "keep the ground responsive" on 2026-09-07.

  The owner declined the responsive field a third time, and this time for a reason that closes it:
  it is too slow to justify further work. A ground that answers the pointer is no longer the bar.

  What the ground is instead: flat black, one tile of fine static noise, and two rules of grid
  lines. Measured over black, the noise averages rgb(0.89) and the lines reach rgb(2) and rgb(1).
  Nothing on the ground moves or repaints except the grid, which shifts with the camera.

  A spotlight was tried on the same day and removed. It read as a generic product-page glow, and it
  sat centre-top because that is where such gradients go, not because anything there needed light.

- **Define every class through a `tv` slot.** Do not put Tailwind strings in JSX.
  Global CSS contains only tokens, resets, and imports.
  Every global rule is inside a layer, except `:root`.
- **Prove that each visual declaration wins.** A generated declaration can lose without an error or type failure.
  It can also produce a result that does not look broken.
  The application found seven cases of this defect.
  Three came from cascade layers, and one came from a framework inline style.
  The project found three more cases on 2026-08-28.

  A later case, on 2026-09-06, was a rule that stopped being applied rather than a lost declaration.
  The palette made the hairline the separator and gave one to every window, dialog, list and card.
  `FLOATING_SURFACE` was missed, so the library rail, the HUD, the minimap, the conflict notice and
  the offscreen indicators still relied on lightness.
  An empty project showed it: the rail sat at L 0.134 on black with no edge.
  A `getComputedStyle` read on the rail is what settled it.

  `material.ts` described a hairline but produced a four-sided ring.
  The minimap plate covered the fill and hairline of its frame.
  One selector declared `--icx-header-active` twice, so the later value removed the grain.
  A screenshot did not expose these defects.
  After each visual change, read the computed value with `getComputedStyle` and compare it with the declaration.

  Two of the last three defects were duplicate properties instead of cascade losses.
  Run `awk` over `styles.css` to find custom properties that have more than one declaration.
  The current scan reports one remaining duplicate, `--icx-surface-shadow`.
  Its two declarations belong to different selectors and are both correct.

- **Use maintained libraries for owned behavior.** Use TanStack Router, Pacer, Hotkeys, Form, Virtual, and DB.
  Also use Base UI, cmdk, ArkType, Legend State, motion, and tailwind-variants.

The project ran a declaration scan on 2026-08-28.
It compared every arbitrary `text-[Npx]`, `justify-*`, and `font-*` value with its computed value.
The scan found zero differences.
The project also exercised semantic zoom at its boundary that day, and the boundary held.

Another scan covered the slots for archive timestamps and code-block controls.
It included `archivedCell`, `archivedWhen`, and `itemWhen` in both switchers.
It also included `copied` and `failed`.
The scan found zero differences.

`text-[10.5px]` overrides the menu item value of `14px`.
`ml-auto` resolves correctly.
Both icon colors resolve exactly to `--accent` and `--danger`.

Twice, a probe measured the wrong element and reported a false failure.
Before you accept a difference, make sure that the probe reads the element matched by the selector.

A new window kind with a summary must set its minimum short axis to more than 160.
The smaller on-screen axis uses `summaryBelowPx: 120` and `fullAbovePx: 160` for the detail band.
Restore requires a value greater than 160.
A kind at exactly that value changes to summary and does not return.
`note` and `collection` use 200 and 220.
`link` and `image` have no summary, so this detail lane has no effect on them.

**Where the summary stops working, measured on 2026-09-07.**
A summary card holds a title and as many wrapped body lines as fit, and its padding follows the
card rather than holding one size. Measured live, padding is a steady 14% of the short side from
zoom 0.5 down to 0.25, against 20% rising to 69% when it was a fixed ten pixels.

**The card carries a title much further out than this file claimed.**
The paragraph here said the card "cannot carry text at all" below 30 screen pixels, and that at
zoom 0.15 the title was three characters and an ellipsis. Re-measured at that exact zoom on
2026-09-07, with a 29px short side: `Half limits` shows all 11 characters, `Shared state` 11 of 12,
`Company policy` 13 of 14, `models.dev` 8 of 10. The old figure was taken while padding was a fixed
ten pixels, which spent 20 of those 29. The padding fix reclaimed the width and nobody re-measured.

Two tiers now, both chosen from geometry rather than from the loaded text, so a card does not
change shape when its note arrives:

- **Title and body**, while two body lines fit. Below that a wrapped line is a single word, and
  measured at 1440x900 the body read `Halves` at zoom 0.18 and `Halves every` at 0.22. A lone word
  reads as damage, not a preview.
- **Title alone**, centred, clamped to the number of lines the card actually holds. A fixed clamp
  of two sliced both lines on a card that holds one.

Line height is one number. `SUMMARY_LINE_HEIGHT` sets the measured box and the drawn box, because
`leading-[1.4]` rendered 15.4px against a measured 15px and the last line clipped.

The end of the text tier is not established. Titles were still legible at a 23px short side, which
is the smallest this canvas was driven to. An icon remains the plausible successor below whatever
that limit is, but the size that motivated it turned out to be wrong, so the limit needs measuring
before an icon is designed for it. The kind glyph the library rail draws is not that icon: on a
canvas whose windows are all notes it would say "note" four times.

## Open

This section is a log, not a queue. Most entries carry their disposition in the last line of the
body rather than the heading, so an item can read as work waiting to be picked up and turn out to
be closed, declined, or blocked once you reach the end of it. Read an entry to its end before
starting on it.

Headings marked `RESOLVED`, `CLOSED`, `ACCEPTED` or `BLOCKED` have been checked. An unmarked
heading means nobody has classified it yet, not that it is open.

- **RESOLVED. A camera navigation request could delete the camera.**
  Found on 2026-09-07 by driving the store handle, not by product code. Polkadot calls none of the
  navigation commands, so the application never reached it.

  Both switches in `camera-navigation.ts` cover every member of their declared union. Neither had a
  default, so the compiler treated the end of each as unreachable. A caller from outside TypeScript
  reaches that end and receives `undefined`, and `navigateCamera` guards with `camera === null`,
  which `undefined` passes. The value entered state as `camera: undefined`, the next render read
  `state.camera.zoom` in a store selector, and the whole window tree fell to the error boundary.

  The type system hid this. The signature says `| null`, and that was false at runtime.

  Both switches now return `null` for a shape they do not know. Removing either default makes
  `camera-navigation.test.ts` fail with "expected undefined to be null".

  The lesson generalises past this file: an exhaustive switch with no default is a lie at every
  boundary the compiler does not own, which here is the store handle, a serialized command, and
  any consumer written in JavaScript.

- **RESOLVED. `content.list` reported zero connections before relations loaded.**
  Closed by `e3a9e62`. `getLoadedRelations` returns null until a query for that project answers,
  `app-tools.ts` reads it for the report, and `relations-loaded.test.ts` pins the null.
  The account below is kept because the reasoning decided the shape of the fix.

  `relations$` starts as an empty array.
  Thus, "nobody has asked yet" and "there are none" use the same value.

  Its docstring calls the empty array "the honest interim answer".
  This answer is correct for the original visual readers.
  A connector layer that draws no relation for one frame corrects itself on the next frame.
  A generated sentence has no later frame.

  An effect calls `loadRelations`, and no caller waits for that effect.
  As a result, a caller that asks immediately after `project.open` can receive a false zero count.

  `project-content` uses a nullable observable because "nobody has asked yet is not there are none".
  The same change in this store affects twelve readers.
  Eleven readers draw content or resolve a click, and they require the interim empty array.

  As a result, the store answers the loading question through `getLoadedRelations`.
  It returns `null` until a query for that project finishes.
  Only the report uses this function.

  One half of this behavior cannot run in the Node test process.
  A state change after `loadRelations` requires the database.
  The WASM engine does not start under `vp test`, as the skip in `in-memory-engine.test.ts` records.

  Tests pin the initial result and project key.
  They also pin the phrase "not loaded yet" instead of "No connections."

- **A published verb reported "done" before its database write finished.**
  The framework type caused this error.

  `getCanvasCommandTools` calls `run()` and returns `"<label> done."`.
  This sequence is correct for a canvas command because the reducer finishes before it returns.
  It was incorrect for a consumer verb.

  Polkadot publishes `connection.cut` to agents through `hotkeyActions`.
  This action deletes a row and reloads the relations.
  A caller received the completion message and then read a relation that still existed.
  The application-action code already guards against this error with "Awaited so a write verb's 'done' means written".

  Polkadot required a framework change.
  `InfiniteCanvasHotkeyAction.run` previously used `(state) => void`.
  As a result, a consumer action had no channel for its completion promise.
  `InfiniteCanvasContextualEntry.run` then discarded that result.

  Both functions return `Promise<void> | void`.
  The contextual entry forwards the consumer promise, and the tool waits for it.
  Keypress and palette callers continue to ignore the result.

  This type change was not purely additive.
  TypeScript gives `=> void` special assignability and accepts an implementation that returns any value.
  A union does not have that rule.
  As a result, `run: () => arr.push(x)` stopped compiling.

  Two framework tests used that expression form.
  Braces corrected those sites, and the compiler identifies every other incompatible site.
  The new type represents the actual completion contract.

  The first regression test passed with the broken implementation.
  It used `await Promise.resolve()`.
  Even a dropped promise leaves `await undefined`, which yields one microtask.
  That delay let a microtask-only consumer finish before the assertion.

  A macrotask separates promise forwarding from promise loss.
  Dropping the promise again then caused the corrected test to fail.

- **`canvas.describe` reported only the window part of the selection.**
  Its registered description is "zoom, the open windows and their kinds, groups, and the selection".
  The implementation described `selection.windowIds`.

  A selected connector fills `selection.targets` and leaves `windowIds` empty.
  A live canvas measurement proved this state.
  As a result, the caller received an empty selection while the canvas highlighted a connector and showed its rail.
  The rail arrived in the same session, but the report still used the old window-only model.

  The correction uses two reports.
  `describeRelations` already explains that an edge joins two records and can outlive both windows.
  A canvas-only description identifies the drawing instead of the durable relation.

  The canvas report counts selected connections and directs the caller to `content.list`.
  The content report already owns the record pair that identifies an edge.
  It also accepts `state`, so it marks the selected relation.
  No function signature changed.

  The report text has no live agent witness.
  The development application exposes no handle for reporting tools.
  `navigator.modelContext` is undefined in this browser.
  Tests pin the generated sentences.

  The state that those sentences read has a live witness.
  Clicking a connector fills `selection.targets` with `type: "edge"` and clears `windowIds`.

  Cross-references in tool descriptions have a guard.
  Examples include "with the ids `content.restore` takes" and "Ids come from `content.list`".
  These phrases tell a caller which operation supplies an input and which operation consumes it.

  A renamed operation can leave such text with an invalid name.
  The compiler cannot find this error because the description is a string.

  A scan compares every cross-reference with the current tool list.
  It derives namespaces from the tool names, so the scan uses the same vocabulary.
  Every current reference resolves.
  A deliberate rename made the scan identify both the source and destination names.

  This scan cannot prove that a description matches function behavior.
  Source reading found the original selection mismatch.

- **A link rename left stale visible and accessible names.**
  `createContentCache` reads once.
  This policy is correct for image bytes and a link address because those values do not change.
  It is incorrect for a title because rename changes that value.

  Rename writes storage, updates `projectContent$`, and sets the window chrome.
  It did not update the cache.
  `renameProjectItem` identified three name locations and described an omitted location as "right in some surfaces and stale in others".
  The cache was a fourth location.

  A browser test ran on 2026-08-28.
  Storage and the window chrome showed "Third Name".
  The link bar directly below the chrome still showed "New Link Name".
  Reverting the correction and renaming again reproduced the problem.

  The link name comes only from the listing.
  It does not fall back to the cached value because that value is stale.
  Existing guards already define both listing states.

  Before the listing answers, the UI says "Loading".
  After the listing answers, an absent item is gone.
  The collection window uses the same rule.

  The scan found a second stale value that the first correction missed.
  The `title` of the `iframe` still read the cached record.
  This property supplies the accessible frame name, so the stale value was not visible.

  Image windows do not read a title.
  They render `content.description` and `content.source`, so they do not have this defect.

- **A collection derives its result from live project state.**
  Previously, `resolved$` cached each answer.
  `refreshCollection` updated that cache only when the window opened or its question changed.

  A browser test ran on 2026-08-28.
  Storage contained four notes, while an open collection showed three rows.
  The fourth note arrived after the collection window opened.
  The collection docstring identifies stale results as behavior that a collection must prevent.

  Six operations can change the answer: create, archive, restore, rename, connect, and disconnect.
  Adding a refresh to all six operations leaves the next new writer unhandled.
  The `project-content` header already states this problem for the rail cache.

  The implementation removed the collection cache and database query.
  Pure function `resolveCollectionItems` reads `projectContent$` and `relations$`.
  Both observables are live authorities.

  After the correction, a new note appeared in the open collection on the same tick.
  The view did not require a reload.

  The change removed `resolved$`, `refreshCollection`, `collectionGateway.resolve`, `content.listRelated`, and `listRelatedContentItems`.
  Pure resolution also permits unit tests, while the database query did not.

  `fn::list_related_content_items` remains in the schema.
  Its removal requires a migration.
  The client stopped using the function, but the function remains correct.

  Tests cover relation-based collection changes.
  Both collection branches read the same two observables.
  The kind branch has a live witness.
  No connection collection was open during an edge removal, so that branch has no browser witness.

  A second cache held the collection record itself.
  `collections$` stored the title and revision.
  Rename wrote storage and updated the listing, so both cached values became stale.

  A browser test renamed a collection and then changed its question.
  The second write failed with `ContentRevisionConflictError ... changed after revision 4` while storage had revision 5.
  The question did not change on screen.
  An unhandled rejection was the only error signal.

  The correction addressed two causes.
  `renameProjectItem` used `void` for collection, image, and link writes, which discarded the returned revision.
  `TITLE_WRITERS` return the saved record.
  The caller stores that revision through `setProjectItemRevision`.

  The collection record derives from the listing and has no stale local copy.
  The change removed `collections$`, `ensureCollectionLoaded`, and `collectionGateway.read`.
  A collection stores no record state of its own.

  A later browser test moved rename from revision 5 to 6.
  The question change moved revision 6 to 7 and finished.
  The title remained, and no rejection occurred.

  **Corrected on 2026-09-09.** A failed rename had no visible signal, and the reason given here was
  half wrong. The result channel existed: `renameProjectItem` returns a refusal string, and
  `content.rename` returns it straight out of `run`, which `getAppActionTools` already awaits. What
  was missing was that the write's own failure never reached that channel.

  The write is now awaited and a rejection returns down it. The listing and the window title move
  after storage confirms rather than before, which is what removes the divergence: the old code
  named the screen first, so a lost revision conflict left a title on screen that storage did not
  have, and the only signal was an unhandled rejection.

  The first attempt at this added an optimistic update plus a revert plus a warning. The revert
  only existed to undo the optimism, so removing the optimism deleted all three. The awaited
  version is shorter than the code it replaced.

  One case stays silent. A note rename goes through `renameNote`, whose writer returns null because
  the note store owns its own queue and revision, so no rejection reaches this path for a note.

- **A mention navigates to its target note.**
  From its first implementation, the chip used `cursor-pointer` and wrote `data-note-id`.
  The docstring in `mention-node.ts` described "the click handler that reaches the note".
  No code read the attribute.

  Three files reference `MentionNode`, and none previously registered a listener.
  As a result, the pointer shape advertised a destination that did not exist.
  This interaction defect produced no error or failing test.

  The new handler belongs to the note window instead of `note-editor`.
  The editor has no knowledge of notes.
  The handler resolves the target through the listing that the typeahead already loaded.

  A plain click activates the navigation.
  The `segmented` node selects the complete mention and does not permit an internal caret.
  As a result, navigation does not replace an available pointer-edit action.

  The browser test started with the mentioned note window closed.
  Clicking `@Untitled 1` opened the window and made it active.
  A second click revealed the same window without opening a duplicate.

  Links had the same missing interaction, and a browser test proved the correction.
  `EDITOR_EXTENSIONS` mounted `LinkExtension`, which provides the node, toggle command, and paste behavior.
  It did not mount `ClickableLinkExtension`, which registers link clicks according to Lexical.

  On 2026-08-28, a real `LinkNode` rendered with an underline and `--accent`.
  Clicking it had no effect.
  `configExtension(ClickableLinkExtension, { newTab: true })` adds the missing behavior.
  The witness observed `window.open("https://example.com", "_blank")`.

  The configuration uses `newTab` because the canvas is the workspace.
  `_self` leaves the current page and removes the arranged windows from view.

  This choice has an editing cost.
  A plain click activates the link without examining editor editability.
  As a result, a pointer cannot place the caret inside link text.
  Selection across the link still works because the handler ignores a non-collapsed selection.
  Keyboard navigation can also move into the text normally.

  Autolink remains disabled for more than the quoted "not built" reason.
  `NOTE_NODES` included `AutoLinkNode` for the headless editor.
  The application did not mount `AutoLinkExtension`.
  In addition, `LINK` in `TRANSFORMERS` creates a `LinkNode`.
  No current operation can create the autolink node.
  As a result, the list did not mirror the editor, and the correction removed that node.

  Autolink also requires an export transformer.
  `LINK.export` returns `null` for an autolink.
  Export emits bare text and loses the URL for every `note.read` caller.
  `note-markdown` exists to prevent that loss.

  The node list and transformer list define one agreement.
  A future autolink change must add the node transformer at the same time.

  Browser automation did not activate Markdown shortcuts.
  Typing `[Example](https://example.com)` or `# Heading` left literal text.
  But `MarkdownShortcutPlugin` is mounted with the complete `TRANSFORMERS` list.
  The roadmap also records a working measurement for `# `.

  This calibration identifies the automation input path as the difference.
  The session did not file an application defect.
  It created the test link by writing serialized editor state directly to the record.

- **CLOSED. The living field remains implemented and unmounted.**
  Its implementation is in `canvas/field.tsx`.
  `workspace-canvas.tsx` does not supply `renderBackdrop`, so the application uses the default framework grid.

  The implementation corrected three known costs:

  - An idle gate produces 0 draw calls at rest.
  - One rectangle pass supplies the field inputs.
  - One device pixel represents one CSS pixel.

  The owner disabled the field again for two reasons.
  These measurements came from the development browser pane instead of the real display.
  The field also belongs in the future scene compositor instead of the backdrop slot.

  **The owner declined it a third time on 2026-09-07, and this closes the item.**
  The stated reason is that it is too slow to justify further work on it.
  Do not remount it, and do not resume the two incomplete behaviors below.

  The two behaviors that stayed incomplete, recorded so the next reader knows what stopped:
  lattice spacing stayed in screen space while only phase followed the camera, so zoom never made
  the ground finer; and a dragged window needed a stronger pull than a stationary one, for which
  rectangle velocity existed with no consumer.

  `canvas/field.tsx` and `canvas/field-shader.ts` are still in the tree and still unreferenced.
  Deleting them is available and is the owner's call, not an agent's.
  Nothing imports them, so they cost nothing but the reading.

  **Corrected on 2026-09-09: both sentences here were true when written and are now false.** The
  field is no longer the only GPU work, and `unplugin-typegpu` is no longer compiling for nothing.
  `workspace-canvas.tsx` passes `sceneSurface={InfiniteCanvasCompositorSurface}`, so the framework's
  TypeGPU compositor mounts and draws — verified live at 2560x1346, owning the grid with zero CSS
  grid nodes and painting contact shadows under both windows at 42% zoom.

  This matters more than a stale sentence usually would, because acting on the old text breaks the
  canvas silently. The plugin is what turns a `"use gpu"` body into WGSL, including the framework's
  own passes compiled through this app's bundler; `vite.config.ts` says so on the line above it.
  Removing it as dead configuration would leave those bodies as ordinary JavaScript that never
  reaches the GPU, with no error and no failing type.

  The field itself stays declined and unmounted. Nothing here reopens it.

- **The mention typeahead produced one unexplained empty result.**
  On 2026-08-28, it said "No note by that name" while three "Untitled" notes were open.
  The result appeared in a note window after a project switch away and back.
  The problem has not appeared again, and its mechanism remains unknown.

  The investigation found and corrected a separate ownership problem.
  Three UI surfaces read `projectContent$` through `listing?.projectId === projectId`.
  They did not get `projectId` from the same source.

  The rail and palette used the route-loader property.
  The note window, two collection surfaces, and two HUD surfaces used `openProject$`.
  That observable republished the same loader value.

  `SelectionRail` read both sources, and the line above contained an unused `canvas.projectId`.
  The implementation deleted `openProject$`.
  A window body is already inside the route tree and can read the loader directly.

  This ownership correction does not prove a correction for the empty typeahead.
  The same sequence cleared the note and reloaded the page before mentions worked again.
  As a result, no change has a proven causal link to the symptom.

  The refactor remains valid because one source owns project identity.
  If the empty result returns, examine the same guard.
  Its project argument has one source.

  Console probes gave contradictory results in this investigation.
  One probe read a real project ID from `openProject$`.
  A fresh module instance starts that observable as `null`, so it cannot produce the observed value.

  The same probe read `projectContent$` as `null` while the visible rail showed listing rows.
  `AGENTS.md` describes this module-identity problem.
  A future reproduction must use a test that navigates between projects.
  Do not use another console probe.

- **Consequential WebMCP calls require a confirmation policy.**
  The specification has no `destructiveHint` and no elicitation mechanism.
  As a result, a caller cannot distinguish the risk of `selection.close` from the risk of `canvas.describe`.

  The application renders third-party content and publishes actions that close windows.
  Define the confirmation policy before an agent beyond the developer's DevTools client can use those actions.

  Three WebMCP areas still require proof:

  - The declarative (`<form>`-annotation) path.
  - Cross-origin `exposedTo` behavior.
  - Behavior with a real browser-integrated agent.

  **Scope narrowed on 2026-09-09 by reading the two tool sources.** The obvious shape for this is a
  consequence field on `InfiniteCanvasCommandDescriptor`, so that a caller can read risk off a
  published verb. Reading `commands.ts` says not to build it. Every framework command is either a
  document operation, which canvas history already covers, or a view operation, which changes no
  data. Neither needs a confirmation. Adding a required field would touch roughly one hundred and
  thirty descriptors to record "undoable" one hundred and thirty times, and an optional one would
  default a future destructive command to safe, which is the wrong direction to fail in.

  The risk lives entirely in `app-actions.ts`, because that is what writes to the database, and
  nothing there is irreversible today: `project.archive` is documented "Reversible with
  project.restore", and its five siblings follow the same archive and restore pair. Deletion is
  the only irreversible operation and it is deliberately unpublished, which is what the item
  below records.

  So the policy is a Polkadot concern over its own actions, not a framework capability, and it is
  needed at the moment deletion is published rather than before. That ordering is the opposite of
  what this item assumed. It does not need the word Polkadot to justify itself, because the
  framework has no irreversible operation to classify.

- **BLOCKED. Canvas and project deletion remains pointer-only.**
  Archive actions have landed and have an end-to-end witness.
  They include `canvas.archive`, `restore`, and `listArchived`, plus the three project equivalents.

  The database contained all six operations from the first switcher implementation.
  Only the published actions were missing.

  `deleteProject` is destructive because it cascades and removes writing.
  Its pointer surface requires the exact project name.
  A published action cannot reproduce this typed-name confirmation.
  WebMCP also has no elicitation mechanism.

  As a result, deletion waits for the confirmation policy instead of more implementation work.

- **A caller can name every document that it can create.**
  Saved views have a `Reframe a
view` menu mode.
  They also have `view.save`, `list`, `open`, `reframe`, and `remove` actions.

  Browser tests exercised all five actions.
  The action path uses the menu helper's numbering.
  Thus, pointer-created and action-created views share one number sequence.

  `workspace.rename` closed the remaining naming gap and has a browser witness.
  Its blank-name refusal matches the pointer rule from `useInlineRename`.

  Deletion remains pointer-only as the prior item describes.
  The two removal dialogs are confirmations instead of independent capabilities.

- **The UI makes reversible archive actions visible.**
  The duration of the recovery offer remains unmeasured.

  `undoableAction$` existed from the first reversible archive implementation.
  A palette row was its only UI surface.
  As a result, the rule "no dialog, because it is reversible" depended on an invisible recovery path.

  `UndoNotice` appears above the selection rail.
  A browser test archived a note and showed `Undo archiving "Untitled 1"`.
  Activation restored the note.

  The notice remains for eight seconds.
  No usage observation supports that duration, and it is the only timing value in this UI.

  The connection-cut dialog remains.
  It quotes the relation claim before removal.
  A user can also start the cut through Backspace or a palette row while the label is outside the viewport.
  Undo helps only when the user already knows that an edge changed.
  The dialog records this decision where it applies.

- **RESOLVED. All application surfaces use one inset-shadow rule.**
  Every inset shadow measures `oklch(1 0 0 / 0.07) 0 1px 0 0 inset`.
  This value applies to window frames, Polkadot rails, framework HUD groups, and the minimap.

  Earlier versions of this item made two claims without measurement support.
  The first claim said that the rails had no shadow.
  They used `--lift-2` throughout, and only the hairline was incorrect.

  The second claim described the note body as a flat fill that needed top-down light.
  Its background is `var(--grain),
var(--surface)`.
  The frame and idle header use the same material.
  This uniform interior is intentional.

  Interior lighting adds decoration without depth.
  This area requires no correction.

- **The note editor was two Lexical generations behind the current API.**
  Before 2026-08-28, no project work had examined the Lexical documentation.
  That investigation cloned `facebook/lexical` into `reference/` and read its documentation tree.
  The findings that follow come from the packaged documentation instead of an API-name list.

  Rich-text support was already present.
  In a live note, `# ` produced `<h1>`.
  Input `- ` produced `<ul><li>`, and ` ```js ` produced a `CodeNode`.
  Headings, lists, links, quotes, and Markdown shortcuts all worked.

  The investigation found a code-block style defect.
  A block computed `display: inline` and received pill padding.
  The `[&_code]` selector for inline code also matched the block.

  Lexical distinguishes the block key `code` from the inline key `text.code`.
  The application used `EDITOR_THEME = {}` and selected by HTML tag.
  Tag-based styling cannot express the Lexical node difference.
  A comment defended the empty theme even though that theme had no way to represent the editor model.

  The theming documentation lists additional keys:
  `list.olDepth` gives markers for each ordered-list depth.
  Other keys include `list.nested.listitem`, `listitemChecked`, `Unchecked`, `hr`, and `hrSelected`.
  It also lists `blockCursor`, `text.highlight`, `text.capitalize`, `lowercase`, and `uppercase`.
  `codeHighlight` is a Prism token map, and `tableSelection` styles table selection.

  Experimental package `@lexical/tailwind` directly addresses the 804-character class string.
  Its theme values are Tailwind class strings keyed by node.
  The application needs this node-keyed form instead of tag-based styling.
  It keeps one authority for note appearance.

  The documentation uses `MentionNode` as its "before" example.
  For Lexical v0.26 and later, the documentation directs users toward `NodeState` instead of subclass properties.

  `$config()` with `stateConfigs: [{flat: true, stateConfig}]` preserves byte-identical wire JSON.
  It removes handwritten `clone`, `importJSON`, `exportJSON`, and `updateFromJSON` methods.
  The former project node contained all four methods and `__noteId`.

  The documentation recommends ArkType for the `parse` function, which the repository already uses.
  Its migration guide has a Keyword example with the same TextNode form.
  The example uses `isTextEntity` and `canInsertTextBefore`.
  Its complete version removes React through `registerLexicalTextEntity` from `@lexical/text`.

  The claimed `tv`-slot violation was already absent.
  `mention-node.ts` used a `tv` slot instead of a raw class string.
  But the node still styled itself and created a second appearance authority.
  It also imported `ui/tv` inside a Lexical node.

  The `EDITOR_THEME` docstring already says that values come from `tv` slots so classes have one owner.
  The mention class is a theme key that `createDOM` reads.
  The node imports no style code.

  After this change, the chip computed `--accent-wash` at 0.12 and used `--accent`.
  It also measured a 4px radius and 1px/4px padding.

  Syntax highlighting moved to new packages in Lexical 0.49.
  `registerCodeHighlighting`, `PrismTokenizer`, and the language helpers are deprecated.
  The current choices are `CodePrismExtension` from `@lexical/code-prism` and `CodeShikiExtension` from `@lexical/code-shiki`.
  Neither package was installed at the time of this finding.

  Do not migrate Markdown yet.
  `@lexical/mdast` implements CommonMark and GFM through one grammar for import and typing shortcuts.
  It preserves syntax through `NodeState`.
  The documentation keeps `@lexical/markdown` as the supported default for applications that do not track an experimental API.
  The mdast package also adds ~26 kB.
  Continue to track it without adoption.

  The Extension API replaces `LexicalComposer`.
  Both the documentation and the Lexical `AGENTS.md` direct applications to migrate.
  `defineExtension` and `configExtension` are part of `lexical` core, so migration adds no dependency.

  Lexical 0.49 includes `RichTextExtension`, `ListExtension`, `CheckListExtension`, `LinkExtension`, and `AutoLinkExtension`.
  It also includes `ClickableLinkExtension`, `CodeExtension`, `CodeIndentExtension`, and `HistoryExtension`.
  The remaining installed parts are `TabIndentationExtension` and `LexicalExtensionComposer`.

  The minimum migration keeps `LexicalExtensionComposer`, sets `contentEditable={null}`, and leaves each existing plugin as a child.
  An extension can also define `conflictsWith` and optional `peerDependencies`.
  Its lifecycle contains `config`, `build`, `register`, and `afterRegistration` phases.

  Several unused packages remain candidates for evaluation.
  `@lexical/a11y` provides `FocusManagerExtension`, which uses Alt+F10 to enter a toolbar and Escape to return.
  It also provides `RovingTabIndexExtension`, `AriaLiveRegionExtension`, and `HistoryAnnounceExtension`.
  A canvas with floating editors needs focus management, and none of these parts were implemented.

  `SelectBlockExtension` makes the first Cmd+A select the closest block.
  A second Cmd+A selects the document.
  This behavior matters because the surrounding canvas has its own select-all action.

  Other candidates are `ClickAfterLastBlockExtension`, `EditorStateExtension`, `RootElementExtension`, `WatchEditableExtension`, and `IMEExtension`.
  The editor-state extension gives a signal instead of `OnChangePlugin`.
  `@lexical/eslint-plugin` finds incorrect uses of `$` functions.

  `@lexical/headless` owns note writing instead of `note-text.ts`.
  `note-markdown.ts` runs the actual editor without a DOM.
  It uses the same `TRANSFORMERS` as typing shortcuts.
  `note.read` and `note.write` use Markdown through this editor.

  The change deleted `toSerializedNote`.
  That function constructed the storage format by hand so writing did not require an editor engine.
  `note.write` was its only caller.

  The read path keeps its boundary without Lexical.
  It processes the complete library after each keystroke and needs words instead of document structure.

  Mentions require their own text-match transformer because `TRANSFORMERS` does not provide one.
  Export represents a mention as a normal Markdown link to its record.

  The project evaluated `@lexical/a11y` and rejected adoption.
  Three of four relevant extensions target toolbars or modals.
  `FocusManagerExtension` moves focus to a toolbar with Alt+F10.
  `RovingTabIndexExtension` adds toolbar arrow movement, and `FocusTrapExtension` traps a modal.

  This application has no toolbar.
  Base UI dialogs already trap focus.
  `AriaLiveRegionExtension` was the applicable part, but the canvas owns announcements.
  Polkadot uses `useInfiniteCanvasAnnounce` instead of a live region in every editor.

  The concepts documentation also records unverified correctness constraints.
  It says nested updates are "very strongly discouraged" and run later.
  `editor.read` accepts `'force-commit' | 'pending' | 'latest'`.
  Its default does not fit every reader.

  A text node must never contain `'\n'` because `LineBreakNode` represents that content.
  Examine the block-type split in `note-text.ts` against this rule.

  `isTextEntity` has no effect in the current integration, despite the former claim in `mention-node.ts`.
  Lexical core does not read it.
  Only `registerLexicalTextEntity` uses it, while this application uses `LexicalTypeaheadMenuPlugin`.

  The `segmented` mode keeps a mention together.
  `$shouldInsertTextAfterOrBeforeTextNode` returns true for a segmented node before any other test.

  This finding came from an investigation of a defect that did not exist.
  Synthetic typing made the DOM show `@Untitled 1 x @Un`, while stored state contained one correct mention.
  The automation action `type` omits the `beforeinput` path that contains the guards.

  A commit included a false claim before the session examined stored state.
  `AGENTS.md` records this automation limit.

  The editor changes from this investigation landed on 2026-08-28.
  They include the node-keyed theme and `LexicalExtensionComposer`.
  Four plugins became extension dependencies.

  `MentionNode` moved to `$config` and `NodeState` while it kept byte-identical JSON.
  Shiki highlighting also landed.
  Each code block received a Notion-style language picker and copy control.
  One storage cost and two gaps remained.

  Shiki stores presentation with the document, and measurement supports keeping that design.
  Each token stores a hex color such as `"style":"color:#CB7676"`.
  The code node also stores `"theme":"vitesse-dark"`.

  This format is the defined behavior of `@lexical/code-shiki`.
  It lets a note render correctly without a loaded highlighter.

  A measurement on 2026-08-28 used one code line with 122 characters.
  Storage used 2678 bytes across 21 `code-highlight` nodes.
  Nearby prose notes used 206–445 bytes.

  The hex colors and theme name used 545 bytes, or 20% of the code-note size.
  This measurement corrected the earlier explanation.
  One Lexical node for each token causes the other four fifths of the size.

  Prism also creates one `CodeHighlightNode` for each token.
  A switch to Prism removes the 20% presentation data and keeps the token-node cost.
  The important difference is theme support rather than size.

  The application declares `color-scheme: dark` and has no theme switch.
  As a result, the quoted "existing notes stranded on the old palette" cost does not occur today.
  Prism also requires a handwritten token map and currently supports fewer languages.

  Keep Shiki.
  If the application adds a light theme, revisit this decision because stored dark colors then become a real cost.

  The overflow menu and wrapping also landed with measurements.
  The `…` menu contains Wrap lines, Duplicate, and Delete.
  Wrap uses `NodeState`, so storage preserves the block setting.

  On 2026-08-28, `data-wrap="false"` computed `white-space: pre` and a height of 43px.
  The long line scrolled under `overflow-x: auto`.
  Value `true` computed `pre-wrap` and `word-break: break-word` at 101px.
  `scrollWidth` equaled `clientWidth`, so the content did not overflow.

  The same measurement found `display: block`.
  This observed value closes the inline-pill defect without relying on the theme source.

  Clipboard tests cover both outcomes.
  A trusted press changes the operating-system clipboard.
  The button then says `Code copied` with a check glyph.

  A programmatic press has no user gesture and rejects.
  The button then says `Could not copy the code` with the danger glyph.
  The two-argument `then` handles this otherwise silent rejection.
  Both outcomes return the button to its idle state.

  Page permission blocks a clipboard read after the write.
  The witness proves the write and both UI outcomes.
  It does not compare clipboard text with the code-block text.

  The Notion caption from the same menu remains unimplemented.

- **Two visual treatments have correct measured weights but no quality approval.**
  Window grain has a mean alpha of 8.93/255, which matches the intended 3.5%.
  A downscaled screenshot does not show 3.5% noise.

  The warm-text change modifies hue only, so its contrast value does not change.
  The development pane did not provide a before-and-after visual comparison.
  Both treatments require review on a real display.

- **Database writes require browser tests.**
  The WASM engine does not start under `vp test`.
  `connect("mem://")` waits forever instead of rejecting.
  The non-worker engine has the same behavior, so the Worker is not the cause.

  `database/in-memory-engine.test.ts` records a skipped test for this limit.
  A former refusal-suite comment said that a `void`ed write "fails harmlessly against an engine no test starts".
  The write did not fail.
  It remained pending forever, while the suite reported success.

  Node tests can assert decisions and rules.
  A database write needs a browser witness.

- **Offscreen chips still lack usage observation.**
  One visual review selected their current quiet peripheral treatment.
  No session has observed a user working with them.

  The minimap part of this item is closed.
  A 1440x900 browser witness closed and reopened the map.
  On close, `Show the map` replaced it.
  Reopen restored the plate and hairline.

  The framework zoom rail remained 113px from the bottom before and after the toggle.
  Thus, the quoted "reserves no band" requirement has a browser witness.

  `docs/API.md` removed the _unobserved_ status from `minimap` on 2026-08-26.
  The minimap half of this roadmap item was already stale.

- **ACCEPTED. A connector hidden by windows is effectively unavailable for canvas selection.**
  Two nearly touching windows can cover almost all of the line between them.
  Window targets resolve before edge targets, which is the correct priority.

  One measured arrangement left a 30px visible segment and put the midpoint inside a window.
  The marker uses the longest clear segment or draws nothing.

  This behavior is an accepted decision instead of a framework gap.
  The rail lists every relation whether its endpoint windows are open or closed.
  It can remove the relation in one click.

  A hit target outside the visible connector represents geometry that the UI does not draw.

## Framework gaps

Polkadot found these open generic gaps through product work.
Completed gaps are in `docs/API.md` and the changelog.

| Gap                                                                     | Generic affordance                                            |
| ----------------------------------------------------------------------- | ------------------------------------------------------------- |
| One camera action frames a target but cannot continue to follow it      | Sustained following with an explicit release rule             |
| Durable `selection` retains a scene object after that object disappears | Pruning through the resolver lookup opened by `getTargetRect` |

**On the selection-pruning gap, from reading it on 2026-09-07.**
`normalizeSelectionWindowIds` filters window IDs against the windows that exist.
`normalizeSelectionTargets` only removes duplicates, so a target outlives its object.

The lookup already exists. `getInfiniteCanvasSelectionTargetBounds` walks the selected targets
through every resolver's `getTargetRect` and drops the ones that answer null.
Pruning is that same walk written as a filter rather than a union.

What is missing is not the lookup but the policy: the reducer does not hold the resolvers, and the
store registers them from the view. Deciding when a target counts as gone, rather than
momentarily unregistered, is the part that needs a product case to settle.

Polkadot does not supply that case yet. Its readers filter selected relations against the live
relation list when they read, so a stale target never reaches the screen. Building the pruning
now would add a policy with no consumer to prove it right.

**Canvas announcements are implemented.**
The canvas originally put one `aria-live` region inside the HUD.
The HUD returns `null` when a consumer disables its controls, dock, and status card.
As a result, announcement support depended on visual HUD policy.
The region also exposed one fixed message and accepted no consumer message.

`InfiniteCanvasAnnouncer` mounts the region at the viewport.
`useInfiniteCanvasAnnounce` supplies a second region for consumers.
Polkadot uses it for both parts of the undo notice.
An end-to-end test observed the offer and then `Undone.` after activation.

No screen-reader test exists.
The current proof covers the DOM announcement contract only.

**Selection pruning still requires an ownership decision.**
`getTargetRect` returns `null` for a target that no resolver owns.
A removed object produces this result, so the framework can identify that shape.

A resolver that has not mounted yet produces the same result.
As a result, immediate pruning can remove a valid selection during the first frame.
Until the states differ, Polkadot readers continue to derive live selection on read.

**Both open gaps cross the same architecture boundary.**
The pure framework API accepts `state`, and `state` is serializable.
Consumer knowledge remains in property closures.
This knowledge includes current object bounds and object existence.

This boundary applies to every generic operation that uses consumer knowledge.
Do not copy the answer into serialized state.
A rectangle stored on a selection target becomes stale as soon as the object moves.
The framework needs a callable lookup instead of a stored value.

**Contextual discovery is the completed example.**
`getInfiniteCanvasContextualEntries` combines framework and consumer vocabularies into one list.
Each entry has a bound `run`, so consumer actions enter discovery without expanding the framework command union.

Framework actions retain `group`, while consumer actions have no group.
The merge defines what `run` means, so callers do not branch by action source.
`published-commands.ts` has only its intended filter role.

This change did not reduce `app-actions.ts`, which remains ~1400 lines.
The argument schemas and refusal strings belong to the product.
No missing framework capability owns that application logic.

**Selection bounds are implemented.**
The original diagnosis was correct.
`createInfiniteCanvasEdgeTargetResolver` and `…SceneObjectTargetResolver` accept a `targets` source.
Each target already includes its geometry.

The former context type also required a pointer position that no bounds consumer used.
The implementation split that requirement.
`InfiniteCanvasSpatialTargetGeometryContext` is `{ chrome, state }`, and the pointer resolver context extends it.
As a result, a resolver can answer target position outside a pointer event.

Each factory implements `getTargetRect` from its existing source.
A consumer receives bounds without another implementation.
The overlay factory does not provide bounds because it uses viewport pixels and its targets are not selectable.

`getInfiniteCanvasSelectionBounds` combines selected-window rectangles with resolver target rectangles.
The store exposes that result.
The viewport registers its resolvers with the store.
The consumer does not pass one resolver array to two properties, so those inputs cannot diverge.

This work did not add minimap or offscreen-ring enumeration.
The rectangle supplies exactly what "fit the selection" requires.
No consumer requested an enumeration API.

**A browser witness changed this item from a possible gap to a measured defect.**
On 2026-08-28, a click selected the connector between two notes.
Its stroke changed from `0.4` opacity to `1`, while `selection.windowIds` remained empty.

The Polkadot selection rail then disappeared because it read `selection.windowIds.length`.
The HUD "Fit selection" button became `disabled`.
`isInfiniteCanvasCommandEnabled` used `getSelectedWindowBounds(state) !== null` for `view.fitSelection`.

As a result, the UI showed a selected connector but removed every control that can frame it.
This observed result is more specific than the earlier phrase "nothing happens".
It also replaces the phrase "nobody has reported it" with a browser witness.

**Both observed effects are corrected.**
A connector rail appears for edge selection and can remove the selected connector.
The HUD fit button reads `useInfiniteCanvasSelectionBounds` instead of `selection.windowIds.length`.
The button and `view.fitSelection` ask the same question and cannot disagree.

A browser test on 2026-08-28 selected one labeled connector and no windows.
The fit button remained enabled with empty `windowIds`.
Activation changed camera zoom from 1 to 2.8 and centered the connector with a readable label.
Polkadot already supplied the resolvers, so this correction required no product change.

**The pure API boundary still makes full enablement expensive.**
Enablement is a pure function over serializable `state`.
Edge geometry is consumer knowledge stored in a closure.

Adding a provider to this pure API requires an architecture decision.
Do not add a partial provider that appears complete.
That outcome is the exact risk described in `Pacing`.

**The framework prunes only targets whose absence it can prove.**
A selection target without a resolver survives `normalizeSelection` and state hydration.
A dead window ID in the same selection is removed.

Polkadot readers resolve selected edge IDs against current relations.
As a result, a dead relation contributes no selection behavior.
Continue to derive this selection on read.

## Later, deliberately

- **Tours.** The framework provides `getInfiniteCanvasWorldPath` and `…PointAtProgress` for guided paths.
  No current feature uses them.
- **The 3D layer.** Window proxies and frustum culling exist behind `/scene`.
  Their valid product use is a far-zoom overview instead of decoration.
- **Sync.** The complete current product remains local-first.
  When remote sync becomes a concrete need, the project will use SurrealDB.
