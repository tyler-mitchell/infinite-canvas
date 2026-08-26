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
  A canvas whose background is wallpaper is a canvas you do not believe in.
- **Every class comes from a `tv` slot.** No Tailwind strings in JSX, ever. Global CSS is
  tokens, resets, and imports only.
- **Nothing hand-rolled that a maintained library owns.** TanStack (Router, Pacer, Hotkeys,
  Form, Virtual, DB), Base UI, cmdk, ArkType, Legend State, motion, tailwind-variants.

## Now

- [x] Vendored working `@surrealdb/wasm` 3.0.4 with `indxdb://`; deleted the 2.6.1 patch
- [x] SPA on TanStack Router; TanStack Start removed (its dev middleware never mounted, and the
      data layer is client-only so SSR bought nothing)
- [x] Local canvas open, autosave, reload — verified in a browser, `indexedDB` holds `polkadot`
- [x] Framework: `renderBackdrop`, the counterpart to `renderOverlay`
- [x] Design tokens: palette, elevation, motion, type
- [x] Framework tokens for window radius and elevation (`--icx-surface-radius`, `--icx-surface-shadow`)
- [ ] ~~The dot field~~ — **written, then deleted.** See "The living field" below.

## Next

- [ ] **Window chrome.** The frame still wears the framework's default. It needs Polkadot's
      material: floating surface, no outline, controls that arrive on approach rather than
      sitting there, a header that reads as part of the note.
- [ ] **Notes that are notes.** The body is static text. It wants real editing, and the editor
      is a library decision (Tiptap or Lexical), not a hand-rolled contenteditable.
- [ ] **Command palette** on `Mod+K`, composed from `getInfiniteCanvasContextualCommands` and
      `cmdk`. The framework already defines the vocabulary; do not restate it.
- [ ] **The library rail** — content, search, saved views. Currently an empty box making a promise.
- [ ] **Connectors.** `getInfiniteCanvasWindowConnectorPath` and the spatial target resolvers
      exist; typed relations between notes are the first thing that makes this a _knowledge_
      workbench rather than a note board.
- [ ] **Workspaces** as the organizing spine, with `workspace.moveActiveWindow`.
- [ ] **Grain and vignette.** Real material has noise.

## The living field — unstarted, and not to be attempted casually

An earlier attempt shipped a flat dot lattice with a radial brightness falloff and called it the
signature. It was deleted. A caricature occupying the slot is worse than an empty slot, because it
reads as finished.

The real behaviour is specified in `reference/infinite-canvas-dynamic-grid/GRID_MOTION_STUDY.md`,
recovered from a working implementation. It is not "dots that light up near the cursor":

- Lattice points are **simulated**, not drawn from a formula — integration gain `0.08`, damping
  `0.75`, so the field has momentum and settles rather than snapping.
- Window rects apply a force of `(1 - min(distance / 400, 1))^2 * 25` over a 400px radius, with
  the rect targets themselves smoothed before they reach the field.
- Node influence strength eases at `0.15` per frame.
- The pointer highlight eases between **lattice intersections**, not to raw cursor coordinates —
  it snaps to the grid and glides, which is most of why it feels intentional.
- The highlight is composed, not one glow: thin centre lines, faint adjacent-cell traces, and a
  lifted intersection dot, each drawn separately.
- A grain pass over the whole field: `fract(sin(dot(st, vec2(12.9898, 78.233))) * 43758.5453123)`.

`renderBackdrop` exists in the framework and is the correct seam for it. That part was right and
stays. What is missing is the field itself, and it is hours of careful work, not a pass.

## Later, deliberately

- **Tours** — `getInfiniteCanvasWorldPath` and `…PointAtProgress` are built for guided paths
  through a canvas. Nothing consumes them yet.
- **The 3D layer.** Window proxies and frustum culling exist behind `/scene`. Far-zoom overview
  is the honest use, not decoration.
- **Sync.** Local-first is the whole product until it is not. SurrealDB is the choice when it
  becomes a real need.

## Framework gaps Polkadot has found

Kept here because the list _is_ the incubator's output.

| Gap                    | Generic affordance                          | State  |
| ---------------------- | ------------------------------------------- | ------ |
| Backdrop was hardcoded | `renderBackdrop`, mirroring `renderOverlay` | landed |
