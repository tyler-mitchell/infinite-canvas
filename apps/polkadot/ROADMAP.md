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
- **Every class comes from a `tv` slot.** No Tailwind strings in JSX, ever. Global CSS is tokens,
  resets, and imports only — **and every rule in it lives inside a layer.** Only `:root` is exempt,
  because it declares custom properties and nothing else.
  That clause used to stop at "every _reset_", and the licence it granted cost the app its
  typography: `styles.css` ended with an unlayered `button, input, textarea { font: inherit }`,
  which in the CSS cascade **outranks every layered style**, including the whole of
  `@layer utilities` this file declares on line 1. One bare selector beat the utility system. Every
  font-size and font-weight utility on every button, input and textarea rendered at the document
  default: the note title declared `text-[15px] font-medium` and drew at 16px/400, rail rows
  declared 12.5px and drew at 16px, the rail search declared 12px and drew at 16px. The classes
  were on the elements and the rules were generated — they simply never won, so nothing errored and
  nothing looked broken enough to chase.
  Found by measuring a computed style against its declaration rather than by looking, which is the
  only way this is visible; a screenshot of it reads as "the rail seems a bit loose". Deleted rather
  than layered, because Tailwind's preflight already declares `font: inherit` on that set inside
  `@layer base` where utilities can beat it.
  Deleting it fixed the one line and left the mechanism, because **the whole file was unlayered** —
  all 23 rules, every one of them a ceiling over `@layer utilities`. They now sit in
  `@layer components`, which the line-1 order puts after the framework's `infinite-canvas` and
  before `utilities`: slot overrides still beat the framework's theme, and a utility now beats a
  slot override. The framework carries the other half — `theme.css` used to promise a cascade
  position it cannot hold, since a layer is ordered by where it is first established, so importing
  the theme after `@import "tailwindcss"` makes the theme outrank every utility. That is documented
  now, and a containment test fails if any rule is ever written outside the framework's layer.
  The general shape has its own bullet below, because it outgrew this one.
- **Every declaration must be shown to win.** This app's most expensive defect class is not a
  wrong value — it is **a declaration that is present, generated, and never wins.** It emits no
  error, fails no typecheck, and produces no obviously broken pixel, so it survives review for as
  long as nobody measures. Four instances so far, by two different mechanisms:

  - an unlayered `font: inherit` reset outranked all of `@layer utilities` — every font utility on
    every button, input and textarea rendered at the document default;
  - the same, one level up: the _whole_ of `styles.css` was unlayered, so all 23 rules were a
    ceiling over the utility system;
  - `theme.css` was ordered by import position, so a consumer importing it after Tailwind gets a
    framework theme that outranks every utility they write;
  - a `justify-content: flex-end` on the note and link header, which never applied because the
    framework writes `justify-content` into that header's **inline** style, and inline beats every
    stylesheet rule at any layer. These kinds hide the chrome title, so the header has exactly one laid-out child —
    and `space-between` parks a lone child at the _start_. Note controls sat on the left for weeks,
    with half the header empty to their right.

  The first three are cascade layers; the fourth is inline style, which no layer can reach. What
  they share is the symptom, and the symptom is the point: **a screenshot cannot find any of them.**
  The reset one reads as "the rail seems a bit loose"; the header one was read off a screenshot as
  correct and was not. The only thing that finds this class is reading the computed value back and
  comparing it against what was declared — `getComputedStyle`, not the eye. Do that once per visual
  change and this class stops shipping.

- **Nothing hand-rolled that a maintained library owns.** TanStack (Router, Pacer, Hotkeys,
  Form, Virtual, DB), Base UI, cmdk, ArkType, Legend State, motion, tailwind-variants.

## Now

- [x] **Disconnecting two items destroys authored content, and nothing can bring it back.**
      **Closed in `2baf603`, and the scoping below is left as written because the route it proposed
      was not the one taken.** Read it before trusting it: the schema change it describes is not
      needed. An edge is entirely described by its two ends, its kind and its label, so an inverse
      that reconnects with all four restores everything a reader can observe — the soft delete buys
      only the row's identity, and nothing addresses an edge by id across a cut, since every surface
      resolves by endpoint pair. `disconnectItems` reads the edge before the write and registers its
      own reversal with `rememberUndoableAction`, which is the caller this entry correctly said the
      work was waiting for and which did not exist when it was written. Driven in exactly the
      sequence recorded below: connect as `supports`, label "load-bearing evidence", disconnect, take
      the palette's undo row — the edge returns carrying both.
      What is still open is smaller and named in `connection-removal-dialog.tsx`: undo is one step
      and expires when the next reversible act replaces it, where the archive list is permanent, so
      whether a reversible cut still warrants its confirmation dialog is a judgement nobody has made.
      Found on 2026-08-27 by asking whether an agent driving this app can do irreversible harm —
      a question WebMCP made worth asking, since the spec has no `destructiveHint` and
      `selection.close` and `canvas.describe` are indistinguishable to a caller.
      Canvas harm is fine: closing three windows through `selection.close` and calling
      `history.undo` restored exactly the same three ids. The database is the half that history
      does not reach. Driven: connect two notes as `supports`, label the edge "load-bearing
      evidence", `relation.disconnect`, then `history.undo` — which answers **"Undo is not
      available right now."** Reconnecting gives a bare `relates` edge. The kind and the label a
      person typed are gone for good.
      **This contradicts the app's own stated rule**, written on `archiveProjectItem`: removal is
      archiving precisely because "nothing is destroyed, so nothing has to be weighed", and that is
      why archiving needs no typed confirmation. `database.relations.disconnect` deletes the row,
      so the one removal that _does_ destroy something is the one with no confirmation, no undo and
      no archive.
      **Half done in `b708a53`, and the half that is done is the smaller one.** `relation.disconnect`
      now reads the edge before the write and reports what went — `contradicts 'blocks the review'` —
      naming the two verbs that rebuild it. A default `relates` edge carrying no label stays quiet,
      because it says nothing beyond existing and reporting it would train a caller to ignore the
      report that matters.
      **What is still owed is the part that helps a person.** Someone cutting a connection in the
      library rail gets no report and no undo; the string only exists for a caller that reads tool
      output. Making the loss _reversible_ rather than legible means an edge carries the same
      reversible removal a content item has — a stored flag every read filters, across the rail, two
      palette rows, the connector hotkeys and `app-actions` — and `fn::unrelate_content_items` stops
      deleting the row. That is a schema change plus a filtered column serving a list nobody browses,
      which is exactly why it wants a deliberate decision rather than a late-session one.
      A returning `disconnectItems` and a `restoreRelation` were written and then deleted: no caller
      used either, so both were speculative machinery. Whoever takes the reversible route should
      write them again _with_ the caller that needs them, most likely an undo affordance on the
      rail's cut control.

- [x] **Agents reach the product through WebMCP.** Spiked by Tyler on 2026-08-26. The app half is
      built and tested: `app-actions.ts` is the capability vocabulary, entries whose argument cannot
      be enumerated carry an ArkType `input` whose `toJsonSchema()` is what a caller is offered and
      whose type is what the verb validates with, and `describeCanvas` / `describeProjectContent`
      are the reporting half — because a verb-only vocabulary is complete for a pointer, which gets
      its answer by looking, and half a vocabulary for anything that cannot see the screen.
      `model-context.tsx` registers all of it, feature-detected against `document.modelContext` and
      the pre-150 `navigator.modelContext`.
      **It has now run, on 2026-08-27.** This entry said the registration had never executed and
      could not be made to from here; both halves are obsolete. Chrome 152 with
      `--enable-blink-features=WebMCP`, reached through `chrome-devtools-mcp
--categoryExperimentalWebmcp`, registers the whole vocabulary, counted from `getTools()`: **112
      tools** on 2026-08-28, of which 5 are reporters and 25 take an argument.
      The number written here has now been wrong twice — 97, then 108 — which is the argument
      against writing it down at all rather than an argument for updating it more often. It is kept
      as a dated measurement, and what actually holds the registry together is asserted instead:
      `published-commands.test.ts` pins that every framework exclusion is derived rather than
      listed and that no published verb shares a name with an app verb, and
      `offered-input-schemas.test.ts` pins that every argument-taking verb advertises a schema a
      caller can fill in. A count nobody can act on is prose; those are the properties a caller
      depends on. No origin-trial token was needed: the flag alone is enough on a local origin, and
      the browser is launched by the MCP server rather than relaunched by hand.
      Driven end to end: `canvas.describe` on an empty canvas, `note.create`, `canvas.describe`
      again naming the window that appeared, `content.list` agreeing about the record behind it. A
      sweep of all 83 no-argument verbs threw nothing — 41 acted, 40 refused on genuinely unmet
      preconditions, 2 report.
      **One correction to the tooling's own documentation.** `chrome-devtools-mcp --help` says
      WebMCP needs `--enable-features=WebMCP`. On 152 that flag does not expose the API;
      `--enable-blink-features=WebMCP` does. Both are passed, since they disagree and the cost is
      nothing.
      Two defects only running it could find, both fixed: every argument-taking verb reported
      "done" when it had refused, because `run` returned `void` and collapsed three outcomes into
      one; and nothing was ever unregistered, because the cleanup loop looked for a disposer return
      that `registerTool` does not have — the spec's mechanism is an `AbortSignal`.
      Still unverified: the declarative (`<form>`-annotation) half of WebMCP, cross-origin
      `exposedTo`, and behaviour under a real browser-integrated agent rather than a DevTools
      client.
      **`untrustedContentHint` does not exist.** `docs/research/spikes.md` cites it as the reason to
      think about security here, and it appears nowhere in the explainer — the security surface WebMCP
      actually defines is the `tools` permissions policy, `exposedTo`, and secure-context origins.
      The real open question, named as such in the spec, is user confirmation for consequential tool
      calls: there is no `destructiveHint` and no elicitation mechanism, so `selection.close` and
      `canvas.describe` are indistinguishable to a caller. This app renders third-party content and
      registers verbs that close windows; that pairing is worth a decision before any agent beyond a
      developer's own DevTools client is pointed at it.
      **A correction to what this entry said one commit ago, because it was wrong and it would have
      sent the next reader to build a surface nothing needs.** It claimed the parameterized verbs
      have no human surface and that `content.open` is "reachable by nothing at all", and proposed a
      palette page that picks an argument. The verb is invoked by no UI, which is true; the
      capability it names is reachable by pointer through the library rail, which browses every kind
      and opens what you click — driven, opening `image.png` from it. A palette page would be a
      second way to do what the rail already does, which is the duplication this app has spent the
      day removing rather than adding.
      `content.open` exists for the caller that cannot point at a rail row. That is the whole reason
      it takes an id and the reason no control invokes it, and both are correct rather than a gap.
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
      **The ink family only became warm on 2026-08-26, and the comment above it had claimed so for
      months.** `/* Ink — warm against the cool ground. */` sat over `--ink` at hue 85 and
      `--ink-muted` and `--ink-faint` at hue 265 — the _ground's_ hue, shared with `--surface` and
      `--surface-raised`. That would be a rounding error if `--ink` were what the app is written in,
      and it is not: rail rows, HUD buttons, the zoom readout, dock items and every window control
      at rest are muted or faint, so nearly all of this app's text was cool grey on a cool ground,
      separated from it by lightness alone. That is the "pure grey on pure black" default the bar
      rejects, wearing a different colour. Both are hue 85 now.
      **Hue only, so this cannot be a legibility change hiding inside a taste one** — lightness and
      chroma are untouched, and in OKLCH `L` is perceptual lightness, so contrast against every
      surface is exactly what it was. Recessive ink still recedes by dropping lightness rather than
      by drifting toward the background it sits on.
      **Not demonstrated, and worth saying:** the reasoning is from the stated intent and the
      computed values, not from a comparison anyone looked at. The dev pane downscales 1440 to 800,
      region crops are unsupported, and an HMR reload wipes a runtime override mid-A/B, so a
      before-and-after of a subtle hue shift was not obtainable here. Worth an eye on a real display
      before it is called settled.
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

- [x] **An agent cannot reach the document level.** Found on 2026-08-27 by reading the whole of
      `app-actions.ts` before adding to it, and closed the same day. The vocabulary was twenty verbs
      with no `canvas.*` and no `project.*` among them: nothing created a canvas, duplicated one,
      switched to one, or mentioned that any canvas existed but the open one. An agent was confined
      to whichever canvas the page happened to load, with no way to learn there were others.
      **Built:** `canvas.create`, `canvas.duplicate`, `canvas.open`, `project.create` and
      `project.open`, with `canvas.list` and `project.list` as the reporters that publish the ids
      they take — a verb taking a handle nothing reports is half a capability, which is the same
      argument `describeCanvas` and `describeProjectContent` were written under.
      `AppActionContext` gained `goToCanvas`, `canvasId` and `canvasTitle`: a verb needs one
      destination, and handing the vocabulary a router would let any verb go anywhere.
      **The first version of this published which canvas is open into a `workspace/open-canvas.ts`
      module, mirroring `open-project.ts`, and that was wrong — it was deleted the same day.**
      `open-project.ts` earns its place because no route names a project. A route does name a
      canvas, so that module was a second answer to a question `/canvas/$canvasId` already settles,
      free to go stale against the URL — and it forced a "no canvas is open" refusal that could only
      ever fire if the copy disagreed with the route. All four context sites read
      `useLoaderData({ from: "/canvas/$canvasId" })` instead, which is the same fact from the thing
      that owns it, and the refusal is gone with the branch that needed it.
      **Driven, on a clean profile.** `project.list` named the open project; `canvas.create` with a
      title made and travelled to a canvas the switcher then showed by that name; `canvas.duplicate`
      gave "Second copy" and duplicating _that_ gave "Second copy 2" rather than "Second copy copy";
      `canvas.open` by id went back; and `project.open` on the project already open left the route
      alone while the most recent canvas was a different one — the case a missing guard would have
      moved somebody in.
      **Still missing at this level:** renaming or archiving a canvas or project. Both are pointer-only
      in the switchers. `canvas.create` and `project.create` take an optional title, so a caller can
      name what it makes, but nothing can rename what it already made.
      **The asymmetry is what makes it plain.** `workspace.create` is an `AppAction`, so an agent can
      make a _desktop_ — which is a filter over the windows within one canvas — while the canvas that
      the filter is over is unreachable. `/canvas/$canvasId` is the app's primary unit and it is the
      one thing the vocabulary cannot name.
      **Checked against this file's own correction above, which is the test that matters here:** that
      paragraph was written because a gap was claimed for `content.open` when the _capability_ was
      reachable by pointer through the rail. This one survives that test. Palette rows and switcher
      menu items are not registered as tools, and no framework command creates a canvas, because a
      canvas is a database record rather than anything the framework models. The capability is
      reachable by pointer and by nothing else.
      **It is one sprint rather than three, and the reason is the reason it has not been done.** The
      creating half is trivial now — `createCanvas`, `duplicateCanvas` and `createProject` are all
      module functions taking the project and holding the naming lock. But a verb that makes a canvas
      an agent can neither observe nor travel to hands back an id for something it cannot use, which
      is the shape `AppAction.run`'s docstring is about: a caller with no second source acting on a
      success it was told about and cannot check. So the reader and the travelling are not follow-ups.
      **The blocker was navigation, and the fix was smaller than this entry first claimed.** It said
      the seam wanted a router instance exported from its own module, because `main.tsx` keeps it as
      a local `const` and nothing outside a component could reach it. That premise died with the
      design: the context carries `goToCanvas`, so nothing outside a component navigates, and no
      router singleton was built or needed.
      What was real is the duplication, and supplying `goToCanvas` to four context sites made it
      worse before it made it better — `{ params: { canvasId }, to: "/canvas/$canvasId" }` ended up
      written **eight** times across seven files: the palette, three HUD surfaces, both switchers,
      the conflict notice and the tool registry. `useGoToCanvas` is the one place now. It is a hook
      rather than a module function because navigating is `useNavigate`'s job, and it returns the
      router's promise rather than swallowing it, so the one caller that must land before it acts —
      the conflict notice — can await it and the rest are made to say `void` out loud.
      It is a `useCallback` for a reason worth keeping: `model-context` lists it in the dependencies
      of the effect that registers a hundred-odd tools, and a fresh identity per render would tear
      those down and rebuild them on every render above it. That file had a comment saying exactly
      that and kept its own inline copy to dodge it, which is how the hazard was found.
      **Two corrections to this entry, made the same day it was written.**
      It said "enter a project through its most recent canvas" was written three times, counting the
      `/` loader as the third. It is not one: `/` calls `readMostRecentCanvas()`, which is the most
      recent canvas across _every_ project and answers "where does the app open", not "where does
      this project open". There were two copies, they disagreed, and they are now one —
      `getProjectEntryCanvas` in `projects/enter-project.ts`, with the defect that disagreement
      caused fixed.
      And it proposed the wrong seam. It said to export the router from its own module, citing that
      as TanStack's documented way to navigate outside a component. That deadlocks here: such a
      module must import `routeTree.gen`, which reaches the route files, `workspace-canvas`,
      `canvas-hud` and `command-palette` — and the palette importing back runs
      `createRouter({ routeTree })` against a binding that is still initialising. The pattern is
      sound where the importers sit outside the route graph; every caller here sits inside it.
      So navigation belongs on `AppActionContext`, supplied by the four sites that construct one and
      already hold a router by hook. That is the seam to do first, and `getProjectEntryCanvas` is
      the shape the rest should follow: the _rule_ is a module function that needs no router, and
      only the final `navigate` call needs one. Split that way, most of each verb is testable without
      a browser and the router-shaped part stays one line.

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
      **That rule has moved to where the opening happens, because keeping it here was the defect.**
      The rail chose between reveal and open _itself_, so the rule lived in one caller rather than
      in `openContentWindow`. The moment a second surface opened items — collections — that surface
      did not have it: clicking a collection row for a note already on the canvas made a second
      window bound to the same record, which is the state where editing in one and reading the other
      looks like the save failed. Two windows on one note is not a feature this app offers, and
      nothing else could reach that state, which is why it went unnoticed.
      `openContentWindow` now reveals an existing window for the same item, so the rail, the palette,
      collections and whatever opens items next all get it. Driven on the defect itself: a collection
      row opened `connectable.png`, the window was minimized, and clicking the same row again
      restored _that_ window — one window bound to the item, `mode` back to `normal`, focused —
      rather than opening a fifth. Another instance of a derived surface having to ask the same
      question the verb asks.
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
  The anchor is the framework's — `getInfiniteCanvasWorldPathPointAtProgress` over
  `getInfiniteCanvasWorldPath` — so it walks half the _routed_ length rather than averaging the
  endpoints.
  **Two corrections to that sentence, both measured.** It said the anchor is taken over the whole
  `path`; it is not, and has not been since the marker started avoiding windows — it is taken over
  the longest stretch nothing covers, because between two notes that nearly touch the midpoint of
  the whole path is _inside_ a window. And it justified walking by saying that averaging the
  endpoints "lands in open space beside the line", which is false for this router:
  `getOrthogonalConnectorPathPoints` always returns a symmetric Z crossing at the exact halfway
  point, so the endpoint average is `(midX, midY)` — on the middle segment, always — and the walk
  arrives at the same point. A fixture built to separate the two measured the average zero units
  off the line. The walk is still right, because a clipped _run_ carries none of that symmetry;
  the reason given for it was not.
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
  **Half of this is settled and the other half is deliberate.** The duplication worry —
  "the count is per window rather than per neighbour, so two windows on the same note each repeat
  it" — describes a state the app can no longer reach: every opener routes through
  `openContentWindow`, which reveals an existing window for the same item rather than opening a
  second, so one item has at most one window. Drops and new collections mint fresh records, so they
  cannot collide either. A persisted layout written before that fix could still hold a pair; nothing
  makes one now.
  **That a stub says how many and not which is the design, not a gap.** A stub reports an absence
  and is drawn at 25% opacity for that reason; names on it would be the canvas shouting about what
  it is not showing, in the one place there is no room for them. **The count was drawn badly and
  that is now fixed**, which is a different complaint from the one recorded here and was only
  visible by looking: the digit was centred on `stub.endpoint`, the point where the line stops, so
  the dashes ran into it and through it. It read as a line that failed to finish with a stray number
  beside it rather than as a count terminating a line. It is anchored `start` past the end now —
  measured at 100%, the line ends at x 922 and the digit begins at 928 — and the offset is in screen
  pixels like the text, so a world-space gap cannot close up as the camera pulls back, which is
  exactly where the mark is already hardest to read. `start` also means a two-digit count grows
  rightwards into empty canvas instead of creeping back over the dashes.
  The rail already answers "which" —
  it lists every connection whether or not either end is open, reaches one in a click, and cuts it
  — and stubs are deliberately not clickable so there is no second hit-testing path competing with
  the framework's. Witnessed at 97%: a dotted line trailing off the window's right edge ending in a
  small "1", and at 0.697 the count is gone while the line remains, which is the 8px legibility
  floor doing its job rather than a rendering failure.
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
  **Building it opened a hole, and the hole was older than the feature.** Filing the _active_ window
  onto another desktop left it active and selected while the canvas stopped drawing it — so close,
  minimize, dock, place and resize all aimed at a window nobody could see.
  `activateInfiniteCanvasWorkspace` already states the rule for the moment you _enter_ a desktop —
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

- [x] **Groups are reachable.** The framework has shipped the whole model since before this app had
      a second window kind — Alt-drag docking, dock commands, three layouts, persistence — and
      Polkadot offered no way in. A capability behind a modifier nobody presses speculatively, or a
      palette row nobody searches for, is a capability nobody has.
      Two surfaces close it. The selection rail gained a group verb, dim below two like the align
      verbs beside it. A group rail appears when the active window is grouped: the three layouts as
      a segmented choice, undock, ungroup. Layout reads the _container_ holding the active window
      via `getInfiniteCanvasGroupParent`, not the group root — a nested split inside a tabbed group
      is where those differ.
      Driven: two windows to a group with a rect spanning them; split → tabs → accordion each
      reaching the tree with the live segment following; ungroup dissolving it and leaving all
      twelve windows. **And the round trip, which this app had never checked:** a group survives a
      full reload with the same id, layout, member count and rect to the last decimal. Worth
      checking rather than assuming, because this app's autosave has silently stopped twice.
      No framework change was needed and none was made — `InfiniteCanvasHudPolicy` has no group
      surface, so the rails are the app's rather than a second copy of one.

## Later, deliberately

- **Tours** — `getInfiniteCanvasWorldPath` and `…PointAtProgress` are built for guided paths
  through a canvas. Nothing consumes them yet.
- **The 3D layer.** Window proxies and frustum culling exist behind `/scene`. Far-zoom overview
  is the honest use, not decoration.
- **Sync.** Local-first is the whole product until it is not. SurrealDB is the choice when it
  becomes a real need.

## Framework gaps Polkadot has found

Kept here because the list _is_ the incubator's output.

| Gap                                                                                                                                        | Generic affordance                                                                                            | State  |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- | ------ |
| Backdrop was hardcoded                                                                                                                     | `renderBackdrop`, mirroring `renderOverlay`                                                                   | landed |
| No way to observe "the durable document changed"                                                                                           | `InfiniteCanvasHandle.subscribeDocument`                                                                      | landed |
| Hydration adopted a fallback's unusable viewport                                                                                           | `desktop.hydrate` keeps a usable viewport over the payload's                                                  | landed |
| `chrome` demanded all five metrics, and the defaults are not exported                                                                      | `InfiniteCanvasChromeMetricsInput`, mirroring `zoomPolicy`                                                    | landed |
| No DOM layer between the backdrop and the windows: connectors meant losing the grid or taking on `three`                                   | `renderUnderlay`, the counterpart to `renderBackdrop` and `renderOverlay`                                     | landed |
| Workspaces could be walked but never entered: no command made one, named which to go to, or closed one                                     | `workspace.create`, `workspace.enter`, `workspace.close`                                                      | landed |
| Navigation was not desktop-aware: going to a window another desktop hid panned the camera to nothing                                       | `window.reveal` — go where the window is, restore it, focus it                                                | landed |
| The HUD pinned itself to the element's edges, ignoring the bands every camera verb already respects                                        | `canvas-hud` insets its root by `viewportInsets`, per edge                                                    | landed |
| The HUD's bottom edge was two absolutes pinned to opposite sides, free to grow into each other                                             | one flex row: the dock shrinks and wraps, the controls hold their size                                        | landed |
| A dock item's padding was an inline style and its text was uppercased, over a `window.title`                                               | both moved into `theme.css`, where a consumer can reach them                                                  | landed |
| A body wrapper fixed at `min-height: 100%` made `height: 100%` impossible for its own content                                              | the wrapper follows the kind's `overflowY`: growable if it scrolls, else pinned                               | landed |
| The drop system was pointer-only, so a file dragged in from the OS could reach none of it                                                  | the viewport bridges native drag events into the same drop interaction                                        | landed |
| Six surfaces answered "which windows" without asking which desktop, so each offered what one hides                                         | every derived view reads the same membership the verb does                                                    | landed |
| `theme.css` promised a cascade position it cannot hold, so importing it after Tailwind beat every utility                                  | the contract documented as it is, plus a test that no rule escapes the layer                                  | landed |
| Group tabs were labelled with the window's UUID, and the label policy could not be replaced                                                | `groupTabLabel`, defaulting to the exported `getInfiniteCanvasGroupTabLabel`                                  | landed |
| Group chrome sizes were a layer prop the reducer ignored, so setting them desynced chrome from panes                                       | `state.groupMetrics`, read by the solver and every derived view alike                                         | landed |
| Group chrome had no tokens of its own: the seam read the border colour, tab ink read the grid colour                                       | `--icx-group-gutter`, `--icx-group-tab-fg`, `--icx-group-surface-radius`/`-shadow`                            | landed |
| A horizontal accordion's headers ran their text across a 28px strip, so every one was a single glyph                                       | the header emits `data-axis`; the theme turns those labels with the strip                                     | landed |
| `window.undock` and `group.dissolve` left freed members inside the shell, tab members exactly stacked                                      | both place through vacancy, bounded by the shell rather than the camera                                       | landed |
| `presence.visible` meant "not minimized", so it held windows behind a tab and windows on another desktop                                   | `visible` means on screen; items carry `isHidden` and `isAdmitted`                                            | landed |
| A group's `title` was modelled, persisted and settable, and drawn nowhere — naming one was write-only                                      | the shell draws a frame label, sized in screen units and configurable by `labelSize`                          | landed |
| `window.undock` counted the shell it was leaving as occupied, so a last member was thrown clear of it                                      | a shell is an obstacle only when it survives being left; `group.dissolve` already agreed                      | landed |
| A consumer placing a corner surface cannot ask where the canvas's own HUD ended up, so it guesses                                          | `--icx-hud-extent-bottom`/`-top`, written on the viewport — the mirror of `viewportInsets`                    | landed |
| A group's frame label had no policy prop, so over a tab strip it repeated the strip's own list of members                                  | `groupLabel`, mirroring `groupTabLabel`, defaulting to `getInfiniteCanvasGroupTitle`                          | landed |
| "Longest unoccluded run" returns the longest unoccluded _segment_, so an elbow puts a connector's label a quarter along instead of halfway | `getInfiniteCanvasUnoccludedRuns` merges the clips; `…LongestUnoccludedRun` picks, and a run is a `WorldPath` | landed |
| `workspace.removeActiveWindow` did nothing to a docked window: it dropped one id and reconciliation put it straight back                   | the removal half expands to the group-complete set, as the move half already did                              | landed |
| The minimap's viewport indicator filled the whole box whenever the camera contained everything drawn                                       | `viewport` is nullable, so a consumer cannot draw the frame that traces the box's own edge                    | landed |
| Published command descriptions understated their own verbs, and a consumer's copies of them drifted                                        | the descriptions say what the verb does; a consumer quotes the descriptor instead of restating it             | landed |
| A consumer's own verbs reach the keyboard and nothing else: `hotkeyActions` never join contextual discovery                                | consumer verbs enter the same list the framework's do — id, label, description, enablement, invoke            | open   |
| A selected scene object carries identity and no geometry, so nothing spatial downstream of selection can act on one                        | a bounds provider keyed by selection target, answered on demand                                               | open   |
| The camera frames a target once and cannot follow a moving one                                                                             | a sustained follow with a release rule, or a camera setter if the release policy is the consumer's            | open   |
| A selected scene object that no longer exists is never pruned, and `selection` is a durable document field                                 | the same consumer-knowledge surface the rows above want — "does this still exist"                             | open   |
| What `createGroup` will accept cannot be asked before dispatching it                                                                       | `getInfiniteCanvasGroupableWindowIds` — the rule it already applies, asked in advance                         | landed |

**On the three landed rows above, because they are one finding.** All three were found by asking
what a caller is actually told, and all three had passed every typecheck and a 700-test suite. The
description row is four instances of one shape: `selection.selectAllVisible` and `view.fitAll` called
a presence-based set "visible" when the predicate never consults the camera; `window.reveal` named
one of the four things it does; `workspace.moveActiveWindow` and `removeActiveWindow` never mentioned
that a docked window takes its whole group; and the seventeen nudge and arrange verbs never mentioned
that they make **opposite** choices about a docked pane — nudge moves the whole shell, align skips it
entirely, and both are deliberate. A caller with one docked window in a four-window selection gets
opposite treatment from two verbs that read as siblings.
The consumer half of that row is its own lesson: Polkadot re-declares five template verbs as app
actions and had restated each description rather than quoting the descriptor, so improving the
framework's sentence left the only sentence a WebMCP caller can see untouched. The framework says as
much where those descriptors are declared — they exist "so the verb has a label and a description in
one place rather than being re-invented by every consumer that builds a switcher."

**On the four open rows, and what would settle each.** They are ordered by how much a consumer has
to build without them.
The discovery row is the largest and has evidence rather than an argument: `app-actions.ts` is
roughly 1400 lines that exist because the framework has no consumer-verb registry, and it reinvents
description, label, live enablement, an argument schema and a refusal string before
`published-commands.ts` and `model-context.tsx` merge the two vocabularies and police name collisions
between them. The framework already diagnosed this exact shape for its own lifecycle verbs and called
it an authority failure. It needs no knowledge of WebMCP — only that one list holds both vocabularies.
The scene-target row is one gap wearing four faces. `InfiniteCanvasSelectionTarget` is
`{data?, id, kind, type}` and the framework already admits `"scene-object"` and `"edge"` into
selection — but `view.fitSelection` reads window bounds, the minimap draws windows and groups, the
offscreen ring points at windows, and directional focus walks windows. Settle it by implementing only
the bounds lookup and checking whether `fitSelection` consumes it with no other change; the other
three already take rects.
The camera row is smaller than it looks: `viewportInsets` already exists and is threaded into
`fitCameraToWorldRect`, and targets are already `point | rect | selection | visibleWindows | window`.
Only continuity is missing, and the deciding question is cancellation rather than tracking — if a
user gesture releasing the follow is the one right answer, it belongs here, because otherwise every
consumer reimplements the same release against the pointer interaction.
The `createGroup` row was the mildest and is now closed. It took three attempts to arrive at the
obvious answer, which is the part worth keeping: first a copy of the framework's internal predicate
— caught by `window-visibility-reads.test.ts`, since a copy of that rule decides visibility from
`mode` alone; then a composition of `getInfiniteCanvasVisibleWindowItems` with a grouped check,
which was built from documented semantics and still had this app deciding what the canvas accepts;
then the rule itself, extracted from `createInfiniteCanvasGroup` and exported. A consumer needing to
predict a framework function's behaviour is the framework's problem to solve, and the two wrong
turns were both consumers solving it locally.

**Four of these open rows are one architectural fact, and it is worth stating once.** The
framework's pure surface takes `state`, and `state` is serializable — it is the durable document.
Consumer knowledge is not: a consumer's verbs, its objects' bounds, and whether one of its objects
still exists all live in props, as closures. Every gap where the framework must _ask the consumer
something_ lands on that boundary, and none of them is a small fix because the answer is the same
missing thing each time — a declared surface through which a consumer answers questions about its
own objects, reachable from the pure functions rather than only from the component.

Measured, so the shape of the ask is grounded rather than imagined:

- **Verbs.** `hotkeyActions` is a prop; `getInfiniteCanvasContextualCommands` takes state. The
  consumer's verbs reach the keyboard and nothing else.
- **Bounds.** `getSelectedWindowBounds(state)` reads window rects, and `view.fitSelection` is
  executed by `executeInfiniteCanvasCommand(state, command, zoomPolicy)` — state-only, all the way
  down. There is nowhere for a consumer's bounds to enter, which is why "implement the bounds lookup
  and see whether `fitSelection` consumes it" resolves to _no_ rather than to a patch.
- **Existence.** `selection` is in `INFINITE_CANVAS_DOCUMENT_FIELDS`, and
  `parseInfiniteCanvasSelectionTargets` restores targets on hydrate.
  `normalizeSelectionTargets` only dedupes, and `reconcileInfiniteCanvasWorkspaces` cleans a stored
  selection's `windowIds` and `anchorWindowId` and never its `targets`. So a selected scene object
  that no longer exists survives every reload — the exact failure reconciliation's own comment says
  it exists to prevent, stated there about windows.
  Driven rather than read, in `selection-target-lifetime.test.ts`: a target naming nothing survives
  `normalizeSelection` and a serialize-and-hydrate round trip, while a dead **window** id sitting in
  the same selection is dropped on the way through. That asymmetry is the finding — the framework
  prunes exactly what it can verify and keeps exactly what it cannot, and a consumer reading only
  the target half would reasonably assume selection is cleaned uniformly. Those assertions pin a
  contract rather than a bug, and want rewriting rather than deleting on the day the surface lands.
  **This app is not exposed to it, and the reason is the mitigation worth copying.** Cutting an edge
  leaves its target in the selection — `disconnectItems` writes, reloads and registers the undo, and
  never touches the canvas, across all six of its callers. It does not need to: every reader of edge
  selection goes through `getSelectedRelations`, which resolves each target by id against the
  relations that currently exist, so a dead one matches nothing and contributes nothing. Derive on
  read, the same discipline `getInfiniteCanvasGroupTitle` chose. The persisted document does
  accumulate dead ids, which is real and cheap and invisible; what would make it expensive is
  trusting `targets` as a list of edges, so `selected-relations-resolve.test.ts` pins the resolving
  rather than the accumulation.
  Recorded because the first reading of this was wrong: it was written up as a live product defect
  for Polkadot to fix, on the strength of the framework behaviour alone, without checking what the
  app does with a target once it has one.
  The audit that followed is short and worth keeping. Polkadot reads edge selection in exactly two
  places and both are safe by different mechanisms — `getSelectedRelations` resolves target ids
  against live relations, and the connector layer asks `isSelectionTargetSelected` about a relation
  it is already drawing, so a dead target is never enumerated. It registers no scene-object
  resolver at all, so that half of the target model does not arise here.
  **The playground was the one exposed, which is worse than the app being exposed.** Its
  `selectedConnectionId` returned the target's id unchecked, so a "Delete link" button appeared for
  a link that is not on the board: switching workspaces swaps the connections without clearing the
  selection, and the id survived into a board that never had it. Fixed there by resolving, because
  a showcase is where a consumer learns the pattern, and it was teaching the unresolved one.

Storing the answers in state instead is the tempting shortcut and is wrong by this file's own
standards: a rect copied onto a selection target is stale the moment the object moves, and
`getInfiniteCanvasGroupTitle` already chose `null`-and-derive over a snapshot for exactly that
reason. The answer is a lookup the framework can call, not a value it can hold.

**On the discovery row, and why it is not a slice.** `InfiniteCanvasContextualCommand` is a
`CommandDescriptor` plus `enabled` and `group`, and a descriptor is keyed on a `command` from the
framework's own union — `group` is _derived_ from that command by
`getInfiniteCanvasCommandGroup`. A consumer verb has a `run` closure and no command, so it cannot be
one of these without either widening the union to carry a consumer variant or introducing a second
entry type the list is a union of. Both are real design decisions with surface area, and the pacing
rule at the top of this file applies: a half-built merged vocabulary reads as finished, so the next
consumer builds on it. `InfiniteCanvasHotkeyAction` already carries everything else needed — `id`,
`label`, `description`, `isEnabled`, `run` — which is what makes the gap worth naming precisely
rather than starting badly.

**Two wording nits found in the same sweep and deliberately not made rows,** because neither names a
missing affordance. `group.growPane` and `group.shrinkPane` say a pane takes from "the pane beside
it" without saying which side; `resolveInfiniteCanvasPaneSeam` is precise — the sibling _after_ it,
except the last pane, which takes from the one before. And the HUD's own button still reads "Fit all
visible windows", the same overloaded word the two command descriptions were corrected for; it stays
because a person clicking it watches the camera move and learns immediately, where a caller reading
a description cannot.

**On that row, which is the minimap row again in a different function.**
`getInfiniteCanvasLongestUnoccludedSegment` says "the longest **run** of a path that nothing
covers", and `getInfiniteCanvasUnoccludedSegments` above it says "the longest **run** returned here
is the right one". Both mean a contiguous visible stretch. The implementation reduces over segments
and never merges adjacent ones, so a path with an elbow — which every rect-to-rect connector has —
is three segments where nothing occludes any of them, and the "longest" is one leg.
Measured by drawing it: two notes stacked with a 34px gap, connector running y296–330, label centred
at y321.5 rather than 313 — two pixels off the lower window with nineteen of clearance above. Off by
a quarter of the run, and worst in exactly the case the anchor exists for, a short stretch between
windows that nearly touch.
**Closed the same way it was found.** Two adjacent notes at 90% zoom, a 5.38px visible gap and a
two-segment path across it: the label draws at x915.40 against a halfway-along-the-run of x915.40 —
delta zero — where the midpoint of the longest segment is x914.2, still a quarter along and still on
the wrong side of centre, now on a stretch small enough that a pixel is most of it.
Two things the live pass established that the unit tests could not, and one it could not establish.
A whole orthogonal path is a symmetric Z, so halfway-along-the-run and midpoint-of-longest-segment
agree exactly on an unoccluded elbow — measured identical at (785.12, 434.63). And a connector whose
every point is behind a window draws neither mark nor label, which is the documented behaviour and
reads as a missing label until you check what is covering it. What the live pass did **not** reach is
a partially-occluded elbow, where a clipped run has none of the whole path's symmetry; that case is
covered by `unoccluded-runs.test.ts` and has not been seen drawn.
The fix is a merge pass plus a midpoint taken along path length rather than straight-line, which is
why it could not be the same return type: a run of three segments is not a segment, and a synthetic
straight segment across it puts the point in the empty corner of an L. So it wanted new exports, and
a run turned out to be an `InfiniteCanvasWorldPath` already — a polyline with a length and bounds —
so the anchor is `getInfiniteCanvasWorldPathPointAtProgress(run, 0.5)` and no new arithmetic came
with it.

**On the blocker this row claimed, which was not real.** It said a new export was blocked because
`docs/API.md` "is carrying somebody's uncommitted work". It was not. Every staged file in that state
was this workstream's own, and every staged hunk was a formatter round-trip — `_emphasis_` against
`*emphasis*`, table columns re-padded, and one blank line. The `docs/API.md` change was a single
emphasis marker on one line. The belief was inherited across a context boundary and repeated for a
whole session without once being checked, which is how a scoping excuse survives: nobody re-reads the
reason, because the reason sounds like diligence.

**On the label row, because it is the tab-label row again and nobody noticed for the weeks between.**
`groupTabLabel` landed when tabs were found labelled with a UUID, and the fix was the right shape: a
policy prop with an exported default. The frame label shipped later with `labelSize` and no policy
at all — so the same class of gap existed in the same feature, one control over, and the table above
already described it in a row somebody had written by hand. What found it was looking at a tabbed
group, seeing "Untitled 1 & Untitled 2" sitting directly above tabs reading "Untitled 1" and
"Untitled 2", and asking which of the two a consumer could change. The answer was the tabs.
The general shape is worth stating: **when a value gets a policy prop, every other place that value
is rendered needs one too, or the next surface inherits the framework's opinion silently.**

**On the group rows, because nobody had ever made a group.** The framework's
largest feature shipped complete — gesture, keyboard path, persistence, rendering — and no
consumer had exercised it, so every defect above survived typechecks and a 600-test suite. The
first dock this app ever performed put UUIDs on both tabs. What the run found is not three bugs
but the shape of an unexercised surface: **the defaults are coherent only with each other.** Every
one of these is a value that is correct while a consumer accepts the whole default look and wrong
the moment it diverges — a tab named by an id nobody displays, chrome sized by a prop the reducer
never saw, a seam coloured by the border token you just turned off, tab ink coloured by a grid you
replaced. An unexercised feature is not untested; it is tested only against itself.

**On the group title row, because its failure mode is not any of the above.** That value was
modelled, persisted through the document, defaulted by an exported constant, settable by a command
the palette already called, and announced to assistive technology through the shell's `aria-label`.
Every layer a feature normally needs was present and correct. It was drawn nowhere — the only other
site was `getInfiniteCanvasGroupTabLabel`'s fallback for a tab whose child is a nested split, which
is not the group. Measured before it was believed: a two-member split named "Reading list" rendered
that string zero times. Nothing in a typecheck, a test suite, or an accessibility audit could have
said so, because by every one of those measures the feature was complete. **A value can be modelled,
persisted, commanded and announced, and still never reach a pixel** — and the naming feature that
had shipped a few commits earlier was therefore write-only from the day it landed. The only
instrument that finds this class is going and looking at the thing.

**On that row, which stood here as the list's first unbuilt entry for about an hour.**
`viewportInsets` and `viewportOccluders` both flow consumer → canvas: here is what my chrome covers,
aim around it. Nothing flows the other way, so a consumer wanting the bottom-right corner — where
the canvas puts its own navigation and zoom rails — has to guess where those rails end. Polkadot
guessed 64px against an actual 114, and the map spent an unknown number of weeks with 37% of itself
under a rail that swallowed its clicks.
Four attempts to measure the rail from the DOM instead are recorded in `hud-clearance.ts`, and they
are the argument for the affordance: the consumer is trying to observe, from outside, a layout the
canvas performs — mounting after it, moving when insets apply, and doing neither in a way the
platform reports. The canvas knows the answer at the moment it renders, so it says so now:
`InfiniteCanvasHud` writes `--icx-hud-extent-bottom` and `-top` on the viewport in the same frame it
lays itself out in, and `bottom: calc(var(--icx-hud-extent-bottom, 16px) + 8px)` is the whole
consumer story. Measured against a change rather than once: with Polkadot's bottom inset at 56 the
property reads 114px and the band's top edge measures 114; moved to 96 it reads 154 and the band
measures 154 — derived from the layout rather than restated from it.
The top extent is witnessed too, and it took turning something on to see it: Polkadot runs with
`statusCard: false`, so that property publishes `0px` here and the non-zero path was reasoning
rather than evidence. Enabling the card temporarily, `--icx-hud-extent-top` read 123px against a
status card whose bottom edge measured 123 from the viewport's top. Reverted; the app still ships
without the card.

**Not a row, because it is a boundary rather than a gap — and it was found as a false claim.**
`reconcileInfiniteCanvasGroups` said by name and date that it heals a canvas saved holding a decayed
shell, citing this app's own layout on 2026-08-27. It does not. Decay is "more than one member
before, one after", `before` is the tree the pass receives, and a tree saved already collapsed to one
loses nothing during the pass — so the rule cannot fire. The existing hydration test constructs the
other shape, a tree still naming a window that has been deleted, and passes. This canvas still holds
the shell across a full reload: one member, 544×720, named "Untitled 6 & Connected to Untitled 6"
after Untitled 6 had gone.
It cannot be repaired by dissolving every single-member group, which is the obvious fix and the
wrong one: `undock` produces that shape deliberately under DOCK-006 and `serializeInfiniteCanvasState`
writes it — measured as `{"tree":{"id":"east","kind":"window","weight":1}}`, the same bytes a decayed
shell writes. The document carries nothing to tell the two apart, so dissolving on sight would delete
part of an arrangement someone made. What changed is the comment and the tests, which now say what
the code guarantees; relaxing the predicate fails exactly one test in the package, and before this it
failed none.

**On the row above them, because the count is the finding.** One omission repeated six
times: `window.reveal` panned to a rect nothing renders, the offscreen ring aimed arrows at hidden
windows, the minimap drew them _and_ let them set its scale, the dock offered to restore them,
"Fit all visible" was enabled by them, and `activeWindowId` kept naming one after it was filed
away — so close, minimize, dock and place all acted on a window nobody could see.

Five were found by sweeping for `mode !== "minimized"` and asking what else that filter should
have said. The sixth was invisible to that sweep and is the one worth remembering: it is not an
enumeration at all, it is `activeWindowId` itself, which the membership _writers_ never touched.
A sweep finds the shape you searched for.

The rule underneath is worth more than the six fixes: **a derived view must ask the same question
the verb asks.** The fit-all button is the clean instance — it now calls `getSelectableWindowIds`,
the set `view.fitAll` unions, instead of a filter that agreed with it by coincidence until it did
not. The minimap is the nastiest, because a hidden window setting the scale reads as "the map is
wrong" rather than "the map is honest about the wrong set".

Driven, on a canvas with four windows and a desktop admitting two: the minimap drew two on the
desktop and three showing all; the dock was empty on the desktop and listed the minimized window
showing all; the ring pointed only at admitted windows; and on an empty desktop "Fit all visible"
and "Center active window" were both disabled where they would previously have been live and done
nothing.

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
