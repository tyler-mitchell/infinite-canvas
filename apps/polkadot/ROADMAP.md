# Polkadot roadmap

Polkadot is a spatial workbench built on `@hyphened/infinite-canvas`, and it is two things at
once. It is a real product — local-first, open source, meant to be used. And it is the
framework's incubator: the place where a missing affordance shows up as a thing a real app
cannot do.

**Both roles have one rule.** A gap Polkadot finds is fixed in the framework _generically_, or
not in the framework at all. `renderBackdrop` exists because Polkadot wanted a reactive dot
field and the dynamic-grid experiment wanted a shader — the affordance is "replace the ground",
which is product-neutral. A `dotField` prop would have been the same feature and the wrong one.

## How this is paced

**Every item below is a sprint, not a checkbox.** Mentions is a sprint. The HUD is a sprint. The
living field is a sprint. A session is not expected to deliver more than one of them properly, and
delivering three of them badly is strictly worse than delivering none — a half-built surface reads
as finished, so nobody revisits it, and the next person builds on top of a foundation that was
never poured.

This has already happened twice here and both are instructive. The dot field was written in one
pass, looked plausible, and was a caricature of a simulated field; it had to be deleted. The first
design pass was a token swap presented as an identity. In both cases the cost was not the wasted
time — it was that the slot looked occupied.

So: pick one, do it to the standard below, verify it in a browser, and stop. Leave the rest
untouched rather than started.

## The bar

Not "a working canvas app". The reference points are Linear, Raycast, and Arc: software people
open because it feels good to look at. Concretely, and these are enforced in review:

- **Depth from light, never from lines.** No `border: 1px solid white/8%`. Surfaces separate by
  being lighter than the ground, casting a layered shadow, and carrying a specular hairline on
  the top edge. Outlines read as a wireframe of an app rather than an app.
- **Warm ink on a cool ground.** The neutrals are not neutral. Pure grey on pure black is the
  default nobody chose.
- **Motion has weight.** Springs, not linear ramps. Things that move in space settle; state
  changes are swift. `--ease-settle` and `--ease-swift` exist so this is not decided per-site.
- **The ground is alive.** The dot field responds to the pointer and is displaced by windows.
  A canvas whose background is wallpaper is a canvas you do not believe in. **This bar is not
  currently met** — the field is built and deliberately unmounted at the owner's call, so the
  running app has wallpaper. Stated here rather than only in the item below, because a bar that
  quietly stops applying is worse than one that was never written down. Read the item before acting
  on this: the cost that first took it off screen was fixed, and what keeps it off is a decision
  about where the field belongs, which is not an agent's to reverse.
- **Every class comes from a `tv` slot.** No Tailwind strings in JSX, ever. Global CSS is
  tokens, resets, and imports only.
- **Nothing hand-rolled that a maintained library owns.** TanStack (Router, Pacer, Hotkeys,
  Form, Virtual, DB), Base UI, cmdk, ArkType, Legend State, motion, tailwind-variants.

## Now

- [x] Vendored working `@surrealdb/wasm` 3.0.4 with `indxdb://`; deleted the 2.6.1 patch
- [x] SPA on TanStack Router; TanStack Start removed (its dev middleware never mounted, and the
      data layer is client-only so SSR bought nothing)
- [x] Local canvas open, autosave, reload — `indexedDB` holds `polkadot`. **This line was ticked
      for weeks while autosave wrote nothing.** The loop subscribed with `(state) => state`, which
      the store's per-field commit makes a constant, so no canvas ever left revision 0 — and the
      save-status pill read "Local canvas saved" throughout, because that is its initial value.
      What had actually been witnessed was the _note_ round-trip, which persists by a different
      path. Now genuinely verified: revision advanced 0 → 1 → 2 and a reload restored the camera.
- [x] Framework: `renderBackdrop`, the counterpart to `renderOverlay`
- [x] Design tokens: palette, elevation, motion, type
- [x] Framework tokens for window radius and elevation (`--icx-surface-radius`, `--icx-surface-shadow`)
- [x] **The living field.** Written once as a flat lattice, deleted, and now built for real — see
      below for what it actually is, because the description that stood here was wrong.
      **Currently unmounted, and not because the cost is still unfixed.** `workspace-canvas.tsx`
      passes no `renderBackdrop`, so what the running app shows is the framework's default grid.
      This line used to say it stays off "until that is fixed", which sent the next reader at the
      wrong work: the three known fixes all landed in `91b0fa0` — an idle gate measured at 0 draw
      calls at rest, one rect walk instead of two, and one device pixel per CSS pixel. It went off
      again in `d2af707` **at Tyler's call**, on two grounds: those numbers were measured in the dev
      browser pane rather than on the machine and display it has to feel good on, and the field
      belongs in the compositor the scene layer is heading toward rather than as a lone WebGPU
      canvas bolted to the backdrop slot. Remounting it is therefore the owner's decision, not a
      defect to be fixed.
      **What this line said next — "the code is intact and one line remounts it" — was false, and
      it was the most expensive kind of false, because it aimed the owner at a one-line change.**
      Nothing imports `field.tsx`, so nothing had ever executed `field-shader.ts`, and that module
      threw on import: `layout.$.uniforms` and `layout.$.masses` were aliased at module scope, where
      the proxy raises "Direct access to buffer values is possible only as part of a compute
      dispatch or draw call". `layout.bound` could be captured that way and `layout.$`, which
      replaced it in 0.12, cannot — so the port left behind two lines that no typecheck and no test
      could catch, and only running it would. The accessors are read inside each shader body now,
      which is where TypeGPU turns them into WGSL pointers (`let uniforms = (&uniforms_1);`).
      Witnessed by building the real pipeline in a real browser through the TypeGPU inspector:
      one render pipeline, one bind group layout, 7.7 kB of WGSL, zero compilation errors — against
      a hard throw on import beforehand. Remounting remains the owner's call. It is now a line that
      would work.

## Next

- [x] **Window chrome.** Outlines gone — the boxed controls, corner brackets, frame stroke, and
      the 3px accent bar were all already tokenised and simply never set. The active window is now
      said with material (a 9% accent wash over the raised surface, plus `--lift-3`) rather than
      with a rule, and controls arrive on approach via opacity so the header never reflows.
      The header now reads as part of the note rather than labelling it: the chrome title is hidden
      for the note kind, so the note's own first field is its name and the header is a slim bar
      carrying only controls. `window.title` follows the record underneath, for the far-zoom summary
      and the accessible name — which also fixed a defect where renaming a note left both showing
      whatever it was called at creation.
      The header is 32px, and the specular hairline is composed into `--icx-surface-shadow`. All four
      things this item asked for — floating surface, no outline, controls on approach, a header that
      belongs to the note — are done.
      **Not part of this item, but adjacent and unbuilt:** grain, and the window body still has no
      scroll affordance at small sizes.
- [x] **Notes that are notes.** Lexical behind a `{ value, onChange }` boundary — the engine is
      named in exactly one file — with a debounced, revision-guarded write per note. Landed early,
      out of sequence with `IMPLEMENTATION_PHASES.md`, which is recorded in the audit rather than
      hidden. Rich text, mentions, and code blocks are still ahead of it.
- [x] **Command palette** on `Mod+K`, composed from `getInfiniteCanvasContextualCommands`,
      `getInfiniteCanvasWindowPresence`, and `cmdk`. Nothing restated: the framework supplies the
      vocabulary and enablement, cmdk the filtering and roving focus, Base UI the modality. Reaches
      windows, canvases, projects, creation actions, and every enabled canvas command; unavailable
      ones appear greyed once you type. Filtering is substring rather than cmdk's default
      subsequence, which matched "undo" against "Nudge Left".
      **A row is now searchable by what it says.** Each row used to carry a hand-written bag of
      synonyms as its whole search value, and nothing bound that bag to the row's own title — so
      "Cut the selected connection" was searchable as `cut disconnect unlink connection edge`, and
      typing the label printed in front of you returned "Nothing matches that". `Row` derives the
      value from title, description, and synonyms now; a caller supplies only the synonyms, so it
      cannot forget the title because it never writes it. Witnessed rather than reasoned: with a
      connector selected, "cut the selected" finds the row it names.
      **"The palette cannot rename" was wrong, and it is now false twice over.** The reasoning was
      that rename needs an inline editor a list row cannot host. A _row_ cannot; a palette can, and
      cmdk documents it — the label page proved it first, and rename is the same shell with
      different words, so both are declared as data and one shell reads them. `Rename “<note>”…`
      appears for the active note's window, opens seeded with the current name because a rename is
      an edit of a name that already exists, and refuses an empty one in the row rather than letting
      the database refuse it after the palette has closed and said it worked. The rail keeps its
      double-click, which is the better gesture while browsing; this is the better one with your
      hands on `Mod+K`. Both write through `renameNote`, so there is still one authority for note
      writes.
      Building it exposed a defect in the palette that predated it: it kept its own copy of the
      project's notes, which is exactly what `project-notes` was created to abolish after the rail's
      copy went stale. Renaming from the palette left the rail showing the old name until something
      else re-listed — witnessed, then fixed by making the palette read the shared store like
      everyone else. Driven end to end: the note field, `window.title`, and the rail row now all
      read the new name together.
      **The empty state now leads with what you were just doing.** A `Recent` group of up to five
      notes sits above everything else, and only while the query is empty — once you type you know
      what you are after and the filter already ranks it, so recency would be arguing with you.
      Recents are _notes_, not commands, because a command already carries a hotkey and is found by
      typing its name, while the thing you genuinely reach for twice is a note. They are stored as
      ids and resolved against the live listing, so an archived note stops appearing rather than
      leaving a row that opens nothing, and they persist per device through Legend State's own
      `syncObservable` and `localStorage` plugin — which the audit's "Legend sync" exclusion does not
      cover, since that was about revision-ordered SurrealDB writes and this is five strings with no
      remote. A recent note is lifted out of `Windows` and `Notes` rather than repeated there, since
      cmdk identifies a row by its value and two rows sharing one are indistinguishable to selection.
      Driven: reaching "Untitled 2" writes `["content_item:…"]` to `localStorage`, the next open
      leads with `RECENT · Untitled 2 open`, `WINDOWS` no longer lists it, and a reload keeps it.
      **A defect I wrote and caught before committing:** the first version filtered recents out of
      their home groups unconditionally, which meant that once you typed — when `Recent` is hidden —
      those notes disappeared from search entirely. A note becoming unfindable _because_ you had
      just used it is the exact inverse of the feature. The lift-out is now conditional on browsing.
      **Identity and search are now separate, which fixes a bug that had been there all along.**
      Two notes can both be called "Untitled 3", and a row's cmdk value was its searchable text — so
      those two rows carried the same value, and cmdk decides what is selected by comparing
      `state.value` against each item's value. Both matched. Arrow keys could not separate them and
      running one was a coin toss. This predates the search-value work; the value before it was
      `window <title> <kind>`, equally identical.
      The fix is not a longer value. cmdk already draws this line: `CommandItem` takes `keywords`
      alongside `value`, and the filter is handed both — `filter(value, search, keywords)` — because
      one identifies a row and the other describes it. A row's value is now its record id and its
      words are `keywords`, so titles no longer have to be unique to be usable. Appending the id to
      the value would have "worked" and been wrong: ids read `content_item:…`, so typing "item"
      would have matched every note on the canvas.
      Driven: 29 rows, zero duplicate values, and the two "Untitled 3" rows now carry
      `content_item:4s9rw…` and `content_item:70ere…`. Search still narrows — "new can" leaves
      exactly `New canvas` — and "content_item" now matches **nothing**, which is the proof that the
      identity never reached the haystack.
      **"The palette cannot delete" was reasoning about a verb that does not exist.** This line said
      delete was the one thing a page could not host, because it needs a typed confirmation rather
      than a text field. There is no note delete in this app and there never was: a note carries
      `relates_to` edges, so deleting one would have to cascade them or leave the graph pointing at
      nothing, and the removal the schema settled on is archive. Archive destroys nothing — restore
      returns the note _and_ its edges — so there is nothing to weigh and nothing to confirm, and a
      plain row is the whole affordance. `Archive “<note>”` acts on the active note's window and
      closes that window as it goes, exactly as the rail does, because a note the library no longer
      offers but that is still open on the canvas is where "archived" stops meaning anything.
      Recents needed no cleanup, which is the earlier design paying for itself: they are ids
      resolved against a listing that excludes archived notes, so the row stops rendering by itself.
      Driven: the rail goes from `Library 5 … Untitled 5` to `Library 4` without it, and the window
      count drops from two to one in the same step.
      **Still open on the palette:** nothing named. Projects and canvases have their own destructive
      removals with typed confirmations, and those are genuinely not page-shaped — but no line here
      has ever asked the palette to host them.
- [~] **The library rail** — content, search, saved views. This line said "currently an empty box
  making a promise", which overstated it: there is no box. `CanvasHud` renders the identity
  rail, the selection rail, the recovery notice and the launcher, and nothing else.
  **What it has to be worth:** the launcher already opens a closed note, so a rail that only
  lists notes is a worse palette that is always on screen. Its case is the three things a
  modal cannot do — browsing without knowing what you want, seeing relationships between
  notes rather than one at a time, and staying put while you work against it. The connector
  item below is blocked on exactly that: an edge whose notes are not both open is currently
  invisible, and no amount of palette fixes it.
  **The framework check ran first and found a gap** — recorded in `AFFORDANCE_AUDIT.md`. Every
  inset the framework takes is a single scalar applied to all four edges:
  `getViewportInsetWorldRect`, `fitCameraToWorldRect`, `getFitCamera`'s `paddingPx ?? 80`,
  `getInfiniteCanvasOffscreenIndicators`. A consumer with persistent chrome on one edge cannot
  say which region is occluded, so `view.fit`, `view.fitSelection`, `window.reveal` and
  placement would all centre content underneath the rail. **Per-edge viewport insets are the
  precondition**, and they are product-neutral — a sidebar, an inspector and a docked panel all
  want the same affordance. Building the rail first would ship a surface that fights every
  camera command, which is exactly the half-built failure this file warns about.
  The same check found a second thing worth naming: `getInfiniteCanvasMinimapLayout`,
  `getInfiniteCanvasOffscreenIndicators` and `getInfiniteCanvasWorldPath` are exported and
  consumed by nothing here. Not a framework gap — a coverage gap in the app meant to be the
  framework's showcase, and offscreen indicators answer the rail's own question: where is the
  note this one connects to, when it is not on screen.
  **Two of the three are now drawn.** Offscreen indicators landed first; the minimap landed
  second, in `hud/minimap.tsx` — see its own item below. `getInfiniteCanvasWorldPath` is the
  one still consumed by nothing, and it is deliberate: it is built for tours, which this file
  keeps under "Later".
  **Landed:** the framework affordance, and a first rail against it. Every note in the project,
  searchable, with a presence dot for the ones already on the canvas and a connection count that
  expands in place — reaching a connected note costs one click whether or not it has a window,
  which is the thing the palette cannot do. Clicking a row is `window.reveal` when the note is
  open and `openNoteWindow` when it is not; neither is re-derived here.
  The HUD is inset by the same number the camera is, so the identity rail stops sitting under
  the panel and the selection rail re-centres on what is visible. Verified in the browser:
  revealing a note centres it at x≈490 in a visible region whose centre is 486, where the
  element's centre is 400. The connection path is witnessed too, end to end rather than
  inferred: authoring `relates_to` from the palette draws the connector on the canvas, both rows
  grow a count, the count expands in place with the neighbour indented under it, and the nested
  row reaches the note it names.
  **The rail no longer claims a project is empty before it has looked.** `notes$` started as `[]`,
  so "nobody has asked yet" and "the answer was nothing" were one value, and a fresh load greeted
  three notes with "No notes yet." for as long as the first query took — which reads as data loss,
  not as loading. It is `null` until answered now, and the count and the message both stay blank
  until there is something to say. The same conflation mislabelled a list: switching to Archive left
  the notes under the heading "Archived" until the second query landed. Witnessed by recording the
  rail's own DOM across both toggles: the settled list is preceded by a state carrying the new
  heading with no count, no message, and no rows.
  **Still open:** there is no saved-views concept yet, and connections cannot be cut from here.
  **Rename and create landed.** Double-click a row and it becomes an input — Enter commits, Escape
  abandons, blur commits, because clicking away from a field you have typed into and losing it is
  what nobody expects. This is the rail's own justification made concrete: this file already
  recorded that the palette cannot rename because a _palette_ row cannot host an inline editor, and
  a rail row can, being persistent rather than modal. The write goes through `note-store` rather
  than straight to the database, so the revision guard still has one authority — the rail holds
  full records from `listNotes` and could have saved directly, which would race a note that is also
  open and being typed into. `setWindowTitle` keeps the window's own title following the record.
  `+` in the header creates where you are already looking and the list updates in place.
  **Removal landed as archive, not delete.** Reading the schema settled which one exists:
  `fn::list_notes` has filtered `archived_at = NONE` since it was written, and canvases and
  projects already ship archive/restore pairs. A note carries `relates_to` edges, so a delete would
  have to cascade them or leave the graph pointing at nothing; archiving leaves both intact, so
  restore puts back everything that was there — which a cascade could never promise. No typed
  confirmation, because nothing is destroyed. The note's window closes as it is archived: a note the
  library no longer offers but that is still open on the canvas is the state where "archived" stops
  meaning anything. Designing it exposed a defect already present — connection counts were taken
  over every edge, so an archived neighbour showed a count with no row that expanding could
  produce. Counts now cover only neighbours the current list can show.
- [~] **Connectors.** `relates_to` is written for the first time, and edges render between the
  windows showing their notes — framework geometry throughout, drawn in the new
  `renderUnderlay` band so a connector passes beneath the note rather than across it.
  **Drag-to-connect landed.** Hovering a note reveals a handle on its edge; dragging from it draws
  a preview that is dashed while the far end is only a pointer and solid once it is over a note it
  can join, and releasing writes the edge. Self-connection and duplicates are refused, and the
  preview says so before you let go rather than after. Two framework findings came out of it. The
  first is that no geometry was missing: `getInfiniteCanvasRectConnectorPath` takes two rects and a
  drag has one rect and a pointer, but a zero-extent rect **is** that pointer to this geometry
  exactly — so the preview routes through the same function, with the same elbow, as the edge it
  becomes, which is why it predicts the result instead of approximating it. The second was a real
  gap, now closed: `resolveInfiniteCanvasChromeMetrics` was the only unexported policy resolver,
  while `resolveInfiniteCanvasSpatialTarget` demands complete chrome metrics and the viewport takes
  a partial override — so an app with shortened headers could not hit-test against the chrome it
  was drawing.
  **The gesture was hand-rolled here first, and that was wrong.** It shipped a handle that vanished
  when you reached for it — it sat outside the window while visibility asked "is the pointer over
  the window" — and the only reason verification passed is that it dispatched `pointerdown` straight
  at the element, the one path a real pointer never takes. It has moved to the framework as
  `window-connection`, which is where it belonged: nothing about handle placement, reveal, or
  hit-tolerance is a Polkadot idea. `getInfiniteCanvasConnectionAffordanceWindowId` holds a window's
  affordance across the whole reach and refuses to let a neighbour steal it mid-reach, and the test
  that proves it walks a pointer there one step at a time rather than teleporting.
  **Selecting and cutting landed.** Registering an edge resolver makes a connector a framework
  selection target, so clicking one goes through the same machinery that selects a window, modifiers
  included; the palette cuts what is selected. Connector geometry is derived once for both the layer
  that draws it and the resolver that hit-tests it, so they cannot disagree about where an edge is.
  **Backspace cuts it now**, and finding the gap that made that possible is the more useful half.
  `hotkeyBindings` was the documented way to claim an unclaimed chord — the arrange and dock verbs
  ship with none and say to use it — but it is a _default parameter_, so a consumer taking that
  advice traded the entire canvas keymap for the one chord it wanted, silently. And a binding
  carries an `InfiniteCanvasCommand`, so it could only ever re-chord a verb the canvas already had:
  a connector could be selected by the framework and then acted on by nothing. `hotkeyActions`
  closes both — consumer verbs registered _alongside_ the default keymap, with the command surface,
  the exclusion list and the swallow rule staying the framework's. That last part is the whole
  reason it is not a `window` listener: Backspace inside a note body still deletes a character.
  Witnessed rather than reasoned — the edge is gone after a reload, Backspace on empty canvas does
  nothing, "abcd" in a note body backspaces to "abc", and `Shift+1` still fits all afterwards.
  **Typed kinds landed, and the kind is the label.** `relates_to` has carried `kind` and `label`
  since the first migration and every writer passed the literal `"relates"`, so the column existed
  and said nothing. Five verbs now — `relates`, `supports`, `contradicts`, `refines`, `follows` —
  written by `fn::set_relation_kind` and chosen from a palette row each, which is what a palette row
  is _for_: a fixed vocabulary needs no inline editor, unlike the rename that had to go to the rail.
  The kind the edge already carries is left out of the list, because offering "say this supports" on
  an edge that already supports is a row that does nothing. The stored kind and the drawn word are
  one string, so they cannot drift apart; `relates` draws nothing, since an unlabelled line already
  says "these belong together" and printing the word would label every edge with what the line says.
  The anchor is the framework's — `getInfiniteCanvasWorldPathPointAtProgress(path, 0.5)` over
  `getInfiniteCanvasWorldPath(points)` — so it walks half the _routed_ length rather than averaging
  the endpoints, which for an orthogonal elbow lands in open space beside the line.
  **What a label does when it cannot be read:** it scales with the camera, because it belongs to the
  edge and one held at a fixed size would detach from the line and compete with the HUD. Below 8px
  it is dropped rather than shrunk — sub-8px text carries nothing, and the line still says the notes
  are joined. A _selected_ edge draws its label at any zoom, because there is exactly one of it and
  you asked for it. Driven, not reasoned: at 39% deselected the DOM holds no label; at 39% selected
  it is there at the 8px floor; at 100% it is there at 11px.
  **Free-text labels landed too, and the reasoning that deferred them was wrong.** The claim here
  was that a palette row cannot host a text field. A palette _row_ cannot — but a palette can, and
  cmdk documents exactly this as a "page": the same input is told to mean something else and the
  list becomes the one row that commits it. No new dialog, no new component, and nothing in `ui`
  changed. The one thing the page needs is that the typed text stops being a query — a sentence is
  not a search, and left filtering it would eliminate its own row — so `filter` is mode-aware, which
  is why the mode lives in `CommandPalette` beside it rather than in the content.
  A label wins over the kind, because someone who typed a sentence was being more specific than five
  verbs allow; the kind stays underneath as the queryable category. Empty clears rather than storing
  `""`, and the row says so in the state where it applies — "Clear the label, leaving _supports_" —
  so clearing is visibly the same act as writing, not a destructive verb hidden elsewhere. Offered
  only for a single selected edge: one sentence written onto four connections is true of none.
  Driven: select the edge, `Label this connection…`, type "blocks the review", Enter — the row
  previews the exact text rather than being filtered away, and the connector then reads "blocks the
  review" at 11px in place of "supports".
  **An edge with one end closed is no longer invisible.** A connector was drawn only when _both_
  ends had a rect, so closing one note silently removed the line — the note kept its connections and
  the canvas stopped mentioning them, which on screen is indistinguishable from having none. Each
  window whose note has neighbours the canvas is not showing now grows a short dashed stub off its
  right edge carrying the count. Dashed because the drag preview already established that vocabulary
  for an end that is not a window, and quiet at 25% opacity because it reports an absence and a
  canvas that shouts about what is missing is worse than one that stays silent. Routed by
  `getInfiniteCanvasConnectionPreviewPath`, the same function the drag preview uses, since the far
  end is a bare point in both cases and inventing a rect would be inventing a position for a note
  that has none. Deliberately not clickable: the rail already opens a connected note in one click,
  and a second hit-testing path competing with the framework's is what `connector-layer` was written
  to avoid. Driven: closing "Untitled 2" drops the connector to zero and raises one stub, which at
  zoom 0.50 draws with no count (5.5px is below the legibility floor) and at zoom 1.0 reads "1" at
  11px.
  **Unwitnessed, and worth naming so nothing here is read as proof it is not:** the connector
  available to drive has a symmetric route, so its routed midpoint and the average of its endpoints
  are the same point. That case cannot tell the two apart. The label anchor uses the framework's
  path, which is the one that holds when a route is asymmetric — but an asymmetric route was never
  observed, so that is reasoning rather than evidence.
  **Still open:** a stub says how many connections are hidden and not which, and the count is per
  window rather than per neighbour, so two windows on the same note each repeat it.
  **Also still open, found by driving the whole flow rather than one feature:** a connector between
  two windows that nearly touch is almost entirely behind them. Windows resolve before edges, which
  is right — clicking a note should select the note — but the consequence is that the only part of
  such an edge you can aim at is the few pixels crossing the gap. At one arrangement the longest
  exposed segment measured 30px, and clicking its midpoint selected nothing because that midpoint
  was still inside a window. Nothing is wrong with the hit radius or the stacking; the geometry
  simply leaves nothing to hit. Two notes side by side are also the two most likely to be
  connected, so this is not an edge case. A connector may need a grab area that survives occlusion —
  the label already sits at the routed midpoint and is a candidate — but that is a design question
  and no design has been chosen.
- [~] **Workspaces** as the organizing spine. The framework's workspace model was reachable only by
  a consumer reaching past the command layer: `cycle` walks desktops that exist and does nothing
  when there are none, so nothing could make the first one, name which one to enter, or take one
  away. `workspace.create`, `workspace.enter`, and `workspace.close` close that. Creating also
  enters, and closing keeps the windows — a membership filter that deleted what it filtered would
  make "which set is this in" a destructive question.
  The identity rail names the desktop you are on and counts what is on it, because entering an
  empty one shows an empty canvas and that is indistinguishable from losing your work.
  Filing works from the launcher — `Send “<window>” to <desktop>` — and reaching a window on
  another desktop is `window.reveal`, which found the second gap: navigation filtered on
  `minimized` alone, so going to a hidden window panned the camera to a rect nothing renders and
  the window read as lost rather than elsewhere.
  **The desktop is a switcher now, like the two beside it.** "Cannot be renamed or reordered"
  described this app, not the framework: `setWorkspaceTitle` and `reorderWorkspace` shipped with the
  workspace model and nothing here had ever called either. `command-coverage.test.ts` even says why
  neither is a command — a title and a destination index are things only the user has. So the
  missing piece was a surface, and the rail already had the right shape twice over: project ▸
  canvas ▸ desktop, each a name that _is_ its control. `DesktopSwitcher` replaces the old pill and
  follows `CanvasSwitcher` exactly — a radio group over the set, an inline rename that replaces the
  trigger, and no dialog to change one word.
  The pill it replaces returned `null` whenever no desktop was active, which is where you spend most
  of your time and the one place "what else is there" gets asked, so the app hid the answer exactly
  when it mattered. "All windows" is a row in the list now rather than the entire click target.
  Reorder is Move up / Move down rather than a drag, and that is a decision: `motion`'s `Reorder` is
  here and is what a sortable list should use, but it owns the pointer for a whole row and so does a
  Base UI menu item, and a list three long is faster by button and reachable by keyboard.
  **Witnessed:** absent with no desktops; appearing on creation with the accent wash and the
  membership filter emptying the canvas; the menu listing All windows, the desktop with its window
  count and its check, with Move up and Move down confirmed `data-disabled` at a single desktop;
  rename changing the trigger and the row together and surviving a reload.
  **Not witnessed, and the reason is the harness rather than the code:** select-on-open for the
  rename field, reorder actually moving one, the "All windows" round trip, and Close this desktop.
  `computer{action:"screenshot"}` dismisses a Base UI menu, and a coordinate click requires a
  screenshot in the same batch — so screenshot-then-click-a-menu-item cancels itself. The rename
  field's `select()` sits in the same effect whose hotkey registration was witnessed committing on
  Enter, so it runs; that it _selects_ is inference, not observation.
  **Both of the remaining two closed, in the switcher.** "Not on this desktop" lists every window
  the filter is hiding with the desktop it is on — or "no desktop", which is not an edge case but
  every window on the canvas the moment the first desktop is made. Clicking one is `window.reveal`.
  And "Bring N windows here" files a whole selection at once, so "put these three on a new desktop"
  is select, enter, click rather than three round trips through a modal.
  That last one is N dispatches, which is N undo entries for one gesture. Deliberate: batching
  membership edits in the product would restate the framework's rule about what a single edit is,
  and `workspace.moveWindow` taking a set is the framework's call to make. **Named as an ask, not
  built.**
  **Not witnessed:** either menu section. This harness cannot reliably re-open a Base UI menu —
  `computer{action:"screenshot"}` dismisses it, a coordinate click needs a screenshot cached in the
  same batch, and a `ref` click does not open it at all. The last is not specific to this component:
  a ref click on the canvas switcher does not open its menu either, so it is the click path rather
  than the trigger. Both sections were typechecked and read, not driven.
  **Still open, and found while looking at this:** the offscreen indicator ring points at windows
  that are not on the active desktop. `getInfiniteCanvasOffscreenIndicators` filters on `minimized`
  alone and never consults workspace membership, so entering a desktop fills the ring with arrows
  aimed at windows the canvas is not drawing — the accessibility tree on an empty desktop carries a
  "Go to Untitled 3" chip for a note filtered off it. This is the same correction `window.reveal`
  already received and `offscreen.ts` never got, it is framework-owned, and the audit records why
  the product cannot fix it without either a lying `targetCount` or restating the membership rule.
- [x] **Grain and vignette.** Both are passes inside the field rather than an overlay on top of it,
      because material noise belongs to the surface: a two-scale grain plus a radial falloff, each
      on its own `intensity` knob. The windows themselves still have no grain.

## The living field — built, in `canvas/field.tsx`

An earlier attempt shipped a flat dot lattice with a radial brightness falloff and called it the
signature. It was deleted. What replaced it is a **gravity field**: a window is a mass resting on
the surface and the lattice falls into it, draping the way a rubber sheet does around a weight.

That is deliberately not what the reference does. `GRID_MOTION_STUDY.md` describes windows pushing
the lattice _aside_ — which reads as a box shoving wallpaper rather than as something with weight —
so the sign is flipped and the linear ramp is replaced by a softened inverse square, `mass /
(1 + (distance / reach)^2)`, giving a real well with a long tail. Mass grows with the window's
footprint, so a wide window bends more of the canvas than a note.

**Two things this section previously got wrong, both worth keeping visible:**

- It said lattice points are simulated. They are not, and never were in the recovered
  implementation. The field is a formula evaluated per pixel in _warped_ space — each pixel
  displaces its own sample position by the pull of the nearby rects and then measures its distance
  to a lattice line. The study says as much: the original canvas version moved persistent particles,
  and the working implementation replaced it with a shader.
- The momentum is in the **rects**. Gain `0.08`, damping `0.75`, influence easing `0.15` — those
  constants smooth the rect targets on the CPU before they reach the shader, which is why a window
  that stops moving leaves the field still settling behind it.

What is carried over from the study unchanged: the 40px lattice with traces on the half-step, and
a pointer highlight that eases between **lattice intersections** rather than following the cursor —
composed of thin centre lines, faint half-step traces, a lifted intersection dot, and a soft radial
spotlight, each drawn separately. The recovered shader had drifted off that anchor and snapped per
pixel from the pointer instead; the anchor is restored here because the study names it as the
reason the highlight feels deliberate.

**WebGPU through TypeGPU**, not the raw WebGL2 this line claimed until now — the port landed in
`a20bb77` and the shader has been TypeScript in `field-shader.ts` ever since, validated against a
real device through the inspector. Still a fullscreen triangle and one program, which need no scene
graph. All tuning is one `FieldConfig`: the reference's five near-duplicate hover radii and three
influence radii were each fixed ratios of a single real number, so one knob moves each family
together.

**Still open:** the lattice ignores zoom entirely — spacing is screen-space and only the phase
follows the camera, so zooming out does not make the ground finer and the field has no sense of
scale. A window being dragged should also pull harder than one at rest, and the rect velocities
needed for that are already computed and unused.

- A grain pass over the whole field: `fract(sin(dot(st, vec2(12.9898, 78.233))) * 43758.5453123)`.

`renderBackdrop` exists in the framework and is the correct seam for it. That part was right and
stays. What is missing is the field itself, and it is hours of careful work, not a pass.

- [x] **Offscreen indicators.** `getInfiniteCanvasOffscreenIndicators` had been exported and drawn
      by nobody — its own docstring said so. Polkadot draws it now: up to five chips on the ring the
      framework projects, each pointing at something that has fallen off the viewport, clicking one
      centres it. Every number is the framework's — bearing, distance ordering, the ring that
      respects viewport insets — and the product owns only what an arrow looks like, how many are
      worth showing, and what a click does.
      Verified by driving it: pan both notes off-screen and two chips appear at −136° and −146°,
      both pointing up-and-left where the notes went; clicking one centres it in the visible region.
      **Found while consuming it, then fixed generically:** two separate windows at the same
      bearing stacked on nearly the same pixel. Groups were already folded for that reason and
      distinct windows were not, so the framework folds by _where a target lands_ now rather than
      by what it is — `mergeWithinPx`, in pixels because the ring is a rectangle and the same
      angular gap is tens of pixels on an edge and almost nothing at a corner. The nearer target
      survives and carries a `targetCount`, which the chip shows as a badge: one arrow over a
      cluster of five should say five, or you do not go looking.
      Folding is proven by unit test, mutation-checked, and now witnessed: panned far enough that
      the two bearings converge, the pair becomes one chip carrying a `2` and reading "Go to
      Welcome, and 1 more this way".
      **And witnessing it found the next thing.** The folded chip landed behind the "New note"
      button, because this app declared only its `left` inset. The library rail is the obvious
      chrome; the identity rail along the top and the zoom and selection rails along the bottom are
      chrome too, and until they were named the camera centred content underneath them and the
      indicator ring projected onto an edge with a pill rail sitting on it. Declaring one edge and
      forgetting the others is the same bug as declaring none, only quieter — and it was mine, from
      building the affordance and then using a quarter of it.
      **Still open:** the chips are peripheral by design and deliberately quiet, tuned by one look
      rather than by watching anyone use them.

- [x] **The map.** `getInfiniteCanvasMinimapLayout` and `getInfiniteCanvasMinimapWorldPoint` had
      been exported and drawn by nobody since 2026-07-08, and `docs/API.md` still carried the whole
      module as _unobserved_ on that ground. Drawn now, in `hud/minimap.tsx`. It answers the one
      question neither the rail nor the offscreen chips do — not "what exists" and not "which way
      is that one", but what shape the canvas is, which is what you want while moving rather than
      after arriving.
      Nothing here projects anything. Two of the framework's own decisions are the ones a
      hand-rolled map gets wrong, and both were visible while driving it: the camera's visible rect
      is unioned into the bounds, so panning into empty space shrinks the content into a corner
      rather than pushing the indicator out of the box — the exact moment you looked at it — and
      the scale is uniform, because a map that lies about aspect ratio is worse than no map.
      **Placement is the decision that cost something, and it is declared rather than taken
      quietly.** Bottom-right above the framework's navigation rail, with the app's bottom inset
      growing while it is open, the same shape the library rail uses. Understating that would drop
      a note under the map on every fit and reveal. It closes, and closing returns the band.
      The right edge is left alone on purpose: a right inset would cost a strip down the whole
      viewport for a corner-sized surface, which is per-edge scalars failing to describe a corner.
      Witnessed: content sitting low-left of an offset viewport frame after a pan, clicking it
      centring the camera there, and a drag scrubbing the camera continuously in the drag's
      direction.
      **Still open:** closing and reopening was not witnessed — the app remounted under another
      session's HMR reload mid-click. And `docs/API.md` should move `minimap` off _unobserved_ by
      its own stated rule, which is the framework's edit to make, not this app's.

## Later, deliberately

- **Tours** — `getInfiniteCanvasWorldPath` and `…PointAtProgress` are built for guided paths
  through a canvas. Nothing consumes them yet.
- **The 3D layer.** Window proxies and frustum culling exist behind `/scene`. Far-zoom overview
  is the honest use, not decoration.
- **Sync.** Local-first is the whole product until it is not. SurrealDB is the choice when it
  becomes a real need.

## Framework gaps Polkadot has found

Kept here because the list _is_ the incubator's output.

| Gap                                                                                                      | Generic affordance                                                        | State  |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------ |
| Backdrop was hardcoded                                                                                   | `renderBackdrop`, mirroring `renderOverlay`                               | landed |
| No way to observe "the durable document changed"                                                         | `InfiniteCanvasHandle.subscribeDocument`                                  | landed |
| Hydration adopted a fallback's unusable viewport                                                         | `desktop.hydrate` keeps a usable viewport over the payload's              | landed |
| `chrome` demanded all five metrics, and the defaults are not exported                                    | `InfiniteCanvasChromeMetricsInput`, mirroring `zoomPolicy`                | landed |
| No DOM layer between the backdrop and the windows: connectors meant losing the grid or taking on `three` | `renderUnderlay`, the counterpart to `renderBackdrop` and `renderOverlay` | landed |
| Workspaces could be walked but never entered: no command made one, named which to go to, or closed one   | `workspace.create`, `workspace.enter`, `workspace.close`                  | landed |
| Navigation was not desktop-aware: going to a window another desktop hid panned the camera to nothing     | `window.reveal` — go where the window is, restore it, focus it            | landed |

**On the second row**, because it is the clearest thing the incubator has produced so far. Any
consumer persisting a canvas needs to know when the stored shape changed. The obvious way to ask —
`subscribe((state) => state, …)` — can never fire, because the store commits per field and never
replaces the root and Legend State is explicitly not immutable, so the root read is the same
object forever. The documented alternative, selecting a fresh object, fires forever instead. Both
fail silently and in opposite directions: one store saves nothing, the other saves constantly.
Polkadot shipped the first for weeks without noticing.

The fix is not a Polkadot persistence helper. It is that the framework should be able to say
"the thing you would store has changed", which it now does — scoped to exactly the fields
`serializeInfiniteCanvasState` writes, with the field list made exhaustive at compile time so an
observer cannot drift from what persistence stores.
