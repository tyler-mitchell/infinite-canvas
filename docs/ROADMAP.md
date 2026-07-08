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
- **Still open: the pointer gestures.** Create-group-by-docking, drag-the-shell,
  tear-out-by-drag, and gutter dragging all have canonical commands and a pure
  hit-test (`getInfiniteCanvasGroupDockEdgeAtPoint`,
  `getInfiniteCanvasGroupGutterWeights`) but no pointer bindings yet. Until they
  land, a drag on a grouped window is refused rather than allowed to fight the
  projection.
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
  **Partially met.** The showcase drives all of that through commands. Doing it
  by dragging, and the scenario tests, remain.
- Dependencies: none hard; benefits from P2's chrome memoization landing
  first (group shells add chrome).

## P2 — Performance: 60fps at 100+ windows

Started (body memoization landed; 20→97fps pan). Finish the cost model in
[research/performance-profile.md](research/performance-profile.md):

- ~~Tranche 1: memoize frame inner chrome~~ — **landed, unmeasured.** The
  frame no longer takes `state`; chrome, body, and resize handles are
  memoized on window identity, and handle geometry moved to a CSS custom
  property so zoom stops rebuilding them. Numbers pending a real-hardware
  run. Tranche 2: window-layer visibility culling (subsystem exists, layer
  ignores it).
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

- Transaction boundaries: coalesce drag/resize/group-move into single
  undoable units; history stack with size policy; undo/redo commands +
  hotkeys (unblocks the deferred Delete binding).
- **Layout recipes** (designed WITH the group model per risk R10): named
  arrangements, save selection/cluster, reapply into a world region,
  per-window history (last floating rect, last dock path).
- Persistence v2: recipes + history in the versioned serialization;
  PERSIST-001..003 scenarios as tests.
- Exit: ctrl-Z/shift-ctrl-Z across all mutations; recipe save/apply in a
  showcase; tear-out→move→re-dock→undo×3 is transactionally coherent.
- Dependencies: recipes want P1's group model; window-only undo/redo can
  land first.

## P5 — Keyboard, Focus & Accessibility (FR-9 + FR-8 completion)

- Directional window focus (group-local first, global geometric fallback,
  floating windows via contextual parent —
  [research/state-focus-and-recipes.md](research/state-focus-and-recipes.md));
  focus restoration; FOCUS-001..003 scenarios.
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

- Framework-owned **portal roots**: window-local (menus/popovers tracking
  the window) and desktop-level (overlays escaping window bounds);
  documented positioning semantics for transformed subtrees (base-ui
  popovers inside bodies become safe).
- Input ownership policy completion: wheel `deltaMode` normalization,
  modifier-zoom-over-bodies decision, pinch edge cases
  ([zoom-policy.md](zoom-policy.md) open items).
- Low-zoom chrome stroke policy (minimum screen-space stroke or simplified
  proxy chrome).
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
