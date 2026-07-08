# Changelog

All notable changes to `@infinite-canvas/react` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

While the package is `0.x`, minor releases may contain breaking changes. Breaking changes are always
called out under a `Changed` or `Removed` heading.

## [Unreleased]

<!--
Add entries here as you land user-facing changes. Use the Keep a Changelog
sections, in this order, omitting the ones that don't apply:

### Added
### Changed
### Deprecated
### Removed
### Fixed
### Security
-->

## [0.1.0] - 2026-06-24

Initial release.

### Added

- **Infinite 2D canvas.** Pan and zoom over an unbounded workspace under an orthographic camera,
  with a configurable zoom policy and a canvas-space grid backdrop.
- **First-class window management.** Windows are the primitive, not an afterthought: open, close,
  focus, pin, minimize, maximize, restore, move, resize, and explicit z-order control.
- **Pure reducer core.** Every state transition is a plain `(state, action)` function over
  serializable data — no React, no `three`, no observable runtime. Geometry, selection, snapping, and
  the command layer all live below the renderer and can be driven headlessly.
- **Selection model.** Multi-select with marquee, an anchored selection with union bounds, and group
  move across the whole selection.
- **Snapping with visual guides.** Edge, center, and gap alignment resolved against live snap
  candidates during move and resize, with preview guides rendered as the drag happens.
- **Keyboard command layer.** Hotkeys bound to the same command vocabulary the pointer interactions
  use, so anything the mouse can do the keyboard can express.
- **Camera navigation commands.** Programmatic camera moves — focus a window, frame the selection,
  fit the world, zoom to a point — as commands rather than imperative camera pokes.
- **Versioned, document-scoped persistence.** Canvas state serializes to a versioned envelope, keyed
  per document, and is validated and recovered on read: unknown window kinds and stale references are
  dropped rather than crashing the canvas.
- **Typed drag and drop.** A drop-target contract with spatial resolution, so a payload dropped on
  the canvas resolves to the window (or the empty canvas region) actually underneath it, in canvas
  coordinates.
- **Read-only R3F / WebGPU scene layers.** `sceneLayers` render React Three Fiber content above or
  below the DOM window plane on a transparent WebGPU surface, in camera-owned world space or
  DOM-aligned screen space, backed by projected window proxies.
- **Custom window chrome.** Replace the default header, controls, and corners wholesale via
  `renderFrame`, or slot into the existing frame.
- **Headless styling.** The framework ships no visual identity: every structural element is tagged
  with a `data-slot` from the public `INFINITE_CANVAS_SLOTS` contract, appearance is opt-in via the
  separately-exported `theme.css`, and icons are injected rather than imported.
- **Experimental programmatic handle.** `createInfiniteCanvasHandle` exposes the command surface
  outside the React tree, for tests, tooling, and automation. The shape of this API is not yet
  stable.

[Unreleased]: https://github.com/tyler-mitchell/infinite-canvas/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/tyler-mitchell/infinite-canvas/releases/tag/v0.1.0

- **Headless styling contract.** Framework components emit a stable `data-slot` attribute
  vocabulary and no visual identity; `@infinite-canvas/react/theme.css` is an opt-in cascade layer
  over that contract, so consumer styles always win. Enforced by a boundary test.
- **Accessibility contract.** Windows expose `role="group"`, an accessible name, and
  `aria-roledescription="window"`; the active window is marked with `aria-current`. Every
  framework-rendered button has an accessible name, and unavailable commands are `disabled`.
- **Packaging gate.** `scripts/verify-artifact.mjs` asserts, on every build and before publish, that
  the bundle is marked `"use client"`, that `@zumer/snapdom` stays dynamically imported, that every
  top-level import is a declared dependency or peer, and that the type declarations emit.
- **Experimental programmatic handle.** `createInfiniteCanvasHandle(store)` exposes a state
  snapshot, the typed command facade, and contextual command descriptors for automation and testing.
