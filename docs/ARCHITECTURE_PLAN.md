# Infinite Canvas framework architecture plan

Status: draft for review from 2026-06-10.
Source: `reference/infinite-canvas`. Files: README, FEATURE_TRACKER, SELECTION_AND_KEYBOARD_PLAN, and RASTERIZATION_PLAN.
This document records the plan before the port started.

## Mission

The target was a standalone, publishable framework based on the most developed kek-monorepo experiment.
That experiment supplied the specification.
The demo remained a thin consumer, or "route as a thin consumer".

## Reference evidence

Status: observed.

- **2D model.** It included windows, camera, viewport, rectangles, pure geometry, stacking, input, navigation, and a deterministic reducer.
- **Selection.** It included replace, add, toggle, clear, select-all, marquee, group movement, and typed non-window targets.
- **Keyboard.** It used the core of `@tanstack/hotkeys`, contextual queries, and all five SELECTION_AND_KEYBOARD_PLAN phases.
- **Extensions.** They included `renderFrame`, read-only `sceneLayers`, projected proxies, spatial targets, drag contracts, and connector helpers.
- **Persistence.** It was versioned, ArkType-validated, registry-normalized, and document-scoped.

The raster plan had five lanes:

1. Live DOM.
2. A semantic summary or icon.
3. A snapshot from `@zumer/snapdom`.
4. Future HTML-in-Canvas.
5. A far proxy.

Slices 0 through 3 were in progress.
No work existed for slice 4, WebGPU texture presentation.
No work existed for slice 5, the HTML-in-Canvas adapter.

## Architecture decisions

| Decision         | Contract                                                                                                          |
| ---------------- | ----------------------------------------------------------------------------------------------------------------- |
| Render ownership | WebGPU and R3F own the spatial layer. React DOM owns chrome and bodies.                                           |
| Layer alignment  | Core chrome stays in the DOM host. Scene layers contain decorative content and world content.                     |
| State            | The reducer is pure. Legend State stays in the React adapter in `store.tsx`.                                      |
| Mutations        | Named commands map pointer, keyboard, UI, and future agent input to reducer actions.                              |
| Consumer access  | Consumers get read-only context and actions. They cannot edit Three objects, read the DOM, or access raw signals. |

## Proposed workspace

| Path                       | Purpose                                                                     |
| -------------------------- | --------------------------------------------------------------------------- |
| `packages/infinite-canvas` | One framework package with internal module boundaries.                      |
| `apps/playground`          | A normal consumer and integration application that replaces `apps/website`. |
| `packages/utils`           | A template placeholder that leaves after the first real package arrives.    |

A package split required a real consumer boundary.
The possible names were `core` and `react` under `packages/infinite-canvas`.
The split required a consumer that needed the pure core without React. An early split increased the release
API without a consumer need.

The reference described 11 playground routes.
The playground covered normal windows, custom frames, scene chrome, scene layers, and a workflow board.
It also covered a drop tray, live stress, raster stress, frustum tools, and raster tools.

The plan used `vp create vite:library` and `vp create vite:application`.
These commands kept catalog and workspace configuration consistent.

## Internal layers

The first line depends on the lines that follow it:

```
consumer surface   index barrel, factory, registry, presence helpers
render layer       infinite-canvas.tsx composition, window frames, scene
                   layers, rasterization adapters, devtools
adapter layer      store (Legend State), keyboard (hotkeys core), runtime
pure core          types, geometry, reducer, interaction, input-policy,
                   camera-navigation, selection, stacking, snap-*,
                   spatial-target, scene-model, persistence, commands
```

The pure core has no React, Three, or Legend State imports.
This boundary keeps the reducer testable and the state adapter replaceable.
The reference used `framework-boundary.test.ts` to enforce it.

## Port sequence

Each phase moved modules with their colocated tests.
Those tests defined "done" for each phase.

| Phase         | Work                                                                                                                              | Exit or effect                                                                                   |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 1. Pure core  | Port types, geometry, reducer, input, selection, snapping, stacking, camera, spatial targets, persistence, and commands.          | ArkType is the only framework dependency. `vp run -r test` passes with import-path changes only. |
| 2. Adapters   | Port the Legend State store, hotkey boundary, runtime, factory, and registry.                                                     | This phase adds the first external stack choices.                                                |
| 3. Rendering  | Port `infinite-canvas.tsx`, frames, scene layers, visibility, and rasterization.                                                  | This phase adds the R3F and WebGPU choices.                                                      |
| 4. Playground | Port the normal document, workflow board, stress routes, and developer tools.                                                     | The workflow board uses the largest part of the API.                                             |
| 5. Open work  | Add texture presentation, HTML-in-Canvas, history, snap hysteresis, accessibility, focus, a spatial index, and the grid backdrop. | The tracker marks snap hysteresis as `risk`. The backdrop waits for the scene-layer seam.        |

The reference used the `#/` alias.
Each ported file required package-relative imports.
The `reference/**` files stayed outside formatting and lint scopes.

## Open decisions in the draft

- **Stack.** The reference used React 19, Legend State 3 beta, R3F v10 canary, Drei, Tailwind 4, and TanStack Router.
  The core required no decision, and the adapter choice was Legend State or another adapter.
  The scene choice was R3F canary or stable.
  The playground choice was TanStack Router or plain Vite pages.
  Beta and canary packages increased the consumer cost.
- **Package scope.** The scope affected the first `vp create` command.
  The unresolved example was `@something/infinite-canvas`.
- **CSS.** The reference used Tailwind 4 in framework chrome.
  The package needed vanilla CSS, inline values, or tokens without a Tailwind requirement.
- **Grid.** The experiment lived in `reference/
infinite-canvas-dynamic-grid`.
  It can become a built-in backdrop, a package, or a playground example.
  This choice did not block work before Phase 3.
- **Visual comparison.** kek-monorepo had `packages/visual-parity`.
  The draft proposed evaluation near Phases 4 and 5 for pixel regressions in grid and raster changes.
