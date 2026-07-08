# Infinite Canvas

**A spatial window manager for the web.** Not a whiteboard — a desktop.

Windows are the primary object: you open, focus, pin, minimize, maximize,
move, resize, snap, and arrange them on an infinite orthographic plane. Each
window body is ordinary React DOM, so anything you can build in a component
can live inside one. An optional, transparent WebGPU surface sits behind and above
the window plane for programmable, camera-synchronized scene content.

```bash
npm install @infinite-canvas/react react react-dom
```

→ **[Quick start and package docs](packages/infinite-canvas/README.md)**
· **[API reference](docs/API.md)** · **[Roadmap](docs/ROADMAP.md)**

---

## Why this exists

The infinite-canvas landscape is whiteboards, diagram editors, and PKM
canvases — tldraw, Miro, FigJam, Excalidraw, Obsidian Canvas. They are drawing
surfaces first.

This is the other thing. The lineage is **i3, AeroSpace, Dockview, FancyZones,
PowerToys Workspaces** — desktop window management, transplanted onto an
infinite plane and exposed as a React framework. Almost nobody is building
that.

## The four bets

1. **A pure, state-library-agnostic core.** Geometry, the reducer, selection,
   snapping, stacking, and camera navigation are pure functions over plain
   data, testable without rendering. Legend State is an adapter at the React
   boundary, never inside derivation. A boundary test enforces it.

2. **An explicit GPU/DOM seam, stated honestly.** WebGPU owns the programmable
   spatial layer; window chrome and bodies are DOM, projected from the same
   canonical camera. Arbitrary DOM content does _not_ participate in the
   WebGPU render pass and cannot be depth-interleaved with scene geometry.
   The framework documents that boundary rather than pretending otherwise.

3. **One canonical mutation path.** Pointer gestures, keyboard shortcuts, UI
   buttons, and programmatic drivers all compile down to the same named
   commands. It is what makes automation work today, and what will keep
   undo/redo and multiplayer tractable when they land.

4. **Genuinely headless.** Framework components emit structure, geometry, and
   a stable `data-slot` attribute vocabulary — and no visual identity at all.
   `theme.css` is opt-in: a single cascade layer over that contract, so your
   styles always win. A test fails the build if a framework component ever
   emits a literal `className`.

## Status

**0.1.0 — pre-1.0.** The API may change between minor versions. What is
documented works and is tested; nothing below is aspirational.

|              |                                                                                             |
| ------------ | ------------------------------------------------------------------------------------------- |
| Tests        | 164, including packaging, accessibility, headless-boundary and pure-core-boundary contracts |
| Bundle       | ~40 KB gzipped without scene layers, excluding peers                                        |
| Runtime deps | 3 — `@legendapp/state`, `@tanstack/hotkeys`, and `@zumer/snapdom` (lazily imported)         |
| Requires     | React 19. `three` and `@react-three/fiber` are optional peers, needed only for scene layers |

**Implemented:** infinite pan/zoom canvas · window lifecycle · selection,
marquee, and group move · snapping with edge/center/gap guides · keyboard
command layer, including directional window focus · camera navigation · versioned, document-scoped persistence ·
typed drag & drop with spatial target resolution · read-only R3F scene layers ·
custom chrome via `renderFrame` · headless theming.

**Not implemented yet:** window grouping, docking, and tabs · undo/redo ·
layout recipes · group-local focus, focus trapping, and a complete
accessibility story · far-zoom semantic level-of-detail. Each is a defined
program with exit criteria in [the roadmap](docs/ROADMAP.md), not a wish.

## Repository

| Path                       |                                                                                                           |
| -------------------------- | --------------------------------------------------------------------------------------------------------- |
| `packages/infinite-canvas` | the published library, `@infinite-canvas/react`                                                           |
| `apps/playground`          | showcases; also the framework's integration test bed                                                      |
| `packages/ui`              | private UI kit, used only by the playground                                                               |
| `docs/`                    | requirements, roadmap, API reference, research                                                            |
| `reference/`               | prior-art source, kept on disk for mining; **not in the repository** (see [SHIP_PLAN](docs/SHIP_PLAN.md)) |

## Development

Requires Node ≥ 22.12 and pnpm 11.5.2 (`corepack enable`).

```bash
pnpm install
pnpm exec vp run playground#dev     # playground at :5173
pnpm exec vp check                  # format, lint, typecheck
pnpm exec vp run -r test            # tests
```

The playground consumes the framework through source-linked exports, so
framework edits hot-reload with no build step. See
[CONTRIBUTING.md](CONTRIBUTING.md) — in particular the two invariants
contributors most often break (the headless boundary, and the pure core's
import boundary), both enforced by tests.

## License

MIT © Tyler Davis Mitchell
