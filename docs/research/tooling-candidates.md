# Tooling Candidates

> Provenance: adapted 2026-06-10 from kek-monorepo's `tooling-shortlist.md`
> (2026-04-22/23), corrected for decisions made since: Legend State was
> adopted (the doc still framed it as an evaluation), and the official
> framework does not use `@react-three/xr` (that was the predecessor's scene
> pointer layer; the framework handles pointers in the DOM layer). Stances
> below are for this repo today.

## Adopted (no action)

- **`@legendapp/state` 3** — the state adapter behind `store.tsx`. The pure
  core stays adapter-agnostic so the deferred re-evaluation remains cheap.
- **`@zumer/snapdom`** — snapshot lane capture, behind a dynamic import.

## Add when the trigger fires

- **`r3f-perf`** — playground-only dev dependency; add when GPU work starts
  in earnest (scene-layer showcases, grid backdrop work) so camera motion and
  future guides get a factual baseline before more effects are added.
- **`@react-three/a11y`** — accessibility is FR-9, not a nicety. Relevant
  once interactive affordances live in the scene; if chrome stays DOM-only,
  ordinary DOM a11y work may matter more than this package.
- **`troika-three-text`** — adopt if/when desktop labels, guides, or HUD
  text move into the GPU layer; don't hand-roll GPU text.
- **`@floating-ui/react`** — menus/popovers anchored in the DOM layer.
  Trigger: contextual menus or the body-content portal work (see
  [body-content-contract.md](body-content-contract.md)). Note `@base-ui/react`
  (already in the playground UI kit) embeds floating-ui positioning — prefer
  base-ui components first; reach for floating-ui directly only for
  canvas-anchored overlays the UI kit can't express.
- **RBush / Flatbush** — spatial index for snap candidates and culling at
  scale; trigger documented in [snapping.md](snapping.md).

## Situational

- **`@use-gesture/react`** — only if root-level DOM gestures get heavy
  (pinch normalization could be its trigger; see
  [../zoom-policy.md](../zoom-policy.md)).
- **`@react-three/xr` pointer-events layer** — only if interactive chrome
  ever returns to the scene; pair with R3F v10 event priorities rather than
  custom raycast plumbing. Not currently used.

## Deliberately avoided

- **`@react-three/handle`** — incompatible posture with our interaction
  engine; its architecture lessons (framework-agnostic core, rich interaction
  state, apply boundary) are already absorbed into `interaction.ts`.
- **`@react-three/uikit`** — window bodies are DOM; scene-native UI kits
  don't fit the boundary.
- **GridStack / React-Grid-Layout** — dashboard math must not become the
  desktop model (risk R8).
- **`@lume/kiwi` (Cassowary solver)** — only if weights/min-max rules
  demonstrably fail (risk R7).
- **`camera-controls`, `@react-three/offscreen`, `three-mesh-bvh`** — wrong
  levers for a 2D ortho desktop at current scale.
