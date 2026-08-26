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
  currently met** — the field is built and deliberately unmounted for cost, so the running app has
  wallpaper. Stated here rather than only in the item below, because a bar that quietly stops
  applying is worse than one that was never written down.
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
      **Currently unmounted.** `workspace-canvas.tsx` passes no `renderBackdrop`, so what the
      running app shows is the framework's default grid. It was disabled deliberately — it cost too
      much frame time — and it stays that way until that is fixed rather than hidden. The code is
      intact in `canvas/field.tsx`; nothing has been lost. But anyone reading this file and then
      opening the app would otherwise conclude the field was broken.

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
      **Still open:** the palette cannot rename or delete — those have inline editors and typed
      confirmations that a list row cannot host — and it has no recent-items memory, so the empty
      state is ordered by group rather than by what you actually reach for.
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
  **Still open:** the rail cannot create, rename, or delete; there is no saved-views concept
  yet; and connections cannot be authored or cut from here.
- [~] **Connectors.** `relates_to` is written for the first time, and edges render between the
  windows showing their notes — framework geometry throughout, drawn in the new
  `renderUnderlay` band so a connector passes beneath the note rather than across it.
  Authoring is "connect the two selected windows" from the palette, which costs no new gesture.
  **Still open:** drag-to-connect, which is a gesture sprint; edge selection, labels, and typed
  kinds, since every edge is currently `relates`; and no way to see an edge whose notes are not
  both open, which is where the library rail would earn its place.
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
  **Still open:** desktops cannot be renamed or reordered; nothing shows which desktop a window is
  on while you are looking at another one; and the only way to fill a desktop is one window at a
  time, so "put these three on a new desktop" is three trips through the launcher.
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

Raw WebGL2, no dependency — a fullscreen triangle and one program need no scene graph. All tuning
is one `FieldConfig`: the reference's five near-duplicate hover radii and three influence radii
were each fixed ratios of a single real number, so one knob moves each family together.

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
      **Found while consuming it:** two separate windows at the same bearing stack on nearly the
      same pixel. Groups are already folded for that reason, distinct windows are not — recorded on
      the framework function rather than worked around here.
      **Still open:** the chips are peripheral by design and deliberately quiet, tuned by one look
      rather than by watching anyone use them.

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
