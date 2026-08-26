# Polkadot roadmap

Polkadot is a spatial workbench built on `@hyphened/infinite-canvas`, and it is two things at
once. It is a real product — local-first, open source, meant to be used. And it is the
framework's incubator: the place where a missing affordance shows up as a thing a real app
cannot do.

**Both roles have one rule.** A gap Polkadot finds is fixed in the framework _generically_, or
not in the framework at all. `renderBackdrop` exists because Polkadot wanted a reactive dot
field and the dynamic-grid experiment wanted a shader — the affordance is "replace the ground",
which is product-neutral. A `dotField` prop would have been the same feature and the wrong one.

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
- [x] The dot field — world-anchored lattice, screen-constant dots, pointer lift, window displacement

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
- [ ] **Grain and vignette.** The field is clean; real material has noise.

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
