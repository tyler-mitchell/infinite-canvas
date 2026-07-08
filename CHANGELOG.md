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
- **Undo and redo.** `Mod+Z` and `Mod+Shift+Z` (or `Mod+Y`) across every window and group mutation.
  History is over the _document_ — the windows and the groups — because everything else is a view onto
  it. Panning is not an edit, and undo never scrolls the canvas out from under someone who just wanted
  their window back. A drag is one entry, not one per frame: the checkpoint is taken when a mutating
  drag begins, so a cancelled drag still has somewhere to return to. Bounded at 100 entries; discarded
  on hydrate and reset; session-scoped and never serialized, because a layout is a document, not its
  edit log.
- **Layout recipes.** `captureInfiniteCanvasRecipe` saves a named arrangement — the selection, a named
  set, or the whole canvas — relative to its own origin, so it drops into any region of an unbounded
  world. `applyInfiniteCanvasRecipe` puts it back: windows it does not name are untouched, windows the
  canvas has lost are skipped, and any group holding a recipe window is dissolved first so two things
  never claim to own the same window's rect. A group is captured only when every one of its members
  is. Recipes translate rather than scale — fitting an arrangement into a smaller region would push
  windows below their own `minSize`. They are plain values the consumer owns and persists, and
  `parseInfiniteCanvasRecipe` treats one crossing storage as untrusted input. Applying one is a single
  undo entry.
- **Portal roots.** A window frame is `transform: scale(zoom)`, which makes it the containing block for
  `position: fixed` — so a popover, menu, or tooltip inside a window body resolves against the _frame_,
  lands in the wrong place, and is scaled by the zoom. `<InfiniteCanvasPortal>` mounts content into a
  root outside every transform: `scope="desktop"` for overlays that escape the window entirely, and
  `scope="window"` for content that must track its window at natural size. The window root is opt-in
  per window kind (`portalRoot: true`) — mounting one for every window would cost a style write per
  window per camera tick. The portal renders nothing until its root exists rather than falling back
  into the transformed subtree, because a popover that quietly appears in the wrong place is a bug the
  consumer will chase into their own code.
- **Input ownership, decided rather than incidental.** Wheel deltas are normalized through
  `event.deltaMode`. The line-mode calibration was 16px, which made one Firefox notch travel about
  half as far as the same notch in Chrome; it is now 40, the value `normalize-wheel` settled on. A
  zoom gesture outranks a scrollable window body — pinching inside a long list zooms the desktop
  rather than doing nothing — while the plain wheel still belongs to the body. Trackpad pinch is
  Ctrl+wheel, which is why it and Ctrl+wheel have always shared one code path.
- **Chrome that survives zooming out.** Window strokes are drawn in world units inside a zoom-scaled
  frame, so a 1px border rendered as `1 × zoom` screen pixels — a tenth of a pixel at 10% zoom.
  Borders, the header rule, and the inner frame thinned to nothing exactly when the user zoomed out to
  see how their windows relate. Every stroke now reads `--icx-chrome-stroke`, published by the frame
  and clamped so nothing renders below one screen pixel. Above 100% zoom it changes nothing.
- **Keyboard command layer.** Hotkeys bound to the same command vocabulary the pointer interactions
  use, so anything the mouse can do the keyboard can express. Includes **directional window focus**
  (`Alt+Arrow`): the nearest window strictly ahead along the arrow wins, and one whose span overlaps
  yours on the cross axis beats one that is merely closer — so arrow keys never drift diagonally and
  Right-then-Left returns you where you started. A chord the command surface owns is swallowed even
  when its command is unavailable, so a focus move at the edge of your windows cannot fall through to
  the browser's Back and take the document with it.
- **Camera navigation commands.** Programmatic camera moves — focus a window, frame the selection,
  fit the world, zoom to a point — as commands rather than imperative camera pokes.
- **Versioned, document-scoped persistence.** Canvas state serializes to a versioned envelope, keyed
  per document, and is validated and recovered on read: unknown window kinds and stale references are
  dropped rather than crashing the canvas. The envelope is at `version: 2`; a `version: 1` payload
  (which predates groups) still parses and migrates to `groups: []`. Making `groups` an optional field
  on `version: 1` would have looked backward-compatible right up until an older build read a newer
  payload, dropped the field it did not know, and wrote back a layout with every group deleted.
- **Typed drag and drop.** A drop-target contract with spatial resolution, so a payload dropped on
  the canvas resolves to the window (or the empty canvas region) actually underneath it, in canvas
  coordinates.
- **Read-only R3F / WebGPU scene layers, as an opt-in entry.** `sceneLayers` render React Three
  Fiber content above or below the DOM window plane on a transparent WebGPU surface, in camera-owned
  world space or DOM-aligned screen space, backed by projected window proxies. The surface itself
  ships from `@infinite-canvas/react/scene` and is injected via the `sceneSurface` prop, which makes
  `three` and `@react-three/fiber` genuinely optional peers: the main entry never reaches them, so a
  consumer who does not render scene content can leave both uninstalled. Passing `sceneLayers`
  without a `sceneSurface` warns in development rather than silently rendering nothing.
- **Window groups.** Windows compose into a group shell: a world object that owns a local layout and
  moves as one thing. Inside, an n-ary container tree arranges them as a `split` (weighted panes with
  draggable seams), `tabs` (one visible child behind a tab strip), or an `accordion`. Nine canonical
  mutations — create, close, dock, undock, move/resize the shell, change layout mode, activate a
  child, reweight children, reorder — so pointer, keyboard, and programmatic drivers compile to the
  same vocabulary.

  **The group is the source of truth and a member's `rect` is its projection.** Every mutation
  re-solves the tree and writes the result back onto `window.rect`, which is what keeps snapping,
  selection bounds, camera framing, persistence, and the scene-layer window proxies group-blind. A
  window belongs to at most one tree; closing or minimizing one detaches it; removing the last member
  destroys the shell.

  Dragging a grouped window's header moves its shell as one world object. Dragging the seam between
  two split panes reweights them — every step recomputes from the container as it stood when the drag
  began, so the seam stays under the cursor rather than drifting as rounding accumulates. Dragging a
  tab out of its strip tears the window free and hands the same pointer to a normal window move; it
  keeps the rect the solver gave it, which for a hidden tab is the size it would have been revealed
  at. Docking by drag is not built yet; its command and hit-test exist. Resizing a grouped window
  directly is refused: a pane is resized by its seam.

- **Custom window chrome.** Replace the default header, controls, and corners wholesale via
  `renderFrame`, or slot into the existing frame. `renderFrame` is memoized on the window's own
  identity and is **not** re-invoked when the camera moves — a window's chrome must not reconcile on
  every pan frame. Its `context.state` is live at call time; implementations that need to re-render
  when state changes should subscribe with `useInfiniteCanvasSelector` inside their own components,
  so invalidation stays scoped to what they read. This is the contract `renderBody` already has.
- **Headless styling contract.** Framework components emit a stable `data-slot` attribute
  vocabulary and no visual identity; `@infinite-canvas/react/theme.css` is an opt-in cascade layer
  over that contract, so consumer styles always win. Enforced by a boundary test.
- **Accessibility contract.** Windows expose `role="group"`, an accessible name, and
  `aria-roledescription="window"`; the active window is marked with `aria-current`. Every
  framework-rendered button has an accessible name, and unavailable commands are `disabled`.
  The Close and Minimize controls return DOM focus to the command surface before they unmount,
  because focus falling to `<body>` silently kills every hotkey with nothing to tell the user why.
- **Packaging gate.** `scripts/verify-artifact.mjs` asserts, on every build and before publish, that
  the JS entry is marked `"use client"` and the declaration files are _not_ (a directive prologue is
  a statement, and would fail every consumer without `skipLibCheck`), that `@zumer/snapdom` stays
  dynamically imported, that `three` and `@react-three/fiber` are reachable only from `./scene` and
  never from the main entry — not even through a dynamic `import()`, which bundlers resolve eagerly —
  that every top-level import in every chunk is a declared dependency or peer, and that the type
  declarations emit.
- **Experimental programmatic handle.** `createInfiniteCanvasHandle(store)` exposes a state
  snapshot, the typed command facade, and contextual command descriptors for automation and testing.
- **Drivable by synthetic input.** Every pointer interaction — move, resize, pan, marquee, and drop —
  listens from mount rather than attaching after React commits the pointerdown. A
  `pointerdown → pointermove → pointerup` sequence dispatched in one synchronous block does what it
  says, which is how automation and browser-mode tests drive a canvas.

[Unreleased]: https://github.com/tyler-mitchell/infinite-canvas/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/tyler-mitchell/infinite-canvas/releases/tag/v0.1.0
