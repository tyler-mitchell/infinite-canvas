# Roadmap: Large Work Programs

> Adopted 2026-06-10, after the headless extraction landed and the first
> performance tranche shipped. Each entry is a deliberately LARGE program —
> multi-session, with its own spec base, exit criteria, and dependencies —
> so there is always predefined high-value work to pick from. Precedence
> rules from [README.md](README.md) apply; specs referenced here win over
> this summary.

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
- ✅ **Landed: all four pointer gestures.** Dragging a grouped window's header
  moves its shell as one world object (DOCK-003). Dragging the seam between split
  panes reweights the pair (SPLIT-001) — the step recomputes from the container as
  it stood at drag start, so the seam stays under the cursor rather than drifting.
  Dragging a tab past a 6px threshold tears the window out and hands the same
  pointer to a normal window move (DOCK-004). **Alt+dragging** a floating window
  over another window, or over a group member, docks it (DOCK-001/002).
- ✅ **Docking-intent mode**, which risk R3 asked for. Docking is never something
  a drag falls into: without the modifier a window overlaps as it always did.
  While intent is held, a dock region overlay shows exactly where the window will
  land, and alignment guides are suppressed — a snap guide and a drop target are
  contradictory affordances. The overlay renders the same value the reducer
  applies on release, not a fresh hit-test, so what is promised is what happens.
- **Still open:** resizing a grouped window directly stays refused — a pane is
  resized by its seam, and **the shell has no edge handles yet**, so a group cannot be
  resized at all. Until 2026-07-08 the frame still _drew_ resize handles on grouped
  windows: dead controls that also straddled the frame edge and buried the gutter
  between two panes, eating the seam drag at low zoom. They are gone; the missing
  capability is now honest rather than broken. Building it means a `groupResize`
  interaction beside `groupMove`/`groupGutter` that steps `group.rect` and lets the
  solver re-project members — the hard part is the shell's minimum size, which is a
  function of every pane's `minSize` plus the gutters, not a constant.
  Tab reorder by drag is command-only.
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
[research/performance-profile.md](research/performance-profile.md):

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
  regressions fail loudly.
- Raster defaults tuning at scale (maxPendingCaptures etc.).
- Exit: 100 windows at 60fps pan/zoom/drag on real hardware; benchmark
  suite guarding the numbers; texture-mode go/no-go decided with data.

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
- **Still open: recipes**, and putting history in the versioned envelope.
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
  is done. Still open: the contextual-parent rule for floating windows near a
  shell (FOCUS-002).
- Expanded command grammar: move/resize/arrange via keyboard, named
  placements (left-half/right-third — FR-4's tiling commands) resolving
  through the same placement engine as drag.
- ARIA semantics for windows/controls/HUD; focus trapping policy; IME and
  text-selection hardening; screen-reader pass.
- Exit: full keyboard-only session (open, focus, move, resize, arrange,
  close) is practical; a11y audit checklist in the repo passes.
- Dependencies: group-local focus needs P1; window-level work is
  independent.

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
