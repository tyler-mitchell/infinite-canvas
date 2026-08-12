# Roadmap: Large Work Programs

> Adopted 2026-06-10, after the headless extraction landed and the first
> performance tranche shipped. Each entry is a deliberately LARGE program —
> multi-session, with its own spec base, exit criteria, and dependencies —
> so there is always predefined high-value work to pick from. Precedence
> rules from [README.md](README.md) apply; specs referenced here win over
> this summary.

## Current execution slate (adopted 2026-08-12, rewritten after driving the product)

> A **view over the programs below**, not a new program list. P1–P8 own the capability
> definitions; this section says what gets worked next and in what order.

The previous slate was consumed in a few hours because every track on it was a one-to-two hour
addition. This one is built from what **running the product** revealed rather than from what the
documents claimed, and it is ordered so that production readiness is _closed_ rather than
described.

### Where production actually stands — verified 2026-08-12, not read off a doc

The sentinel and the ship plan both understate this, because they were written when tests and
the browser were out of scope and were never revised when that changed.

| Gate                    | State                | Reality                                                                                                             |
| ----------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Publishable to npm**  | ✅ ready             | `pnpm publish`. Owner action, external service.                                                                     |
| **Public repository**   | ⛔ owner-gated       | One `git filter-repo` purge. Irreversible, no remote.                                                               |
| **Honest "production"** | 🟡 **one item left** | Focus trapping **is built** (`focus-trap.ts`). The body-content showcase **is built** (221-line route). C2 is 9/15. |

So the only agent-executable production blocker left is **C2's remaining six scenarios**. P2's
measurement needs real hardware and is not required for a 0.2.0 that documents its own limits.
That is M1, and it is first for exactly that reason.

### What driving the product actually taught

Semantic LOD shipped with 11 green unit tests and was **broken in the most ordinary use there
is**: `/stress` windows are 300×210, `extent` takes the smaller axis, and 210 sat under the old
240px restore threshold. A window demoted on zoom-out and never came back at 100% zoom. Fixed in
`aa5f085`.

The tests were not a safety net; they were the problem. They asked _"does the hysteresis band
work"_ using numbers chosen to exercise the band, and never asked _"is a real window full detail
at 100% zoom"_ — the question the product asks. **Every feature on this slate is therefore
verified against real registries at real zoom levels before it is called done**, and M2 makes
that structural rather than a habit.

### M1 — Close C2: the six missing scenarios. ✅ DONE (2026-08-12)

DOCK-003, SPLIT-001, ACC-001, FAIL-001, PERSIST-001, and the FOCUS family, on top of the nine that
already asserted. **All seventeen scenario ids now pass** — 237 tests across 27 files.

**This was the last thing standing between the framework and an honest production claim**, which
is why a test track led a slate the owner asked to be feature-heavy. With it closed, the only
remaining production item is P2's measurement, which needs real hardware and is not required for a
0.2.0 that documents its own limits.

Two things it cost that a test track is not supposed to cost, both worth keeping:
`getNextRovingIndex` had to **move out of `group-layer.tsx`** into `window-focus.ts` before ACC-001
could be asserted at all — pure keyboard geometry has no business in a render module, and being
unreachable is why that scenario stayed unchecked. And FAIL-001's first draft asserted the doc's
number against correct code, because the doc's arithmetic assumes a pointer-anchored zoom; the
test now drives `camera.zoomAt` and additionally asserts the underlying invariant rather than the
arithmetic.

Exit: **met.**

### M2 — Product-shaped verification (~2.5h)

The systemic fix for the class of defect that shipped in semantic LOD. A suite that drives the
**playground's own registries and window dimensions** through the framework and asserts the
invariants a user would notice: every window kind is full detail at 100% zoom; every arrange verb
is enabled exactly when its precondition holds; every default chord resolves to a command; no
`--icx-*` token referenced by a component is undefined.

Also fixes the one bug found today and not yet closed: **`window.__canvas.contextualCommands()`
returns stale enablement.** It reported `enabled: false` for align while the command demonstrably
worked — the product UI was correct, only the automation handle was stale. That handle is the
agent-facing contract, and an agent that trusts it is misled exactly as I was.

Exit: the suite fails when a threshold is set so a stock window is not full at zoom 1; the dev
handle's enablement matches the palette's.

### M3 — The theme system, completed (P3) (~3h)

`theme.css` defines **65** `--icx-*` tokens and the public `theme` prop bridges **11**. There is
**no** light-theme scaffold — zero `prefers-color-scheme` or `[data-theme]` rules. So 54 tokens
are reachable only by overriding CSS, and the headless claim is thinner than the README implies.

Audit every visual surface for a missing token — snap guides, marquee, dock preview, gutters, tab
strips, accordion headers, resize handles, minimap, offscreen indicators, HUD — widen the bridged
set, then ship a second complete look. The light theme is not decoration; it is the **proof** the
token set is complete, because every hardcoded color fights it.

Exit: a playground switcher toggles two complete looks; no framework surface renders an unthemed
color in either; the bridged count is the token count.

### M4 — Window-layer culling that does not unmount (P2 tranche 2) (~2.5h)

The path to 100 windows at 60fps, and the one place the roadmap already spells out the trap:
**culling must not unmount.** Dropping an offscreen window from `visibleWindows` tears down its
subtree — DOM focus falls to `<body>` and silently kills every hotkey, portal roots detach, and
body scroll position, video playback, and uncontrolled input state are destroyed on pan-away.

So: skip transform updates and mark offscreen frames `content-visibility: auto` while leaving them
mounted. The predicate is `isWorldRectWithinViewport`, guarded by `isUsableViewport` first — a
`0 × 0` viewport overlaps nothing and would blank the canvas on first frame.

Exit: at 160 windows, per-frame work drops measurably; focus, portals, and body scroll all survive
a pan-away and return.

### M5 — Workspaces (~3.5h)

The largest genuinely new capability, and the one the domain survey supports: nested canvases and
boards-in-boards are how every mature spatial tool answers sprawl. For a _window manager_ that
reads as **virtual desktops** — named sets a window belongs to, with the camera and selection
restored on switch.

Deliberately not "nested canvases": a canvas inside a canvas means a second camera and a second
input plane, which is a different program. A workspace is one canvas and a membership filter.

✅ **The model landed 2026-08-12** — state shape, four reducer actions, the persistence envelope
at version 3, and the render filter. The exit is asserted: switching preserves each workspace's
camera and selection, survives a reload, and is one undo entry.

`activeWorkspaceId` and `workspaces` are part of the **undo document**, unlike the camera.
Switching writes the outgoing workspace's camera and selection, and the exit asks for it to be
undoable, so which desktop you are on is an edit while panning is not.

**Still open: commands, palette integration, and a showcase.** A workspace is created and named
by a consumer, so the four actions are `parameterized` in `command-coverage.test.ts` — a palette
entry cannot invent which set. The verbs that _would_ resolve from state, and which belong here
when a consumer surface exists, are "switch to the next workspace" and "put the active window
in one".

### Deliberately deferred, with reasons

- **Columns mode** — breaks `group-tree`'s "only weight ratios matter" invariant (a column's
  extent is absolute) and needs shell-local scrolling to be usable at all. R11 is right.
- **P2 measurement** — harness works; the embedded preview throttles `rAF` under load, so the
  number needs real hardware. Demonstrated, not assumed.
- **Texture-mode capture** — needs Chrome 148+ with the OT flag.
- **npm publish, git history purge** — owner actions.

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

- ✅ **Landed: focus trapping.** `focus-trap.ts` and both its wirings —
  `trapInfiniteCanvasTabKey` on Tab in the frame, `focusInfiniteCanvasContent` on entry —
  exist and are called. This section called it "still open" for a month after it shipped,
  alongside the claim that `role="tab"` carries no `aria-controls` "because a window frame
  has no DOM `id` to point at". Both are false: the tab sets `aria-controls` from
  `getInfiniteCanvasWindowFrameElementId`, and the frame carries that id with a comment
  saying it exists for exactly this. Corrected 2026-08-12.
- ✅ **Landed (2026-08-12): a selection can be built without a pointer** (FOCUS-004).
  `selection.extendDirection` is the keyboard's Ctrl+click, and it matters more than it
  sounds: every arrange verb — six aligns, two distributes, swap — needs two or more
  selected windows, and `window.focusDirection` calls `focusWindow`, which _replaces_ the
  selection with the window it focuses. With only "clear" and "select all visible"
  alongside it, the whole arrange family was listed in the palette and unusable in
  practice. The target joins the selection _before_ it is focused, because
  `focusWindowPreservingSelection` takes the active window from the selection's anchor.
- ✅ **Landed (2026-08-12): the camera answers the keyboard.** `view.pan` and
  `view.zoomBy`. It had three commands before — fit-all, fit-selection, reset-zoom — so a
  keyboard user could jump the view but not move or scale it.
- IME and text-selection hardening; screen-reader pass.
- Exit: full keyboard-only session (open, focus, move, resize, arrange, close) is
  practical; a11y audit checklist in the repo passes. **Every verb in that list is now
  reachable**, by chord or palette, except `open` — consumer territory, since only the
  consumer knows what kinds exist and what a new one contains.

  ✅ **The checklist exists, as a guard rather than a document** (2026-08-12).
  `accessibility-structure.test.tsx` renders a canvas with a real tab group — which
  `accessibility.test.tsx` never built, so `aria-controls` was never emitted there — and
  asserts the structural class the semantics tests do not reach: no ARIA id reference
  dangles, no element takes a positive `tabindex`, every tab sits inside a tablist. A
  checklist in prose would go stale the way this section did; a guard fails the build.

  **It found a real defect on its first run.** Only the active child of a tabs container
  renders a frame, so every inactive tab named a panel that was not in the document. A
  dangling `aria-controls` is worse than an absent one — assistive technology follows it,
  finds nothing, and says nothing — so the reference is now emitted only where the panel
  exists.

  **What stands between here and the exit is chords.** And the families added on
  2026-08-12 — arrange, dock, group shape, lifecycle, camera, extend-selection — all ship
  with empty `hotkeys`, because the arrow space is fully taken and the conventional zoom
  keys are the browser's own. Palette-reachable is reachable, but a keyboard-only session
  that routes every verb through a dialog is not yet _practical_.

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
- ✅ **Landed (2026-07-08): `window.data` generic threading.**
  `defineInfiniteCanvasWindowRegistry<Kind, DataByKind>` types each kind's payload while the
  registry literal is written, then erases it, so `renderBody({ window })` hands back
  `window.data` typed by kind. This item stayed unticked for a month and asked for "the real
  fix beyond the helper" — **that fix was considered and deliberately rejected**, which the
  friction backlog records and this line did not. `renderBody` _takes_ a context, so
  `InfiniteCanvasWindowDefinition<K, Data>` is contravariant in `Data`: threading `DataByKind`
  onward would force a type parameter through `Desktop`, the viewport, the window layer, the
  frame, and every slot — and would buy nothing, because `window.data` really is `unknown` at
  runtime. It round-trips through `JSON.parse` on hydration, and a tampered `localStorage`
  entry can put anything there. `getInfiniteCanvasWindowData(window, guard)` exists for
  exactly that boundary.
- Exit: a showcase embedding a non-trivial app (forms, popovers, scrolling
  lists) in windows with zero consumer workarounds. **The pieces exist across two showcases
  rather than one** — `/body-content` carries the forms, the scrolling list on
  `wheelBehavior: "native-scroll"`, and selectable prose; `/portals` carries the popover that
  escapes the zoom transform. What nobody has checked is the "zero consumer workarounds" half,
  which is a claim about using them, not about their being there.

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

**P7a's remaining work**, restated after the split so this list no longer contradicts the
entry above it — it described semantic LOD as pending while P7b records it landed:

- html-in-canvas capture adapter behind the existing raster contract
  (`captureElementImage` primary, snapdom fallback, feature-detected;
  captures land as ImageBitmaps/GPU textures — old slices 4+5 merged).
  `onpaint` as the recapture signal replacing idle-callback heuristics.
- `renderIcon` — the one piece of the LOD lane that is genuinely unbuilt.
  `grep renderIcon src/` returns nothing; `renderSummary` shipped and this
  did not. Whether an icon lane is wanted at all below the summary band is
  an open question, not a scheduled task.
- RENDER-003 as a test, which needs culling to exist first. RENDER-001's
  far-card lane and RENDER-002's pause-during-interaction are both asserted
  or reasoned in `acceptance-scenarios.md`.
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
- **Publishing pipeline**: the rename to `@infinite-canvas/*` is done, as are
  README + API documentation and the root's contribution hygiene (LICENSE,
  CONTRIBUTING, CODE_OF_CONDUCT, SECURITY). Still open: a changesets/version
  flow, and the docs site seed in the `apps/website` slot, which does not exist.

  ✅ **The package now ships its licence (2026-08-12).** It did not. `files` is
  `["dist"]`, and npm looks for LICENSE beside `package.json` rather than at the
  repository root — where a monorepo naturally puts it — so the tarball would have
  declared MIT in its manifest and carried no licence text. `npm pack --dry-run`
  confirms both halves: `LICENSE README.md package.json` plus seven dist files now,
  and no LICENSE before. `verify-artifact.mjs` asserts it, so it cannot regress
  between here and a publish.

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
