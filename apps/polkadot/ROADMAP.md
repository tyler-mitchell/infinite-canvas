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
      **The second way this loop stopped saving was worse than the first, because it looked
      handled.** A revision conflict — the document on disk moved past the revision this tab holds,
      which is what two tabs on one canvas produce — was reported as an ordinary `error`. But the
      held revision only advances on a _successful_ write, so after a conflict it is permanently
      stale and every later save carries the same doomed number. The write loop went on refusing
      every write for the rest of the session behind a small red pill reading "Canvas
      canvas_document:main changed after revision 396", which names a record and a number and tells
      a person nothing about whether their work is at risk. Driven before it was fixed: two document
      edits after a conflict, and the status never left `error` on that same revision. Everything
      done from that moment was lost on reload.
      **A conflict is now its own status, and the loop stops rather than churning.** Stopping is the
      point — the queue was doing steady work that could only fail. The pill says "Changes are not
      being saved", which is the sentence that is actually true, and a notice offers the two honest
      answers. There is no third: the layout is one blob, so there is nothing to merge and somebody's
      arrangement wins. **"Keep mine" forks this tab's arrangement into a new canvas**, which is the
      only option that destroys nothing — the other writer's canvas is untouched. Reloading is the
      other answer and it is destructive, so it says so.
      Witnessed through the real path rather than a simulated one: two tabs on one canvas, an edit in
      each, the conflict raised in the stale tab. The snapshot handed to the fork was
      `["Images·", "Untitled 10"]` — including the edit that could not be saved — and the new canvas
      came up at its own id holding both. Conflicts are detected by error `name` rather than
      `instanceof`, because importing the error's class into the write loop would drag the
      eleven-megabyte WebAssembly engine onto that path.
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
      **The edge of the text is said with light now.** Scrolling itself already worked — the
      framework's body declares `overflowY: auto`, this kind asks for `native-scroll`, and the note
      grows past the frame — but nothing announced it: a note taller than its window simply began or
      ended mid-sentence, and macOS overlay scrollbars show nothing at rest, so the only cue arrived
      after you had already guessed. A gradient into the body's own colour now sits at whichever
      edge has text beyond it, `sticky` so it holds against the frame while the content moves, with
      a negative margin so it costs the layout nothing. Measured on scroll _and_ on either box
      resizing, because typing grows the content without scrolling it and dragging the frame's
      corner changes neither — both cross the threshold a scroll listener alone never sees.
      Driven: at the top the lower fade alone is lit, midway both are, at the bottom only the upper.
      **Two things went wrong on the way, and both are worth keeping.** The state was first held as
      one `{ above, below }` observable, and the fades never moved — Legend State commits per field
      and does not replace the root, so a component reading the root of an object observable can be
      subscribed to something that never changes. That is the same trap that left this app's
      autosave subscribed to a constant for weeks, recorded at the top of this file. Two primitives
      have no root to go stale. And the visibility was first a `data-visible` attribute with a
      `data-[visible=true]:opacity-100` variant; the element matched its own selector and stayed at
      `opacity: 0`, because that utility was never generated. Opacity is a computed number, so it is
      passed as one.
      **Unverified, precisely:** the fade updates were driven by setting `scrollTop` and dispatching
      the `scroll` event, because this environment fires no scroll event for a programmatic set and
      real wheel input hangs the browser pane. What that proves is the listener and the measurement;
      what it assumes is that Chrome fires `scroll` on real user scrolling, which is the platform's
      guarantee rather than this code's.
      **Grain landed, and it needed no framework change.** The window surface was a flat fill; it is
      a material now. `theme.css` already consumes `--icx-body-background`, `--icx-header-idle` and
      `--icx-header-active` through the `background` _shorthand_, which takes an image layer over a
      colour — so a noise layer composes into tokens this app already owns, and nothing about the
      framework had to move. `background-color` could not have carried it, which is the whole reason
      the composition belongs in `styles.css` rather than in a slot.
      All three tokens carry it, so the window is one material rather than a grainy body under a
      flat bar. The tiles do not align across those three elements and do not need to — noise has no
      pattern to misalign, which is the property that makes this usable at all.
      It scales with the camera. That is a decision, not an oversight: material grain belongs to the
      surface, so magnifying the surface should magnify it, the way paper looks coarser under a
      loupe. Screen-constant grain would need the zoom as a CSS variable inside the window
      transform, which is a framework question nobody has had to ask yet.
      **The strength is measured rather than chosen**, and the first number was wrong.
      `feTurbulence` writes noise into the _alpha_ channel as well as the colour ones, so the rect's
      opacity multiplies against an alpha that already averages about half: at `0.035` the decoded
      tile came back with a mean alpha of 4.5/255 — 1.75% effective, past subtle and into absent.
      At `0.07` it measures 8.93/255, exactly the 3.5% intended. Verified by decoding the tile the
      surface actually resolved and reading its pixels, because a malformed data URI still reports a
      `url(…)` in `backgroundImage` while painting nothing at all.
      **Unverified:** how it looks. 3.5% noise does not survive a downscaled screenshot, so this is
      confirmed present and correctly weighted, not confirmed _good_ — that judgement needs a real
      display.
      **A latent trap door in the far-zoom lane, closed — and the bug I first reported was not
      real.** `getInfiniteCanvasWindowDetailLevel` measures a window's _smaller_ on-screen axis and
      restores a summarised window only when that axis is **strictly greater** than `fullAbovePx`,
      default 160. `NOTE_MINIMUM_SIZE` was `{ height: 160, width: 240 }` — exactly the boundary,
      where `160 > 160` is false. A window created at that floor would demote on zooming out and
      never come back at 100%, which is the trap door `detail-level.ts` describes in its own comment
      and changed its defaults to escape. Proven by executing the framework's pure function: at
      `240×160` a window goes full → summary at 0.4 zoom and is still summary back at 1.0, while
      `240×200` returns to full. The floor is 200 now, clearing the threshold by 40px — the width of
      the hysteresis band, so the margin is the framework's own unit rather than a guess.
      **What this does not fix, because it was never broken:** notes on the running canvas are
      360×240, since `NOTE_MINIMUM_SIZE` is a floor and placement returns something larger. Their
      extent is 240, well clear, and driving the real app confirms it — body → summary at 0.3 zoom
      and back to body at 1.0. This entry first claimed the app had the stuck-summary defect; that
      was a measurement error, reading a 360×240 window at an unsettled ~0.667 zoom as a 240×160
      window at 1.0. The floor only bites where placement actually falls back to it, which is a
      small viewport. Closing it is cheap insurance, not a repair.
      **The far-zoom summary can be read now, which is the only thing it was for.** It rendered
      `text-[12px]` in _world_ units, so it shrank with the window and came out at 3–6 screen pixels
      exactly where the lane had engaged — the lane exists because the body is unreadable, and the
      summary was unreadable too. Its own docstring is explicit that a window must then say
      something _different_ rather than the same thing smaller; a title that scales is the same
      thing smaller.
      The size is held in **screen** pixels now — `11 / zoom` in world units — so the words stay the
      size words have to be and the window decides how many survive. That is what "fewer words
      rather than larger ones" actually means in practice: nothing is re-worded, the container
      simply runs out of room and `truncate` says so. No glyph and no connection count were added,
      because connectors are already drawn at that zoom and a count on the card would restate what
      the canvas is showing.
      Zoom is read with `useInfiniteCanvasSelector` inside the summary rather than passed down,
      which is what the framework asks for — invalidation stays scoped to the one thing that reads
      it, and a pan recomputes the same number and re-renders nothing.
      Driven across the band: at 1.4 and 0.7 the body renders; at 0.42 the lane flips and the title
      is 26.2 world px — 11 on screen; at 0.21 it is 52.4 world px — still 11 on screen, in a window
      that is 76×50. Under the old rule those last two were 5.0px and 2.5px. "Untitled 3" is plainly
      legible in a thumbnail at 21% zoom.
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
- [x] **The library rail** — content, search, saved views. This line said "currently an empty box
      making a promise", which overstated it: there is no box. `CanvasHud` renders the identity
      rail, the selection rail, the recovery notice and the launcher, and nothing else.
      **Ticked with one correction to its own title: saved views did not land _in_ this rail**, and
      the reasoning is in the saved-views entry below. This rail browses content — presence dots,
      connection counts, archive — and a framing is navigation, so a third mode here would have put
      two unrelated domains in one 599-line component. They sit fourth in the identity rail instead,
      beside the project, canvas and desktop switchers, which is where the other "named thing you pick
      from" controls already live. The capability the title asked for exists; the address changed.
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
      **Cutting an edge from here landed**, and this line said it had not for longer than it was true.
      Each expanded neighbour row carries an unlink action, which matters because of what the connector
      work measured: two windows that nearly touch hide almost all of the line between them — windows
      resolve before edges, correctly — so the aimable part can be a few pixels, and at one measured
      arrangement it was 30px with its midpoint inside a window. The rail knows every edge without
      needing either end on screen, so acting on one here does not depend on where the notes sit.
      **Still open: there is no saved-views concept yet — and the framework check settled what one is
      before any of it gets built.** The first honest reading is that a saved view already exists and
      is called a workspace: `workspace.ts` opens by defining one as "a named set of windows, with the
      camera and selection you left it at", it is persisted at version 3, and `DesktopSwitcher` already
      surfaces it. Building a second named-camera model beside that would be two models over one
      concept.
      **It is not the same thing, and the framework says so in the same paragraph.** A workspace's
      camera is "a snapshot taken on the way out … stale by design — writing through on every pan
      would make each frame a workspace mutation, and workspace mutations are undo checkpoints." That
      is _resume where I left off_. A saved view is the opposite intent: a framing you return to
      precisely because it does **not** move while you work. Implementing views as workspaces gives one
      of two defects and there is no third option — either the camera writes through, and every pan
      becomes an undo entry, or it does not, and the bookmark silently drifts away from the thing it
      was pointing at.
      **So the split is: the framework owns _going_ there, the app owns _naming_ it.**
      `navigateToRect` and `getFitCamera` already take a world rect and are exported, so nothing is
      missing on the camera side and this asks the framework for nothing. A named rect is project data
      — it belongs in the database beside notes, with a title someone typed, the way every other named
      thing here does. That also passes the rule at the top of this file: "a list of bookmarks" is not
      a canvas affordance, and a `savedViews` prop would be the same feature and the wrong one.
      **What must not be built:** saved views as a second workspace, or a view that stores a camera
      (a centre and a zoom) rather than a world rect. A stored zoom is wrong on a different display or
      a resized pane; a rect re-fits to whatever window it is asked into, which is why every framework
      entry point on this path takes one.
      **The database spine landed and is driven, and no surface has been built on it yet** — said
      plainly because a half-built surface is the failure this file opens by warning about, and the
      honest state is that this is a spine and not a feature. `saved_view` is a `SCHEMAFULL` table
      keyed to a `canvas_document`, with `list` / `create` / `rename` / `reframe` / `delete` in
      `functions/006_views.surql`, an ArkType boundary in `database.client`, and a `savedViews` group
      on the lazy `operations` module. `reframe` is the verb no other table here has, and the one that
      makes a bookmark honest: a framing goes stale as soon as what it points at moves, and without it
      the only repair is delete-and-recreate, which loses the name that was the point.
      **Driven against the running database rather than typechecked**, through `window.__surreal.query`:
      an empty canvas lists `[]`; two views created out of alphabetical order come back in title order,
      so the ordering is observed rather than assumed; `reframe` replaces the rect and leaves the title,
      `rename` the reverse; `delete` drops the row. Both schema assertions were made to fire — a
      zero-width rect and an all-whitespace title were each refused with the assertion's own message —
      which is the part the SurQL test file cannot reach, since a thrown assertion aborts the script.
      The rows were removed afterwards; the table is empty.
      **What is left is the surface**, and it is the whole of the remaining design: where a view is
      saved from, how it is named, and where the list lives.
      **The framework check for that half ran too, and it also asks for nothing.** Going back is
      `navigateToRect` — the same call this session used to bring four windows into view after the
      camera had drifted off them. Capturing the current framing composes two exports that already
      exist: `getInfiniteCanvasContentViewport(viewport, insets)` gives the screen region the app's own
      chrome leaves, which is the right region rather than the whole viewport — a view saved while the
      rail is open must frame what you can actually see, not what is behind the panel — and the camera
      converts it. `getVisibleWorldRect` is the padded whole-viewport answer and is the wrong one here
      for that reason.
      **Placement was decided against both of the obvious candidates.** The rail is what this item's
      title assumed, and it is where a list you rename and prune belongs — a palette row cannot host an
      inline editor, which is the argument that put note renaming there. Against it, and decisive: the
      rail browses _content_ (presence dots, connection counts, archive) and a framing is navigation, so
      a third mode would put two unrelated domains in one 599-line component. The palette was the other
      candidate and is where you go already knowing the name, which is the opposite of a list you want
      visible.
      **So it sits fourth in the identity rail, after project ▸ canvas ▸ desktop.** That chain is
      already three switchers whose name _is_ the control, and this asks the same shape of question —
      which of these named things do I want. `SavedViewMenu` follows `DesktopSwitcher` part for part:
      the same trigger, the same rename-in-place input, the same Enter/Escape through the hotkey
      manager scoped to the field.
      **It is not a switcher, and that is why there is no radio group.** Entering a desktop is a mode
      you stay in, so that control marks which one you are on. Going to a view is a jump — the moment
      the camera arrives you are free to pan away, and nothing is "on" afterwards. Marking one current
      would be a claim that goes stale on the next scroll.
      **Removal shipped with it**, because a view list that only grows is the same defect this file
      refuses for mentions. It is a mode rather than a control on each row: a trailing button inside a
      menu item is the obvious shape and the wrong one, since the item owns the click and the button
      either never fires or fires alongside the jump. Removing is one action per row, keyboard
      reachable, and says what it is about to do before the click rather than after. The mode never
      survives the menu closing — one you return to without knowing is one where the next click deletes
      instead of goes.
      **Rename and reframe are deliberately not built.** `fn::rename_saved_view` and
      `fn::reframe_saved_view` exist and are driven; no surface calls them yet. Delete-and-re-save
      covers both, so the capability is whole without them rather than half-built — but reframe is the
      better verb and should get a surface, since it is the one that keeps a name attached to a framing
      that has drifted.
      **One framework gap fell out of building it, and it is fixed generically.**
      `getInfiniteCanvasContentViewport` is public and takes resolved insets, `InfiniteCanvas.Viewport`
      accepts `viewportInsets`, and `state.viewportInsets` holds the resolved form — three public
      surfaces trafficking in a type with no public name, so any consumer with chrome had to re-declare
      the shape. `InfiniteCanvasViewportInsets` and `InfiniteCanvasViewportInsetsInput` are exported
      now, with `docs/API.md` updated. The same omission the comment above that function already
      describes for `resolveInfiniteCanvasChromeMetrics`, which is what made it recognisable.
      **Driven end to end, and two defects came out of driving it that no typecheck could have.**
      Watched: the menu opens listing nothing over "Nothing saved here yet."; "Save this view" replaces
      the trigger with an input carrying the suggested name **already selected**, so the first keystroke
      replaces it; Enter commits and the trigger returns wearing a count; the view appears as a row and
      "Remove a view" appears with it; jumping restores the framing; removal takes the row and the count
      away together. The round trip was made deliberately hard to fake — saved at 18%, zoomed out to
      30%, jumped back, landed on **18%**.
      **The first defect took the whole canvas down.** `DropdownMenuLabel` is Base UI's _group_ label and
      reads `MenuGroupContext`, so a label outside a `DropdownMenuGroup` throws rather than warns:
      "Base UI: MenuGroupContext is missing" over the error page, on the first click. Worth more than
      the fix: **`DesktopSwitcher` had the same latent break in two places** — its "Not on this desktop"
      and "and N more" labels sit outside any group, and this file already recorded that section as
      "typechecked and read, not driven". That is what was waiting in it, and it would have fired the
      first time any window sat on another desktop. Both are grouped now.
      **The second was quieter and is the more interesting one.** `navigateToRect` defaults to
      `center`, and centring keeps the zoom you are already at — so the first jump moved the camera and
      left the framing wrong, which reads as "it went somewhere" rather than as a bug. A saved view has
      to _fit_: `behavior: { paddingPx: 0, type: "fit" }`. Zero padding rather than the default 80,
      because the stored rect is already the region the chrome leaves and `getFitCamera` fits into that
      same inset region — padding it again would zoom out 80px every trip, so a view re-saved from
      itself would drift wider each time.
      **The claim the geometry exists for is witnessed too, and by measurement rather than by eye.**
      That a view saved with the rail open frames what is beside the rail rather than what is behind
      it, stated as something falsifiable: **saving a view and immediately jumping to it must move the
      camera by nothing at all.** The stored rect is the region the chrome leaves and `getFitCamera`
      fits into that same region, so the round trip is an identity — and any confusion between the
      content region and the whole viewport breaks it, because fitting a whole-viewport rect into a
      smaller region necessarily zooms out.
      Driven with the rail open and the insets deliberately lopsided (`left: 288`, `top: 56`,
      `bottom: 168`): camera drift was `x: 0`, `zoom: 0`, and `y: -2.3e-13`, which is float noise
      rather than movement. The discriminator is what makes it evidence — had the rect been the whole
      viewport, the same jump would have landed on zoom `0.1377` instead of `0.1833`, a quarter of the
      scale gone in one visible step. **A test that could only pass one way is worth more than a
      screenshot that looks right**, which is why this is written as the identity rather than as "the
      subject did not appear to shift".
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
  **That claim is evidence now, and it did not need an asymmetric connector on screen to get
  there.** It stood here as "reasoning rather than evidence" because every connector available to
  drive had a symmetric route, where the routed midpoint and the endpoint average coincide and the
  case cannot tell them apart. The distinction is pure geometry, so it belongs in the framework's
  tests rather than in a canvas someone has to arrange: `scene-layer-geometry.test.ts` walks an
  elbow — `(0,0) → (100,0) → (100,50)` — and asserts the routed midpoint `(75, 0)` lies on a limb
  while the endpoint average `(50, 25)` lies on none, sitting in the open space the corner encloses.
  Proven to bite before being trusted: replacing the implementation with the endpoint average fails
  it with exactly `(50, 25)`.
  **Worth separating from the anchor question**, because the two get confused: this is about where
  the middle of a _route_ is, and it holds even with nothing occluding the line. Which part of the
  line is _visible_ is the different question below.
  **Still open:** a stub says how many connections are hidden and not which, and the count is per
  window rather than per neighbour, so two windows on the same note each repeat it.
  **Also still open, found by driving the whole flow rather than one feature:** a connector between
  two windows that nearly touch is almost entirely behind them. Windows resolve before edges, which
  is right — clicking a note should select the note — but the consequence is that the only part of
  such an edge you can aim at is the few pixels crossing the gap. At one arrangement the longest
  exposed segment measured 30px, and clicking its midpoint selected nothing because that midpoint
  was still inside a window. Nothing is wrong with the hit radius or the stacking; the geometry
  simply leaves nothing to hit. Two notes side by side are also the two most likely to be
  connected, so this is not an edge case.
  **A design was chosen and shipped, and this paragraph used to say none had been — read the code
  before reopening it.** The rejected idea was a label-shaped grab area, on two grounds that still
  hold: the routed midpoint is exactly the point measured as being _inside_ a window, so anchoring
  there inherits the problem it was meant to solve, and a `relates` edge draws no label at all by
  design, so a label-shaped target would give the least-annotated edges the smallest one. What
  survives occlusion is the longest run of the path no window rect covers — a different query from
  "the middle of the path", and the framework's to answer since it owns both the segments and the
  window rects. "Which part of this line can be seen" is not a Polkadot question, and the framework
  already answers it: `getInfiniteCanvasLongestUnoccludedSegment`, with `occlusion.test.ts` covering
  the nearly-touching pair by name.
  **So the marker goes to the middle of the clear run, or nowhere at all.**
  `connector-geometry` anchors on `clear?.midpoint ?? null`, and the `null` is the deliberate half:
  a fallback to the path midpoint was written, driven, and watched put the mark inside a window
  every time two windows overlapped heavily. A fixed position that stops the anchor jumping is worth
  nothing when the anchor is invisible in all of those positions.
  **What remains true is narrower than what stood here, and it is a decision rather than a gap.**
  When the clear run is a few pixels, that edge is effectively unselectable _on the canvas_ — the
  resolver offers every segment as a target, windows correctly win wherever they cover, and the
  geometry simply leaves almost nothing exposed. The answer is not a bigger target on the canvas: it
  is that the library rail lists every connection whether or not it can be seen, cuts it in one
  click, and needs neither end open to do so. That surface exists and is the one to reach for. An
  edge nobody can see is a real thing about the arrangement, and inventing a hit area that floats
  free of the line would be drawing something that is not there.
  **Cutting no longer waits on any of that.** The library rail lists every connection a note has,
  including ones whose other end is closed, and each row now says what the connection means and
  offers to cut it. That is the surface where acting on an edge does not depend on where its notes
  happen to sit — the occluded-connector problem stays open for _selecting_ one on the canvas, but
  it no longer blocks removing one.
- [x] **Mentions.** The third way to author an edge, and the one `relations.ts` has named as the
      natural one since it was written. **Built, and witnessed end to end** — typed, selected, written
      to the database, and still there after a reload.
      **The design question below is settled, and the answer is the second option.** A mention
      _authors_ a connection; it does not own it. Deriving edges from the text fails here for a
      reason stronger than the dragged-edge hazard that first stopped it: an edge in this app carries
      state of its own — a kind, and a label someone wrote on it. Recomputing edges from a note's
      body would mean rewording a sentence silently discards the label you put on that connection.
      The sentence is how the claim got made, not what the claim now is. So removing a mention leaves
      the connection standing, and the rail and the canvas are where it is cut. No schema change, no
      origin field.
      **What is built:** `MentionNode`, a `TextNode` subclass rather than a decorator — a mention
      _is_ text, so it wraps, selects and deletes like a word, where a decorator would be an island
      the caret has to step around. The note's id travels with the node, so the reference survives a
      rename and nothing resolves the note by the string that was typed. `MentionPlugin` composes
      `LexicalTypeaheadMenuPlugin`; the trigger, query lifecycle and keyboard traversal are the
      library's. The editor's contract holds — it is handed options and a callback, and told nothing
      about notes or relations.
      **Witnessed:** typing `@` opens the menu, it filters as you type, it lists the project's notes
      and omits the note you are writing in, and it portals into the framework's root rather than
      `document.body` (`portalParent: "portal-root"`) — the specific trap `note-editor.tsx` warns
      about, since a note lives inside `transform: scale(zoom)`. Selecting an option replaces the
      trigger with a mention chip, and **the mention survives a reload**, so the node's
      `exportJSON`/`importJSON` round-trip is real rather than assumed.
      **Witnessed, including the half that matters most:** selecting a mention writes the `relates_to`
      edge. Untitled 6 and Untitled 7 both stood at no connection count; typing `@Untitled 7` inside
      Untitled 6 narrowed the menu to exactly one option, and clicking it left both rail rows reading
      `1`. A full page reload kept them there, so the edge is in the database rather than in a store —
      and the `MentionNode` came back carrying Untitled 7's id rather than the string that was typed,
      which is the round-trip and the rename-survival property in one observation.
      **What it took to see it is worth knowing, because two earlier attempts proved nothing and one
      looked like a defect.** The first used a pair that was already connected, where `relate_notes`
      is idempotent and an unchanged count is not evidence. The next typed the mention correctly and
      `Enter` committed nothing — not a product finding: the console showed Vite reloading
      `routes/index.tsx` mid-attempt and taking the unsaved typing with it, while the browser pane sat
      at `innerWidth: 0`, which rules out pointer input entirely and leaves the canvas measuring itself
      against a zero viewport. `resize_window` restores the pane, and the canvas re-measures on its own
      once it has width. **A zero-size pane is an environment, not a bug** — a stale `viewport: {0,0}`
      read once nearly became a framework defect report; it had simply not re-measured yet.
      **Library-first is already settled:** `@lexical/react` is installed and ships
      `LexicalTypeaheadMenuPlugin`, so the trigger, the menu, keyboard traversal and the query lifecycle
      are the library's. Anything hand-rolled there is a defect. The product owns what the menu lists —
      the project's notes, from `projectNotes$` — and what selecting one writes.
      **The hazard: two authoring paths, one edge table.** The obvious design derives edges from the
      text, the way Obsidian and Roam do, so deleting a mention deletes the edge and nothing can drift.
      That works only when text is the _sole_ origin of an edge. Here it is not — an edge can also be
      dragged between two windows, and a drag leaves no text anywhere. Reconciling a note's edges
      against its body on save would therefore delete every dragged edge the moment its source note was
      edited, silently, with no undo. That is data loss dressed as a sync routine, and it is the failure
      this item is written down to prevent.
      **Two defensible ways out, and the choice belongs to whoever builds it.** Either give `relates_to`
      an origin so reconciliation can restrict itself to text-authored edges and leave dragged ones
      alone — a schema field on a `SCHEMAFULL` table, cheap to add and honest about the difference — or
      declare that a mention _authors_ an edge and does not own it, so removing the mention leaves the
      connection standing and the rail is where you cut it. The second needs no schema change and is
      coherent, but it breaks the symmetry people carry over from Obsidian, so it must be stated in the
      product rather than discovered.
      **What must not be built:** mentions that create edges with no story for removing them. That is
      the version that looks finished, accumulates edges nobody asked for, and makes the graph
      progressively less true the more the app is used.
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
  **All four are witnessed now, and the harness explanation was wrong.** This said a Base UI menu
  item could not be driven because a screenshot dismisses the menu and a coordinate click needs a
  screenshot in the same batch, so the two cancel out. They do not: putting the screenshot and the
  click in **one** `browser_batch` works, because the click reads the coordinates of the screenshot
  taken immediately before it in that same batch and the menu is still open when it lands. The whole
  section below was driven that way. Worth correcting rather than deleting — "the harness cannot"
  kept four claims unverified for weeks, and it was a wrong belief about the tool rather than a
  limit of it.
  **Select-on-open**: the rename field arrives with `selectionStart: 0` and `selectionEnd` at the
  full length, read off the focused input rather than judged from a screenshot; typing then replaced
  the name instead of appending to it. This one had a fossil arguing the other way — the stored
  desktop was called `Desktop 1ResearchResearch`, exactly the append-twice this guards against — and
  reading that as a live defect would have been wrong. It is a leftover from before the `select()`
  existed. **Reorder**: Move up on the second of two desktops turned `["Research", "Desktop 2"]`
  into `["Desktop 2", "Research"]`, with Move up disabled at the top and Move down disabled at the
  bottom. **"All windows" round trip**: entering a desktop emptied the canvas, returning restored
  `activeWorkspaceId: null` with all three windows in state and all three in the DOM. **Close this
  desktop**: the desktop went, the camera dropped back to All windows, and the window that had been
  filed onto it survived — which is the claim that matters, since the framework refuses to delete
  what a membership filter filters.
  **Both of the remaining two closed, in the switcher.** "Not on this desktop" lists every window
  the filter is hiding with the desktop it is on — or "no desktop", which is not an edge case but
  every window on the canvas the moment the first desktop is made. Clicking one is `window.reveal`.
  And a selection can be filed onto a desktop in one click rather than one trip through the
  launcher per window — see below, because the first version of that row could not actually be
  reached.
  That last one used to be N dispatches, which is N undo entries for one gesture, and the desktop
  was half-populated at every step in between — so undoing "put these three there" took three
  undos and passed through two states nobody asked for. Batching it in the product would have
  restated the framework's rule about what a single edit is, so it was recorded as an ask instead.
  **The ask is built.** `workspace.moveWindow` takes `windowIds` now, the gesture and the edit are
  the same size, and the app dispatches once. The plural needed no new logic:
  `normalizeInfiniteCanvasWorkspaceWindowIds` already deduped, dropped ids naming no live window,
  and expanded each group, so the function that was written around a `Set` simply stopped being
  handed a set of one. `windowId` was replaced rather than joined by a plural — this repo keeps no
  compatibility path for a shape it has replaced, and moving one window is a set of one. The action
  is `workspace.moveWindows`, matching `setWindows`: in this union a name is plural when it takes a
  set.
  **Building it opened a hole, and the hole was older than the feature.** Filing the *active* window
  onto another desktop left it active and selected while the canvas stopped drawing it — so close,
  minimize, dock, place and resize all aimed at a window nobody could see.
  `activateInfiniteCanvasWorkspace` already states the rule for the moment you *enter* a desktop —
  a window it does not admit "must not stay selected or active either" — and nothing applied it in
  the other direction, where membership changes under a stationary camera. `removeWindow` could do
  it too; the plural move just made it a one-click gesture.
  Fixed where the reducer already reconciles workspaces once per action rather than in the writers
  that can cause it, which is the same argument that file makes for reconciling group-completeness
  there. The fallback matches entering exactly — the selection's anchor, then the last selectable
  window, then nothing — so the canvas is never left with no active window while one is plainly
  available, and a window the desktop still admits is untouched. That last half is what keeps it
  from being a clear-everything hammer, and it is asserted rather than assumed.
  **And driving the second found that it could never have run.** "Bring N windows here" appeared
  only while a desktop was active, and it read the selection — but **entering a desktop clears the
  selection**. `activateInfiniteCanvasWorkspace` normalizes the incoming selection against the
  workspace being entered, because a selected window the filter hides would arm every verb keyed to
  the active window against something nobody can see. That rule is right; the row built on top of it
  was not. So the gesture its own comment described — "select three notes, enter the desktop you
  want them on, one click" — was impossible: by the time you arrived, nothing was selected. Measured
  before replacing it: select two, enter, and the count goes 2 → 0. It had been in the file long
  enough to be described in three places and had never once appeared.
  **The move happens without entering now.** The menu offers "Move N windows to" with a row per
  desktop that does not already hold the whole selection, which works from "All windows" — the one
  place you are most likely to be while gathering things, and the one place the old row could never
  show. Driven: two windows selected on All windows, one click, both filed, `history.past` 1 → 2 —
  one entry for two windows — and one undo put both back with all three still on the canvas.
  **"Not on this desktop" is driven too.** It renders its label and a row per hidden window with the
  desktop each is on — "no desktop" for all of them before anything is filed — and it correctly
  drops a window from the list once that window is on the desktop you are standing on. The verb
  underneath both is covered by tests as well: filing three windows lands one
  history entry, one undo puts all three back, and a set carrying a duplicate and a dead id
  normalizes to the one real window.
  **That section was one click from taking the canvas down, and nobody had ever opened it.**
  `DropdownMenuLabel` is Base UI's _group_ label and reads `MenuGroupContext`, so a label outside a
  `DropdownMenuGroup` throws rather than warns — straight to the error page. Both labels here sat
  outside one; the "Desktops" label above them was always safe because a radio group supplies the
  context. It would have fired the first time any window was on another desktop, which is the
  ordinary case, and it survived this long precisely because "the harness cannot re-open the menu"
  was believed. A section that is only ever typechecked is a section whose crash is waiting.
  **Closed, in the framework, where the audit said it had to be.** The offscreen ring pointed at
  windows that are not on the active desktop: `getInfiniteCanvasOffscreenIndicators` filtered on
  `minimized` alone and never consulted workspace membership, so entering a desktop filled the ring
  with arrows aimed at windows the canvas is not drawing — an empty desktop carried a "Go to
  Untitled 3" chip for a note filtered off it. Worse than useless on precisely the screen this file
  already says is "indistinguishable from losing your work": an arrow is a claim that something is
  just off the edge, which is the exact thing a desktop is for hiding.
  It is fixed where `window.reveal` was fixed and by the same rule. `offscreen.ts` reads
  `getInfiniteCanvasWorkspaceWindowIds` once and admits a window only when the active workspace
  holds it; `null` means no desktop is active and admits everything, so a canvas that never makes
  one is untouched. Groups take the same set on `some` member, since membership is group-complete.
  **The audit's reasoning for refusing to wrap it held up**: post-filtering the returned indicators
  would have left a surviving chip carrying a `targetCount` that counted windows on other desktops
  — a badge that lies — because `limit` and `mergeWithinPx` are applied inside. Pinned by a test
  that fails without the change with `expected [ 'near', 'far' ] to not include 'far'`.
  **Witnessed in the app as a contrast rather than an absence**, because "no arrows" on its own
  proves nothing — a canvas with everything on screen has none either. Camera parked far from every
  window so all three are genuinely offscreen: on All windows the ring carries one chip reading
  "Go to Notes, and 2 more this way"; entering the empty desktop with the camera untouched leaves
  zero chips and zero windows drawn. That second reading is the one the audit recorded as a defect.
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

- [x] **A canvas holds more than one kind of thing.** `type WindowKind = "note"` was the single
      line behind most of the framework going unexercised: the dock, groups, docking, and drop
      placement are all built for a canvas with variety, and there was none. An image is the second
      kind, and it was chosen because its physics are the _opposite_ of a note's on every axis the
      window definition offers — a wheel over it belongs to the camera rather than to a scroll
      container, a drag across it pans rather than selects, and it declares no summary, because a
      picture at a tenth of the size is still the picture while a paragraph is grey noise.
      **The database never needed changing, which is the finding.** There has never been a `note`
      table: a note is a `content_item` with `kind = "note"`, `content` is FLEXIBLE, and
      `relates_to` is `IN content_item OUT content_item`. Only the layer above claimed otherwise,
      and it claimed it in every name — `fn::relate_notes`, `connectNotes`,
      `getConnectorRectsByNote`. So the SurrealQL functions took their kind as a parameter, the
      relation store moved out of `notes/`, and window data became one `{ itemId }` for every kind,
      since `window.kind` already says which sort of item it is. Two id names were why nothing
      could ask a window what it was bound to without knowing its kind first.
      **Dropping a file on the canvas is how a picture gets there**, and it is the framework's own
      drop pipeline: the viewport hears the native drag events and translates them into the
      interaction the pointer path already produces, so `canDrop`, snapping, guides, and the
      preview all work with no coordinate maths in the app. Inert without a `dropPolicy`, so a
      canvas that was never told what a file means leaves the browser's handling alone.
      Driven: a 400×400 PNG dropped at 60%/55% of the viewport opened at 360×392 — square plus the
      header — with all three drag events `defaultPrevented`; a `.txt` showed `dropEffect: "none"`
      and created nothing; two pictures dropped 409×449 client pixels apart landed 408×451 world
      units apart at zoom 1; and five images came back decoded after a reload.
      **A picture is connected to a note and the line is drawn**, which is the whole point of the
      change and was witnessed rather than inferred: `connectItems` wrote the `relates_to` edge,
      `getDrawnConnectors` returned a four-point path for a pair it would have returned nothing for
      before, and the canvas painted a `polyline` in `--accent` between the two windows with its
      anchor dot on the clear stretch. Worth recording that the first check reported `pathCount: 0`
      while the connector was on screen the whole time — the layer draws `polyline`, not `path`,
      and a query written against the wrong element name is indistinguishable from a feature that
      does not work until you look at the screen.
      **Cost, stated rather than buried:** windows saved before this carried `{ noteId }`, which no
      longer validates, so an existing canvas shows its windows as unbound. The records are
      untouched and reopen from the library; the repo keeps no compatibility path for a shape it
      has replaced.

- [x] **Minimizing is no longer a one-way door.** The chrome always offered it and `mode:
"minimized"` is what it set, but with no dock nothing on the canvas said where the window
      went — the only route back was a library rail row, which reveals the _note_ rather than the
      window and is absent when the rail is collapsed. `minimizedDock: false` had sat uncommented
      in the HUD policy while every other line in that object was argued for, which is what marks
      it as an unexamined default rather than a decision. Turning it on found four framework
      defects, all in the table below.

## Later, deliberately

- **Tours** — `getInfiniteCanvasWorldPath` and `…PointAtProgress` are built for guided paths
  through a canvas. Nothing consumes them yet.
- **The 3D layer.** Window proxies and frustum culling exist behind `/scene`. Far-zoom overview
  is the honest use, not decoration.
- **Sync.** Local-first is the whole product until it is not. SurrealDB is the choice when it
  becomes a real need.

## Framework gaps Polkadot has found

Kept here because the list _is_ the incubator's output.

| Gap                                                                                                      | Generic affordance                                                              | State  |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------ |
| Backdrop was hardcoded                                                                                   | `renderBackdrop`, mirroring `renderOverlay`                                     | landed |
| No way to observe "the durable document changed"                                                         | `InfiniteCanvasHandle.subscribeDocument`                                        | landed |
| Hydration adopted a fallback's unusable viewport                                                         | `desktop.hydrate` keeps a usable viewport over the payload's                    | landed |
| `chrome` demanded all five metrics, and the defaults are not exported                                    | `InfiniteCanvasChromeMetricsInput`, mirroring `zoomPolicy`                      | landed |
| No DOM layer between the backdrop and the windows: connectors meant losing the grid or taking on `three` | `renderUnderlay`, the counterpart to `renderBackdrop` and `renderOverlay`       | landed |
| Workspaces could be walked but never entered: no command made one, named which to go to, or closed one   | `workspace.create`, `workspace.enter`, `workspace.close`                        | landed |
| Navigation was not desktop-aware: going to a window another desktop hid panned the camera to nothing     | `window.reveal` — go where the window is, restore it, focus it                  | landed |
| The HUD pinned itself to the element's edges, ignoring the bands every camera verb already respects      | `canvas-hud` insets its root by `viewportInsets`, per edge                      | landed |
| The HUD's bottom edge was two absolutes pinned to opposite sides, free to grow into each other           | one flex row: the dock shrinks and wraps, the controls hold their size          | landed |
| A dock item's padding was an inline style and its text was uppercased, over a `window.title`             | both moved into `theme.css`, where a consumer can reach them                    | landed |
| A body wrapper fixed at `min-height: 100%` made `height: 100%` impossible for its own content            | the wrapper follows the kind's `overflowY`: growable if it scrolls, else pinned | landed |
| The drop system was pointer-only, so a file dragged in from the OS could reach none of it                | the viewport bridges native drag events into the same drop interaction          | landed |

**On the fourth-from-last row**, because it is the one a consumer cannot work around. The wrapper
was pinned to `height: 100%` once, which gave its scroll container nothing to scroll and made a
long note unreachable; the fix was `min-height`, and that fix was right for every kind that
scrolls. It was silently wrong for every kind that does not: with `min-height` alone the wrapper's
used height is `auto`, so a consumer asking for `height: 100%` resolves against nothing and
collapses to its content. An image window's picture overflowed the frame it was supposed to be
letterboxed inside. One rule cannot serve both, and the definition already says which case it is
in — the kind's own `overflowY`. Both directions now have a test, and both were confirmed to fail
with the fix reverted, because a test that cannot fail is not evidence.

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
