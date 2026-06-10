# Infinite Canvas Framework — Architecture Plan

Status: draft for review (2026-06-10). Mined from `reference/infinite-canvas`
(README, FEATURE_TRACKER, SELECTION_AND_KEYBOARD_PLAN, RASTERIZATION_PLAN).
Nothing here is ported yet; this is the map for doing it deliberately.

## Mission

Turn the kek-monorepo infinite-canvas experiment into a standalone,
publishable framework. The experiment is the most evolved implementation and
is treated as the spec; this repo is where it becomes the product, with the
demo app as a thin consumer — the same boundary discipline the experiment
already enforced ("route as a thin consumer").

## What the reference implementation proved

The experiment is far past prototype. Shipped and test-covered:

- **2D world model**: windows, camera, viewport, rects; pure geometry,
  stacking, interaction, and camera-navigation modules; deterministic reducer.
- **Selection + keyboard**: full selection model (replace/add/toggle/clear/
  select-all, marquee, group move, typed non-window targets), command registry
  on `@tanstack/hotkeys` core, contextual command queries. All five phases of
  SELECTION_AND_KEYBOARD_PLAN are implemented.
- **Extension seams**: `renderFrame` custom chrome slots, read-only R3F
  `sceneLayers` (world/screen space) over projected window proxies, spatial
  target resolvers, typed drag/drop contracts, graph connector helpers.
- **Persistence**: versioned, ArkType-validated, registry-normalized,
  document-scoped.
- **Rasterization** (mid-flight): five-lane LOD plan (live DOM, semantic
  summary/icon, snapshot via `@zumer/snapdom`, future HTML-in-Canvas, far
  proxy). Slices 0–3 are at least started; slices 4 (WebGPU texture
  presentation) and 5 (HTML-in-Canvas adapter) are not.

Architectural bets the reference docs say to preserve unless the stack
materially changes:

1. **WebGPU/R3F owns the programmable spatial layer; React DOM owns window
   bodies.** The hybrid seam is explicit and deliberate. Core window chrome
   stays in the DOM host (no cross-layer drift); scene layers are decorative.
2. **The reducer is pure and state-library agnostic.** Legend State is an
   adapter at the React boundary (`store.tsx`), never inside core derivation.
3. **Commands are the single mutation path.** Pointer, keyboard, UI buttons,
   and future agents all resolve through named commands → reducer actions.
4. **Consumers get read-only context + framework actions.** No direct Three
   object edits, DOM reads, or raw signal access from consumer code.

## Proposed workspace shape

- **`packages/infinite-canvas`** — the framework. One package to start, with
  the layering kept as internal module boundaries (mirroring the reference
  file structure, which is already clean). Split into `core` / `react` /
  scene-layer packages only when a real consumer needs the pure core without
  React — premature splitting multiplies release surface for no user.
- **`apps/playground`** — the consumer/demo app, replacing `apps/website`.
  Hosts the showcase stages (the reference has 11 routes' worth: normal,
  custom-frames, scene-chrome, scene-layers, workflow-board, drop-tray,
  stress-live, stress-raster, frustum-devtools, raster-devtools). Showcases
  double as the framework's integration test bed.
- **`packages/utils`** — template placeholder; delete when the first real
  package lands.
- Scaffold with `vp create vite:library` / `vp create vite:application` so
  catalog/workspace wiring stays canonical.

Internal layering inside `packages/infinite-canvas` (top depends on bottom,
never the reverse):

```
consumer surface   index barrel, factory, registry, presence helpers
render layer       infinite-canvas.tsx composition, window frames, scene
                   layers, rasterization adapters, devtools
adapter layer      store (Legend State), keyboard (hotkeys core), runtime
pure core          types, geometry, reducer, interaction, input-policy,
                   camera-navigation, selection, stacking, snap-*,
                   spatial-target, scene-model, persistence, commands
```

The pure core has no React/Three/Legend imports — that's the property that
makes the reducer testable and the state library swappable, and it's the
first thing to protect with a lint boundary (the reference has
`framework-boundary.test.ts` for exactly this).

## Porting strategy

Port in dependency order, tests first-class at every step. The reference has
extensive colocated tests — they port alongside their modules and define
"done" for each phase.

1. **Phase 1 — pure core.** Types, geometry, reducer, interaction,
   input-policy, selection, snapping, stacking, camera-navigation,
   spatial-target, persistence, commands, plus their tests. Zero framework
   dependencies beyond ArkType, so this phase is also where stack decisions
   bite least. Exit: `vp run -r test` green on the core with the reference
   test suite passing unmodified (minus import paths).
2. **Phase 2 — adapters.** Legend State store, hotkeys keyboard boundary,
   runtime/factory/registry. First external-stack commitments land here.
3. **Phase 3 — render composition.** `infinite-canvas.tsx`, window frames,
   scene layers, visibility, rasterization. R3F/WebGPU commitment lands here.
4. **Phase 4 — playground showcases.** Port stages incrementally, starting
   with the normal sample document, then workflow-board (it exercises the
   widest API surface), then the stress/devtools stages.
5. **Phase 5 — resume the open tracks.** Rasterization slices 4–5, undo/redo
   transactions, snap hysteresis (flagged `risk` in the tracker),
   accessibility/focus hardening, spatial index. The dynamic-grid motion
   study becomes a backdrop option once the scene-layer seam is ported.

Throughout: reference imports use kek's `#/` alias and are intentionally
broken — every ported file gets its imports rewritten to package-relative
paths, and `reference/**` stays excluded from fmt/lint.

## Open decisions (need Tyler)

1. **Stack parity.** The reference runs React 19, Legend State 3 beta, R3F
   v10 canary + drei, Tailwind 4, TanStack Router. Reference docs say
   preserve the Legend State and R3F bets, but beta/canary deps are a real
   cost for a standalone framework. Decide per-layer: core (no decision
   needed), state adapter (Legend State 3 beta vs. alternatives), scene
   (R3F v10 canary vs. waiting for stable), playground router (TanStack vs.
   plain Vite multipage).
2. **Package naming/scope.** `@something/infinite-canvas`? Affects
   `vp create` invocations, so it's the first blocker for Phase 1.
3. **Tailwind.** Framework CSS strategy: the reference uses Tailwind 4
   classes inside framework-rendered chrome. A publishable framework probably
   wants its own CSS (vanilla/inline/tokens) rather than imposing Tailwind on
   consumers.
4. **Dynamic grid placement.** Aesthetics experiment (`reference/
infinite-canvas-dynamic-grid`) could become a built-in backdrop module, a
   separate package, or stay a playground-only showcase. No need to decide
   before Phase 3.
5. **Visual parity tooling.** kek's `packages/visual-parity` exists for
   image-comparison testing of canvas aesthetics. Worth pulling in around
   Phase 4–5 if we want pixel-regression coverage of the grid/raster work.
