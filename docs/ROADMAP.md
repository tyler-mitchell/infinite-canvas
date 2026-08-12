# Roadmap: Large Work Programs

> Adopted 2026-06-10, after the headless extraction landed and the first
> performance tranche shipped. Each entry is a deliberately LARGE program —
> multi-session, with its own spec base, exit criteria, and dependencies —
> so there is always predefined high-value work to pick from. Precedence
> rules from [README.md](README.md) apply; specs referenced here win over
> this summary.

## Current execution slate (adopted 2026-08-12)

> A **view over the programs below**, not a new program list. P1–P8 own the
> capability definitions; this section says what gets worked next and in what
> order. When a track lands, its program entry above is what gets updated.

The framework is capability-rich and **verb-poor**: the group model, undo,
recipes, portals, persistence, and navigation geometry all exist, but the
window-manager vocabulary a user reaches for — arrange these, find that one,
make it legible when I zoom out, restyle it — is thin or missing. The slate
attacks that, and carries its tests with it rather than after it.

Four findings ground the ordering, each verified against the code on
2026-08-12 rather than taken from a doc:

- **Theming is 11/59 public.** `theme.css` defines 59 `--icx-*` tokens; the
  public `theme` prop bridges **11** of them ([infinite-canvas.tsx]'s
  `INFINITE_CANVAS_THEME_VARIABLES`). The other 48 are reachable only by
  overriding CSS. There is **no** light-theme scaffold — zero
  `prefers-color-scheme` or `[data-theme]` rules in `theme.css`.
- **Semantic LOD is unbuilt, and the seam is clean.**
  `InfiniteCanvasWindowDefinition` has no `renderSummary`/`renderIcon`; far
  zoom has no representation lane at all.
- **The action vocabulary has no arrange family.** 48 action types, none for
  align, distribute, tidy, swap, or equalize.
- **The group core is still untested.** 165 tests across 22 files; none touch
  groups, history, or recipes. [research/c2-test-plan.md](research/c2-test-plan.md)
  already specifies the suite to the assertion.

### T1 — Window-manager verbs: align, distribute, tidy, swap, equalize (~1.5h)

**Feature.** The highest capability-per-hour item on the board, and pure
geometry — a new `window-arrange.ts` beside `window-placement.ts`, plus
`group.equalizeChildren` for the tree.

**Guard R5 deliberately.** These are explicit one-shot commands over an
explicit selection, never a persistent global layout mode. A canvas that
silently re-tiles is the tiling-semantics failure R5 has flagged as _live,
standing_ since the beginning. Grouped windows translate their **shell**, per
the `window.nudge` precedent — a member has no rect of its own.

Exit: align/distribute/tidy act on a multi-window selection, are one undo
entry each, refuse to shrink anything below `minSize`, and assert in tests.

### T2 — Window switcher (~1h)

**Feature.** The command palette is mounted on every canvas route and reads
`getInfiniteCanvasContextualCommands`, which enumerates _canvas_ commands and
no windows. So there is no way to answer "where is my Notes window" by name.
The minimap and offscreen indicators solve orientation geometrically; this
solves it lexically, and completes that trio.

Exit: the palette lists open windows by title, filters them, and
Enter focuses + navigates the camera to the chosen one.

### T3 — Light theme and token completeness (~2h) — **half landed**

**Feature, and the most visible gap.** P3's own framing is right: a light
theme is the _proof_ of token completeness, because every hardcoded color
fights it.

✅ **The semantic layer landed (`fcdd628`).** The 48 unbridged tokens were not
48 decisions — most were one white or one cyan at varying alpha, and that cyan
was `--icx-active-accent` written out by hand. They now derive from six knobs,
value-preserving to the bit.

**What remains is the proof, and the audit already named what will fight it:**
six tokens do _not_ derive and are marked `NOT DERIVED (n/6)` in `theme.css` —
the host chrome's near-accent tint family, its own near-black fill, and the
active HUD button's foreground. They encode "light tint over a dark surface"
in their values rather than in a token. Give each a semantic home, then write
the light theme **in consumer CSS** (the playground), because a theme the
framework ships is not evidence that a consumer's would work — and because
`theme-tokens.test.ts` reads tokens into a `Map` over the whole file, so a
light block inside `theme.css` would silently become the value it asserts
against.

Exit: a playground theme switcher toggles two complete looks; no framework
surface renders an unthemed color in either.

### T4 — Semantic LOD: readable cards at far zoom (~2h)

**Feature, and distinctive.** At 12–25% zoom every window is illegible, and no
snapshot fixes that — a rasterized paragraph is still a paragraph. Add
`renderSummary`/`renderIcon` to the window definition and a threshold on
**effective screen size** (not raw zoom, so a large window stays legible
longer than a small one). This is P7's semantic half and is independent of the
capture lane, which needs Chrome's OT flag.

Exit: a `/stress`-scale document at 15% zoom where every window is
identifiable; the lane is off unless a kind declares a summary.

### T5 — Retire the C2 test debt (~2h)

**Plumbing, highest structural value.** DOCK/SPLIT/TAB/ACC/PERSIST/FAIL
against the reducer, from the existing plan. Not first, because only T1 of the
feature tracks touches the untested core — but not last either, because it is
what makes the group tree safe to keep changing.

Exit: those scenario ids assert and pass; `grep` for `createGroup`,
`dockWindow`, `undoInfiniteCanvas`, `captureInfiniteCanvasRecipe` in
`src/*.test.*` returns hits.

### Tail — **both landed 2026-08-12, ahead of the slate**

Pulled forward because the owner's direction turned to building a real
application on the framework, and these two are what any real application
leans on first. Neither is verified in a browser.

- ✅ **T6 — Focus trapping** (`8793f04`). FR-9's last structural piece. `Tab`
  enters the active window's content and only its content; it cycles and wraps
  inside; `Escape` returns to the command surface. `Shift+Tab` is deliberately
  not claimed — swallowing it would make the canvas a keyboard trap for the
  whole document.
- ✅ **T7 — A non-trivial app in a window** (`19cac41`). P6's exit criterion, as
  `/body-content`. Building it found _why_ the criterion had sat unmet: every
  other showcase puts **inert** content in its windows, and none of the
  contract's failure modes are about painting. They are about input ownership,
  which a div that wants no input cannot test. One widget per contested input:
  a form (caret, tab order), a scrolling list (wheel), selectable prose
  (pointer).

### Deliberately deferred, with reasons

- **Columns mode** — breaks `group-tree`'s "only weight ratios matter"
  invariant (a column's extent is absolute) and needs shell-local scrolling to
  be usable at all. Shipping the layout without the scroll gives a shell whose
  columns are unreachable. R11 is right that it stays last.
- **Workspaces / nested canvases** — genuinely valuable and genuinely large;
  it wants its own session and a persistence-envelope decision, not a corner
  of this one.
- **P2 measurement** — the harness exists and works; the embedded preview
  throttles `rAF` under load, so the number needs real hardware. Demonstrated,
  not assumed.
- **Texture-mode capture** — needs Chrome 148+ with the OT flag.
- **npm publish, git history purge** — owner actions. Irreversible or external.

### The other axis: the critical path to production

The slate above is **feature work**, because that is what was asked for. Shipping
is a _different axis_, and conflating the two is how a project ends up feeling
busy while the release stays where it was. Stated separately so the mix is a
choice rather than an accident.

Three gates, and they are independent — none blocks another:

| Gate                    | State          | What stands in the way                                              |
| ----------------------- | -------------- | ------------------------------------------------------------------- |
| **Publishable to npm**  | ✅ ready now   | Nothing technical. `pnpm publish`. Owner action (external service). |
| **Public repository**   | ⛔ owner-gated | One `git filter-repo` purge. Irreversible, no remote.               |
| **Honest "production"** | 🟡 two levers  | Below. Nothing here is unknown; two things are un-permitted.        |

**Status of the four production items, 2026-08-12.** Three of them moved today,
which is why this section is worth re-reading rather than trusting:

| Item                                | State                                                       |
| ----------------------------------- | ----------------------------------------------------------- |
| **C5** — FR-9 focus containment     | **Built** (`8793f04`). Code complete, browser-unverified.   |
| **P6** — non-trivial app content    | **Built** (`19cac41`). `/body-content` exists to be tried.  |
| **P3** — themeable surface          | **Built** (`fcdd628`). 48 tokens → 6 knobs, unverified.     |
| **C2** — group/history/recipe tests | **Not started.** Specified to the assertion; not permitted. |
| **C4** — P2 measurement             | **Not startable here.** Needs real hardware.                |

**So the distance to an honest "production-usable" is not a list of unknowns.
It is two levers, both the owner's:**

1. **Browser verification.** Three of the four items above are written and
   unwatched. Verifying all three is one dev-server session and well under an
   hour: Tab into `/body-content`'s form and confirm it cycles and stops,
   `Escape` back, wheel over the list, drag across the prose, then eyeball the
   theme refactor for a colour that moved. This is currently un-run only because
   background processes were asked to stay off ahead of a restart.
2. **Whether unit tests are in scope.** C2 is the largest remaining gap and the
   only item that is neither built nor blocked on hardware. Its plan is written
   to the assertion in [research/c2-test-plan.md](research/c2-test-plan.md), so
   it is roughly two mechanical hours — but writing it contradicts a standing
   instruction from earlier in this session, so it is not an agent's call to
   make.

**With both levers pulled, production-usable at NFR-1's stated bar is about three
hours of work, none of it speculative.** NFR-1 asks for ten windows without
degradation, which the framework already clears with headroom. P2's separate bar
— 100 windows at 60 fps — needs item C4 and real hardware, and a `0.2.0` that
documents its own limits does not need it.

**Nothing on the feature slate is a production blocker, and nothing on this path
is a feature.** They are genuinely parallel tracks, and the only item that sits
on both is C2 — simultaneously the largest production gap and the thing that
makes the group tree safe to keep adding features to.

## P1 — Grouping & Docking (the window-manager tranche)

The single biggest capability leap and the framework's identity claim:
windows compose into movable local layout regions.

- ✅ **Landed (2026-07-08): the canonical layer.** Group shells are first-class
  world objects in `InfiniteCanvasState.groups`; `group-tree.ts` is the n-ary
  container tree with weights and normalization; `group-layout.ts` solves it;
  `group-state.ts` projects the solution onto member `window.rect`s so the rest
  of the framework stays group-blind. Nine reducer actions and a command facade
  (create, close, dock, undock, setRect, setLayoutMode, setActiveChild,
  setChildWeights, reorderChild). Persisted at `version: 2`, with `version: 1`
  migrating to `groups: []`. Rendered by `group-layer.tsx` (shell, gutters, tab
  strips, accordion headers) beneath the window plane. `/groups` showcase.
- ✅ **Landed: the pointer gestures.** Dragging a grouped window's header
  moves its shell as one world object (DOCK-003). Dragging the seam between split
  panes reweights the pair (SPLIT-001) — the step recomputes from the container as
  it stood at drag start, so the seam stays under the cursor rather than drifting.
  Dragging a tab out of its strip tears the window out and hands the same
  pointer to a normal window move (DOCK-004); dragging it along the strip reorders
  it (TAB-001). **Alt+dragging** a floating window
  over another window, or over a group member, docks it (DOCK-001/002).
- ✅ **Docking-intent mode**, which risk R3 asked for. Docking is never something
  a drag falls into: without the modifier a window overlaps as it always did.
  While intent is held, a dock region overlay shows exactly where the window will
  land, and alignment guides are suppressed — a snap guide and a drop target are
  contradictory affordances. The overlay renders the same value the reducer
  applies on release, not a fresh hit-test, so what is promised is what happens.
- ✅ **Landed (2026-07-08): the shell resizes by its outer edge.** A `groupResize`
  interaction beside `groupMove`/`groupGutter` steps `group.rect`; the tree is untouched and
  members re-project. Resizing a grouped window _directly_ stays refused — a pane is resized
  by its seam, the shell by its edge — and the frame no longer draws handles it would refuse,
  which is what had been burying the gutter between two panes and eating the seam drag at low
  zoom.

  Two things the build corrected about its own plan. The shell's minimum is **structural**
  (gutters, strips, headers, `MINIMUM_GROUP_PANE_EXTENT` per pane), _not_ a function of every
  pane's `minSize`: the solver has never consulted `minSize`, because inside a tree a member
  has no rect of its own. And the shell's handles sit **entirely outside** its rect rather than
  straddling the edge — everything inside is member-window DOM drawn above the group layer, so
  an inward half is unreachable by construction.

- ✅ **Landed (2026-07-08): tab reorder by drag.** Where the pointer goes decides what the
  drag is — inside the strip it reorders, leaving it tears out. Previously any 6px of travel
  tore the tab out, which made `group.reorderChild` unreachable by pointer however carefully
  you slid a tab sideways.

  **P1 is capability-complete.** Every gesture in the spec lands: dock, shell move, shell
  resize, seam reweight, tab tear-out, tab reorder. What remains is verification — the DOCK,
  SPLIT, TAB, and ACC scenarios are `built` and entirely unasserted, and no test in the suite
  touches groups at all.

- Tabs + accordion modes (center-merge, reorder, mode conversion,
  active-child semantics).
- **Docking-intent snapping**: explicit intent mode with region overlays
  that suppresses alignment guides (risk R3's mitigation), per
  [research/snapping.md](research/snapping.md).
- Reducer-level: new canonical mutations (create group, insert child,
  reorder, change layout mode, tear out, remove empty group) — drag and
  keyboard compile to the same language.
- Spec base: [research/grouping-and-docking.md](research/grouping-and-docking.md),
  [research/state-focus-and-recipes.md](research/state-focus-and-recipes.md);
  acceptance: DOCK-001..005, SPLIT-001..003, TAB-001/002, ACC-001 in
  [research/acceptance-scenarios.md](research/acceptance-scenarios.md).
- Exit: a /groups showcase where floating windows dock into split shells,
  merge into tabs, tear out, move as units; scenario tests green.
  **Met, except the scenario tests.** Floating windows dock into split shells,
  merge into tabs, tear out, and move as units — all by dragging.
- Dependencies: none hard; benefits from P2's chrome memoization landing
  first (group shells add chrome).

## P2 — Performance: 60fps at 100+ windows

Started (body memoization landed; 20→97fps pan). Finish the cost model in
[research/performance-profile.md](research/performance-profile.md).

**`NFR-1` is not this program's bar, and passing it does not make P2 done.** NFR-1
asks for ten windows without obvious degradation, and has cleared that with headroom
since `962e42c` on 2026-06-10 — a fact four documents went on denying for a month
until 2026-07-08. P2's bar is **100 windows at 60fps**, and 80 windows currently pan
at 21.3 fps. Both statements are true at once; conflating them is how the project
spent a month believing its performance requirement was failing.

- ~~Tranche 1: memoize frame inner chrome~~ — **landed, unmeasured.** The
  frame no longer takes `state`; chrome, body, and resize handles are
  memoized on window identity, and handle geometry moved to a CSS custom
  property so zoom stops rebuilding them. Numbers pending a real-hardware
  run.
- **Tranche 2: window-layer visibility culling.** _Corrected 2026-07-08 — the
  earlier note here said "subsystem exists, layer ignores it". That was wrong,
  and acting on it would have been a mistake._ The subsystem that exists
  (`visibility.tsx`) is fed **only** by the R3F frustum probe, which ships behind
  the optional `/scene` entry and runs only under `diagnostics.frustum`. Culling
  on `useInfiniteCanvasWindowFramed` would therefore cull nothing for any consumer
  without `three` installed (it returns its `true` fallback), and would re-couple
  rendering to the optional 3D peer that the `/scene` seam exists to keep out. It
  is a diagnostics store, not a culling source.

  The culling predicate is `isWorldRectWithinViewport(camera, viewport, rect,
marginPx)` in `geometry.ts` — pure, synchronous, camera-derived, no peer. Note
  its unmeasured-viewport trap: a `0 × 0` viewport overlaps nothing, so a culler
  must check `isUsableViewport` first or paint an empty canvas on first frame.

  **Culling must not unmount.** The window layer maps `visibleWindows` straight to
  frames, so dropping an offscreen window from that array unmounts its subtree:
  DOM focus on the active window falls to `<body>` and silently kills every hotkey
  (the failure the Close/Minimize controls already work around), `portalRoot`
  roots tear down, and body scroll position, video playback, and uncontrolled
  input state are destroyed on pan-away and come back blank. Skipping the frame's
  _transform update_ while offscreen is safe — a stale transform on something
  nobody can see is unobservable, and it re-renders on re-entry. Unmounting is
  not. Profile before prescribing which.

- **html-in-canvas tier**: texture-mode-during-camera-motion prototype
  (capture → WebGPU quads during pan/zoom, live DOM on settle), then the
  measured decision on the canvas-subtree body plane
  ([research/html-in-canvas.md](research/html-in-canvas.md)). Needs Chrome
  148+ with the OT flag — owner's browser or token.
- Productize the measurement harness: scripted benchmark runs (the
  synthetic wheel/drag drivers) with thresholds, runnable via vp, so perf
  regressions fail loudly. This is the same work as SHIP_PLAN's C4, and it is
  the prerequisite for every number below it. Nothing may quote a figure for
  tranche 1 until it runs.
- **Raster defaults tuning at scale.** _Rescoped 2026-07-08._ The knob was not
  merely untuned, it was **broken**: `maxPendingCaptures` at any finite value
  left every window the queue refused permanently un-rasterized, because the
  body recorded a capture it had never made. Fixed — a refused request is no
  longer recorded, and a waiting body re-arms when the queue drains. The
  **defaults** are still unbounded (`maxPendingCaptures` and `viewportMarginPx`
  both `Infinity`), deliberately: picking a bound without profiling would be a
  guess wearing a measurement's clothes. Tune them with the harness above, not
  before it.
- Exit: 100 windows at 60fps pan/zoom/drag on real hardware; benchmark
  suite guarding the numbers; texture-mode go/no-go decided with data.
  **Tranche 1 is landed and unmeasured**, so P2 cannot be assessed at all until
  the harness exists — that is the first thing to build, not the last.

## P3 — Styled Distribution & the Design Language

The product's face; the owner's stated aesthetic ambition (dynamic-grid
lineage, "build something better").

- tailwind-variants component layer over the `data-slot` contract (the
  Phase-3 vocabulary IS the slots map) — themes as real distributions, not
  just token overrides.
- Rebuild the dynamic-grid backdrop as a first-class framework scene-layer
  module (40px lattice, pointer-local luminance, node influence fields —
  mined from the motion study, improved); shader marquee sheen and the
  premium interaction polish deferred from SELECTION_AND_KEYBOARD_PLAN.
- Design-token system maturation (light theme as proof of token
  completeness), theming documentation, at least two complete looks
  (the current dark default + one deliberately different).
- Exit: `@infinite-canvas`-scoped theme package(s) or subpaths a consumer
  can swap wholesale; playground theme switcher demonstrating both.
- Dependencies: none; pure addition over the headless contract.

## P4 — Undo/Redo, Transactions & Layout Recipes (FR-10 completion)

Professional-tool table stakes; the command layer is transaction-ready.

- ✅ **Landed (2026-07-08): undo/redo over the document.** `history.ts` keeps a
  past/future stack of `{ groups, windows }` — the undoable half of the canvas.
  Panning is not an edit, and undo never scrolls the view out from under someone
  who just wanted their window back. `Mod+Z` / `Mod+Shift+Z`, gated by
  `canUndoInfiniteCanvas` / `canRedoInfiniteCanvas`, compiled from the same command
  vocabulary as everything else — which is exactly why history had to live in
  `InfiniteCanvasState` rather than beside it in the store.
  **Transactions coalesce by construction:** `interaction.step` never records; the
  checkpoint is taken when a mutating drag _begins_, so a hundred-frame drag is one
  entry and a cancelled drag still has somewhere to return to. Size policy: 100
  entries, oldest dropped. Hydrate and reset discard the stack. History is
  session-scoped and never serialized — a layout is a document, not its edit log.
- **Still open: putting history in the versioned envelope** — and it is a real
  question, not an oversight. History is session-scoped and deliberately never
  serialized, so "put it in the envelope" means deciding that a layout's edit log
  is part of the document. The current answer is no.
- ✅ **Landed (2026-07-08): layout recipes.** `recipes.ts` captures a named
  arrangement — the selection, or a named set, or the whole canvas — stored with
  its origin at `(0, 0)` and a `size`, so it drops into any region of an unbounded
  world. Groups come along only when _every_ member does: half a group is not a
  group, and its tree would name windows the recipe never took. Applying it
  rearranges the windows that exist and skips the ones the canvas has lost;
  `reconcileInfiniteCanvasGroups` runs on the way back in, so a recipe saved before
  a window was closed never restores a shell laying out a ghost. Recipes are values
  the consumer owns and persists; `parseInfiniteCanvasRecipe` treats one crossing
  storage as untrusted input, like canvas state. Applying a recipe is one undo
  entry, for free, because it is one document mutation.
  **Recipes translate; they do not scale.** Fitting an arrangement into a smaller
  region would shrink windows below their own `minSize` — a recipe that quietly
  violates a constraint the rest of the framework enforces is worse than one that
  does not fit. Placed into a `rect`, an arrangement is centred at natural size.
- **Still open: per-window history** (last floating rect, last dock path), and
  recipes/history in the versioned envelope.
- Persistence v2: recipes + history in the versioned serialization;
  PERSIST-001..003 scenarios as tests.
- Exit: ctrl-Z/shift-ctrl-Z across all mutations; recipe save/apply in a
  showcase; tear-out→move→re-dock→undo×3 is transactionally coherent.
  **Met, except transactional coherence across a tear-out→move→re-dock chain,
  which needs the scenario tests to demonstrate.** Undo/redo spans every window and
  group mutation, each drag is one transaction, and recipe save/apply is in the
  `/groups` showcase.
- Dependencies: recipes want P1's group model; window-only undo/redo can
  land first.

## P5 — Keyboard, Focus & Accessibility (FR-9 + FR-8 completion)

- ✅ **Landed: directional window focus** (`Alt+Arrow`), group-local first with a
  global geometric fallback, plus focus restoration on close/minimize. FOCUS-001
  is done.
- ✅ **Landed (2026-07-08): the contextual-parent rule** (FOCUS-002). A floating
  window whose centre lies inside a group's rect takes that group as its
  contextual parent, so it needs no keyboard model of its own. Smallest containing
  group wins; ties break on id. This closes risk R9.
- ✅ **Landed (2026-07-08): named placements** (FOCUS-003).
  `Mod+Shift+Arrow` for halves, `Mod+Shift+Enter` to fill; quarters and centre are
  commands without a default chord, because the canvas `preventDefault()`s every
  chord it owns and the obvious candidates are browser devtools or tab-switching
  keys. `window-placement.ts` is the one thing that knows what "left half" means.
  **Placement deliberately does not snap** — a left half nudged to align with its
  neighbour is not a left half.
- ✅ **Landed (2026-07-08): roving tab stops** in group tab strips and accordions,
  the accordion's arrows following `container.axis` (ACC-001).
- ✅ **Landed (2026-07-08): resize by keyboard.** `Alt+Shift+Arrow` grows or shrinks the
  active window's east and south edges, leaving its origin where it is. Ten screen pixels,
  converted through the camera as a nudge is, so the step stays ten screen pixels at any
  zoom. It reuses `resizeRectFromHandle` rather than redefining what a resize means, and
  refuses a grouped window for the same reason `interaction.startResize` does. A grouped
  window's nudge translates its shell, since a member has no rect of its own.

  The chord vocabulary now reads: bare arrow moves a little, `Shift` moves a lot, `Alt`
  moves _focus_, `Alt+Shift` changes the shape, `Mod+Shift` tiles.

- **Still open: focus trapping**, and a documented path for DOM focus to enter and
  leave a window's own content. This is the last structural piece of FR-9, and the
  one item here that genuinely wants a browser: focus behaviour is not something to
  land unverified.
- IME and text-selection hardening; screen-reader pass. `role="tab"` still carries
  no `aria-controls`, because a window frame has no DOM `id` to point at.
- Exit: full keyboard-only session (open, focus, move, resize, arrange,
  close) is practical; a11y audit checklist in the repo passes. **Focus trapping is what
  stands between here and that** — every other verb in that list now has a chord.
- Dependencies: group-local focus needed P1, which has landed. Everything left is
  window-level and independent.

## P6 — Body Content Platform (the app-inside-a-window contract)

Unblocks real applications living in window bodies — currently the
sharpest near-term trap
([research/body-content-contract.md](research/body-content-contract.md)).

- ✅ **Landed (2026-07-08): portal roots.** `portal.tsx` gives two roots outside
  every transform: a desktop-level one on the viewport, and a window-local one
  positioned to a window's _screen_ rect and moved as the camera does.
  `<InfiniteCanvasPortal scope="window">` mounts into it, so a popover anchored to a
  button inside a body appears beside that button at natural size instead of being
  scaled by zoom and positioned against the frame. The window root is **opt-in per
  window kind** (`portalRoot: true`): mounting one for every window would cost a
  style write per window per camera tick, which is exactly what the frame's
  memoization exists to avoid. `/portals` shows the trap and the fix side by side.
- ✅ **Landed (2026-07-08): input ownership.** Wheel `deltaMode` normalization
  (line mode was calibrated at 16px, so a Firefox notch travelled half as far as a
  Chrome one — now 40), modifier-zoom-over-bodies decided in favour of zoom, and
  pinch documented as the Ctrl+wheel path it has always been. See
  [zoom-policy.md](zoom-policy.md). Per-engine pinch verification in Safari
  remains, and that is a browser task rather than a code one.
- ✅ **Landed (2026-07-08): low-zoom chrome strokes.** Chrome is drawn in world
  units inside a zoom-scaled frame, so a 1px border rendered as `1 × zoom` screen
  pixels — a tenth of a pixel at 10% zoom. Borders, the header rule, and the inner
  frame all thinned to nothing exactly when the user zoomed out to see how their
  windows relate. Strokes now read `--icx-chrome-stroke`, which the frame widens in
  world units as zoom shrinks and never lets render below one screen pixel. Above
  100% zoom it is inert. Simplified proxy chrome remains a P7 (semantic LOD) item —
  a stroke that survives is not the same as chrome that is legible.
- `window.data` generic threading through registry + render contexts (the
  real fix beyond the helper); payload-variance split for overlay contexts.
- Exit: a showcase embedding a non-trivial app (forms, popovers, scrolling
  lists) in windows with zero consumer workarounds.

## P7 — Rasterization v2 & Semantic LOD (far-zoom readability)

**This is two programs wearing one number, and treating them as one held the
unblocked half hostage to the blocked one.** Split them explicitly:

- **P7a — capture-lane modernization.** Genuinely blocked: needs Chrome 148+
  with the OT flag, which is the owner's browser or token. Nothing here is an
  agent's to finish. _Status check, 2026-08-12: html-in-canvas is **not
  leveraged at all**. `rasterization.tsx` types its adapter as the one-member
  union `"snapdom"`, the single capture call is `import("@zumer/snapdom")`, and
  the string "html-in-canvas" appears once in `src/` — in a comment saying the
  lane will be rebuilt on it. R12 reads as though a decision were executed; it
  was made, recorded, and never built._
- **P7b — semantic LOD.** ✅ **Landed 2026-08-12 (`1545636`)**, and it was never
  blocked on P7a. It could not have been: **rasterization cannot deliver
  far-zoom readability, because a rasterized paragraph is still a paragraph.**
  A snapshot at 15% zoom is the same unreadable text, blurrier and cheaper.
  `detail-level.ts` + `renderSummary` on the window definition; thresholded on
  effective screen size rather than zoom, with a hysteresis band because zoom is
  continuous and a single threshold flickers.

The capture lane modernization plus the half of RASTERIZATION_PLAN that
snapshots can't solve:

- html-in-canvas capture adapter behind the existing raster contract
  (`captureElementImage` primary, snapdom fallback, feature-detected;
  captures land as ImageBitmaps/GPU textures — old slices 4+5 merged).
  `onpaint` as the recapture signal replacing idle-callback heuristics.
- **Semantic LOD lanes**: `renderSummary`/`renderIcon` on window
  definitions, thresholds on effective screen size, far proxy lane
  (readable labels/icons at 12% zoom — no rasterized paragraph survives
  far zoom).
- RENDER-001..003 scenarios as tests; LOD showcase.
- Exit: a 12–25% zoom document where every window stays identifiable;
  capture lane switches automatically per browser capability.
- Dependencies: shares the capture plumbing with P2's texture mode —
  whichever runs first builds it.

## P8 — Quality & Release Engineering (shippability)

- **Browser-mode interaction tests**: the acceptance-scenario suite as
  executable Vitest browser tests (real pointer events), replacing
  one-off live driving; the computed-style fingerprint harness productized
  as a visual-regression tool (or port kek's visual-parity).
- Perf benchmarks in CI (from P2's harness).
- **Publishing pipeline**: rename to the `@infinite-canvas/*` scope,
  changesets/version flow, README + API documentation, docs site seed in
  the `apps/website` slot, license/contribution hygiene.
- Exit: `npm install @infinite-canvas/react` works for an external
  consumer with documented quick-start; CI gates on tests + benchmarks +
  visual checks.
- Dependencies: none, but most valuable after P3 exists to show.

## Sequencing posture

Recommended spine: **P2-tranche-1 (small, immediate) → P1 (grouping) →
P4 (transactions/recipes, designed against the group model) → P5**, with
**P3 (styled distribution)** running as the parallel creative track and
**P6** slotted whenever body-content pain surfaces. P7 activates when the
owner's Chrome (148+, OT flag) is available for capture work; P8
crystallizes whenever external sharing becomes a goal. All programs write
their acceptance scenarios into the test suite as they land — the
acceptance doc is the shared checklist.
