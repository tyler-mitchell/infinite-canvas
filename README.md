# Infinite Canvas

A spatial window manager for the web.

Users can open, focus, pin, minimize, maximize, move, resize, snap, and arrange windows on an infinite plane. Each window body contains React DOM. An optional transparent WebGPU surface adds programmable scene content above and behind the window plane.

```bash
npm install @hyphened/infinite-canvas react react-dom
```

- [Quick start and package docs](packages/infinite-canvas/README.md)
- [API reference](docs/API.md)
- [Roadmap](docs/ROADMAP.md).

## Core contracts

### Pure core

The core implements geometry, state transitions, selection, snapping, stacking, groups, history, and camera navigation as pure functions over plain data.

Four boundary modules use Legend State: `store`, `rasterization`, `visibility`, and `canvas-handle`. The `verify-pure-core.mjs` script rejects import paths from the pure core to React, Legend State, or `three`.

### GPU and DOM

WebGPU owns the programmable spatial layer. DOM owns the window chrome and bodies. Both layers use the canonical camera.

DOM content cannot enter the WebGPU render pass or interleave with scene geometry.

The optional scene layer uses `three`.

### Commands

Pointer gestures, keyboard shortcuts, UI buttons, and programmatic drivers use the same named commands.

### Headless output

Framework components emit structure, geometry, and stable `data-slot` attributes. They do not emit a visual design.

The optional `theme.css` file defines one cascade layer. Consumer styles override this layer. A test rejects literal `className` values in framework components.

## Status

Version 0.2.0 is pre-1.0. The API can change between minor versions.

| Measure              | Value                                                                                                      |
| -------------------- | ---------------------------------------------------------------------------------------------------------- |
| Tests                | 400+ across packaging, accessibility, headless-boundary, pure-core-boundary, and action-coverage contracts |
| Bundle               | Approximately 40 KB gzipped without scene layers or peer dependencies                                      |
| Runtime dependencies | `@legendapp/state`, `@tanstack/hotkeys`, and dynamically imported `@zumer/snapdom`                         |
| Required peer        | React 19                                                                                                   |
| Optional peers       | `three` and `@react-three/fiber` for scene layers                                                          |

### Implemented

- Infinite pan and zoom
- Window lifecycle
- Selection, marquee, and group movement
- Edge, center, and gap snapping guides
- Keyboard commands with directional window focus
- Camera navigation
- Versioned, document-scoped persistence
- Typed drag and drop with spatial target resolution
- Split, tab, and accordion window groups
- Docking with Alt+drag
- Undo and redo
- Layout recipes
- Read-only R3F scene layers
- Per-kind semantic summaries at far zoom
- Custom chrome through `renderFrame`
- Headless theming.

### Planned

These features are not implemented:

- Per-window dock history
- Full accessibility support.

The [roadmap](docs/ROADMAP.md) gives the exit criteria for each feature.

## Repository

| Path                       | Purpose                                                                  |
| -------------------------- | ------------------------------------------------------------------------ |
| `packages/infinite-canvas` | Published `@hyphened/infinite-canvas` library                            |
| `apps/playground`          | Showcases and the framework integration test bed                         |
| `packages/ui`              | Private shared React component package                                   |
| `docs/`                    | Requirements, roadmap, API reference, and research                       |
| `reference/`               | Local prior-art source for research. This path is not in the repository. |

See [SHIP_PLAN](docs/SHIP_PLAN.md) for the local prior-art directory.

## Development

Install Node.js 22.12 or later. Install pnpm 11.5.2. Enable Corepack with `corepack enable`.

```bash
pnpm install
pnpm exec vp run playground#dev     # playground at :5173
pnpm exec vp check                  # format, lint, typecheck
pnpm exec vp run -r test            # tests
```

The playground imports framework source. Framework changes hot-reload without a build.

Before you contribute, read [CONTRIBUTING.md](CONTRIBUTING.md).

This guide explains the headless and pure-core boundaries.

These files enforce the boundaries:

- `packages/infinite-canvas/src/headless-boundary.test.ts`
- `packages/infinite-canvas/scripts/verify-pure-core.mjs`.

## License

MIT © Tyler Davis Mitchell
