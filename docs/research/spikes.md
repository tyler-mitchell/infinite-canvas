# Spikes

Investigations that are worth doing, deliberately not scheduled. Each entry states what would be
proved, why it matters, and what would make it worth starting. Nothing here is in flight.

## liquid-gooey for HUD state transitions

**Raised by Tyler, 2026-08-26. Natural home is the HUD workstream, so this is the nearer of the
two spikes.**

`liquid-gooey` (`Jakubantalik/Libraries/packages/liquid-gooey`) provides liquid effects for React
UI: **morph**, where touching pieces merge and change shape, and **move**, where surfaces trail a
moving element like liquid rubber. The API is `<Liquid blur contrast fill>` wrapping
`<Liquid.Item x y effect>`; it renders SVG silhouettes _beneath_ real DOM content, so the blur and
shadow apply to the shape while text and images stay crisp — which is the part that makes it
usable for chrome rather than only for decoration.

**Why it fits the HUD.** Polkadot's HUD is not one bar, it is a set of surfaces that change with
what you are doing — idle, selecting, dragging, connecting, playing a tour. The transitions
between those states are exactly where a canvas app either feels alive or feels like a toolbar
that swapped its buttons. Candidates:

- Pill rails that **merge into one mass** when a contextual group appears beside them, and split
  back when it leaves.
- A radial or dial menu blooming out of a single control, the way the dial-menu reference does.
- Minimized windows melting into the dock rather than disappearing.
- The selection count badge separating from the selection bounds as it settles.

**What the spike must establish**

- That the SVG-silhouette approach composes with a `transform: scale()` canvas — the effect is
  screen-space chrome, so it should live outside the world transform, but that needs proving.
- Cost per frame with several `Liquid.Item`s live during a drag, since the HUD is on the hot path.
- Whether it degrades gracefully: the HUD must stay usable if the filter is unsupported or
  `prefers-reduced-motion` is set.
- Whether the effect survives the pill rail's `backdrop-filter`, or whether the two fight.

**What would make it worth starting:** the HUD state model existing at all. Applying a merge
effect before there are states to merge between is decoration, and this project has already made
that mistake once with the dot field.

## TypeGPU as the rendering harness, replacing react-three-fiber

**Raised by Tyler, 2026-08-26. Not to be started until the product layers above it are real — and
possibly not at all this cycle.**

TypeGPU recently shipped `@typegpu/gl`, which generates GLSL and provides an experimental WebGL 2
backend for a subset of TypeGPU's render API. Two consequences:

- A render effect can run in browsers **without** WebGPU, which is the constraint that has kept
  the scene layer optional and unshippable as a default.
- TypeGPU shader functions can be integrated into an **existing** WebGL renderer, so adoption does
  not have to be all-or-nothing.

**Why this is unusually well-suited to an infinite canvas**, and why it unlocks things
react-three-fiber structurally cannot: r3f is a React reconciler over a scene graph of objects. A
canvas does not want a scene graph — it wants a small number of large, data-driven surfaces
(fields, connector meshes, window proxies, far-zoom overviews) whose contents change every frame
with the camera. Expressing those as typed GPU functions composed in TypeScript is a different and
better fit than instantiating and diffing three.js objects, and it removes `three` plus the
reconciler from the dependency floor.

**The spike:** a proof of concept moving the framework away from r3f as the main rendering harness
and toward TypeGPU, with `@typegpu/gl` as the fallback path for non-WebGPU browsers. It is a
proof, not a migration.

**What it would have to establish**

- One existing scene-layer capability rendered end to end through TypeGPU, at parity.
- The WebGL 2 fallback actually working in a browser without WebGPU, since that is the whole
  premise.
- Whether `getInfiniteCanvasWindowProxies` and the frustum work survive unchanged, or whether the
  proxy model is r3f-shaped and needs rethinking.
- Bundle and dependency-floor effect with `three` and `@react-three/fiber` removed from the
  `/scene` entry.

**What would make it worth starting:** a product surface that needs GPU rendering on hardware
without WebGPU. Until something real is blocked on that, this is an architecture preference rather
than a requirement, and the framework already ships the scene layer as an optional entry that
costs nothing when unused.

**Local tooling note:** this repository has a TypeGPU inspector MCP available
(`mcp__typegpu_inspector__*`) that validates TypeGPU modules in a real browser WebGPU runtime and
returns structured diagnostics. A spike should drive that rather than eyeballing output.
