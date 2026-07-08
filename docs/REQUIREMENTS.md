# Infinite Canvas Framework — Requirements

> Provenance: adapted 2026-06-10 from kek-monorepo's `project-requirements.md`
> (authored 2026-04-22, the day the official implementation began). Updated for
> the standalone framework: stale POC sections dropped, statuses added, and the
> chrome-ownership language corrected to match the architecture the framework
> actually settled on (host-local DOM chrome, not scene-owned chrome).

## 1. Product Definition

A general-purpose infinite-canvas window-management framework for React,
general enough for any application that needs a spatial, multi-window canvas
environment. The demo playground is a thin consumer, never a privileged one.

## 2. Core Definition

A desktop-like environment where:

- the spatial surface is GPU-rendered with `@react-three/fiber` and WebGPU
- application windows contain arbitrary React DOM content
- window management is first-class
- chrome, overlays, and effects are programmable
- the consumer-facing API is React-native and composable

## 3. Scope

### In Scope

- infinite 2D desktop canvas behavior
- multiple movable and resizable windows
- focus and z-order management
- snapping, docking, and tiling behaviors
- programmable desktop surface and window chrome
- DOM-rendered window body content
- layout persistence and restoration
- keyboard and pointer interaction at desktop scope
- accessibility foundations for windowed interaction

### Out of Scope (as product features)

- diagramming / node-edge graph editing as a product (graph _primitives_ such
  as connector helpers are in scope as consumer building blocks)
- whiteboarding, freehand drawing, document editing
- 3D world navigation

## 4. Functional Requirements

Status legend: `done` (implemented and test-covered), `partial`, `open`.

### FR-1 Correct Infinite Canvas Primitives — done

Mathematically correct 2D canvas on an orthographic camera: pan, zoom,
world↔screen projection, CSS/screen placement for DOM content. Stable across a
wide zoom range without drift, jitter, or precision collapse (device-pixel
snapping is part of the projection contract).

### FR-2 First-Class Window Management — done

Open, close, focus, blur, pin/unpin, minimize, maximize, restore, move,
resize, z-order. Window state is explicit, subscribable data — never hidden
renderer state.

### FR-3 Pure Window Operations — done

Window-management behaviors are pure functions over state: rect updates, focus
transitions, stacking, snap calculations, keyboard arrangement. Testable
without rendering (the reducer/geometry/snap suites are the proof).

### FR-4 Advanced Spatial Behaviors — partial

- done: edge/center/gap snapping, active-edge resize snapping, multi-window
  selection, group move, keyboard nudge
- open: drag-to-edge tiling, halves/quarters/thirds placement commands,
  keyboard-driven arrange, group resize, docking groups (see
  [research/grouping-and-docking.md](research/grouping-and-docking.md))

Behaviors must stay modular and composable, not one interaction monolith.

### FR-5 Hybrid GPU + DOM Rendering — done

Explicit, documented boundary: the WebGPU surface owns the programmable
spatial/visual layer; window chrome and bodies are DOM, projected from the
same canonical camera. Hard constraints stay honest: arbitrary DOM content
does not participate in the WebGPU render pass, cannot be depth-interleaved
with scene geometry, and full-frame post-processing does not affect it.

(Original doc assigned chrome to the GPU layer; the implementation reversed
this after cross-layer drift — core chrome must live in the same transformed
DOM host as the body. Scene layers are for decorative/world content.)

### FR-6 Programmable Visual Layer — partial

Extension points for desktop surface appearance, window chrome, focus/hover
states, snap guides and tiling previews, shader-driven effects — without
consumers needing R3F internals.

- done: `renderFrame` slots, `sceneLayers`, `theme` color object
- open: the headless extraction + styled distribution track (data-slot
  attributes, design tokens, theme stylesheet); snap-guide/marquee theming

### FR-7 Clean React API — done

Mount with one component, define/register window kinds, open windows
declaratively or imperatively, subscribe through hooks, extend through
documented points. Consumers don't need R3F/Three/WebGPU/coordinate math.

### FR-8 Input Event Unification — partial

Pointer events across GPU and DOM layers, keyboard at desktop scope, focus
management between desktop and window contents, drag without DOM event
interference. Largely implemented (input policy, shortcut guard, pointer
capture); edge cases around body-content focus handoff and gesture routing
(pinch policy, modifier zoom) remain — see [zoom-policy.md](zoom-policy.md).

### FR-9 Accessibility Foundations — partial

- done: ARIA semantics for windows and framework chrome (`role="group"`,
  `aria-roledescription="window"`, `aria-current` on the active window, an
  accessible name on every framework button), locked by
  `src/accessibility.test.tsx`
- done: **directional window focus** (`Alt+Arrow`) — `window.focusDirection`
  picks the nearest window strictly ahead along the arrow, preferring one whose
  span overlaps yours on the cross axis so arrow keys never drift diagonally.
  With nothing focused, any arrow enters at the window nearest the camera
  center. Focus reuses `focusWindow`, so keyboard and pointer compile to the
  same mutation, and the camera only recentres when the target is not already
  fully on screen. Pure geometry in `src/window-focus.ts`.
- done: the command surface swallows any chord it owns, even when the command is
  unavailable — otherwise `Alt+ArrowLeft` at the edge of your windows falls
  through to the browser's Back and takes the document with it.
- done: focus restoration when the active window leaves. `closeWindow` and
  `minimizeWindow` fall back to the topmost remaining window, and the Close and
  Minimize controls hand DOM focus back to the command surface before they
  unmount — otherwise focus falls to `<body>` and every hotkey silently stops
  working, with no way for the user to tell why.
- done: **group-local focus** (FOCUS-001). Inside a group the arrow searches the
  group's own members first and only leaves it when nothing lies that way — a pane
  docked beside you is the neighbour the user means, even when a floating window
  sits geometrically closer. Windows behind an inactive tab or a collapsed fold are
  never focus targets, because nothing draws them.
- done: **group tab strips are one tab stop, not one per tab.** Every tab was a
  natively focusable `<button>`, so Tab walked all of them — three groups of four
  tabs put twelve stops between the user and anything else. The tablist now carries
  a roving `tabIndex` and moves between tabs with Arrow / Home / End. Activation is
  manual (Enter or Space, through the same `onClick` the pointer uses): arrowing
  across a strip under automatic activation would mount and discard a window body
  per tab.
- open: focus trapping policy, and a documented path to accessible controls
  inside window content.
- open: `role="tab"` carries no `aria-controls`, because a window frame has no DOM
  `id` to point at — only `data-infinite-canvas-window-id`. Minting one means
  deciding how ids stay unique across two canvases on one page.

The shortcut guard protects editable targets today.

### FR-10 Serializable and Restorable Desktop State — partial

- done: JSON-serializable state (windows, rects, z-order, camera, selection),
  versioned + validated persistence, document-scoped storage
- open: undo/redo at the desktop level (command layer is transaction-ready;
  coalescing is not built), saved layout recipes (see
  [research/state-focus-and-recipes.md](research/state-focus-and-recipes.md))

## 5. Non-Functional Requirements

### NFR-1 Performance — **met at its stated bar; unmeasured beyond it**

At least 10 simultaneous windows without obvious frame-rate degradation during
pan/zoom/move/resize. Background and unfocused windows throttleable (the
rasterization lanes exist for this; the /stress showcase is the measuring
stick).

**Corrected 2026-07-08.** This section read "failing as of 2026-06-10" and
"interaction degrades at even ~20 live windows" for a month after the
measurement that contradicted it. `962e42c` restored body-content memoization
that afternoon and
[research/performance-profile.md](research/performance-profile.md) recorded the
result: at 20 windows, pan went 15.6 fps → **96.9 fps** and drag 4.4 fps → 58.3
fps; at 40 windows, pan 8.2 fps → 52.1 fps. The bar this requirement actually
states — ten windows — is cleared with headroom, and the document defining the
requirement went on claiming otherwise. That is the drift this project keeps
finding, in the file least able to afford it.

Three caveats, so the correction does not overshoot:

- Measured in the **embedded preview browser**, which underclocks `rAF` under
  load. The ratios and slopes are the finding; absolute numbers want real
  hardware.
- **P2's target is not this bar.** 100 windows at 60 fps pan/zoom/drag is the
  roadmap's exit criterion, and 80 windows currently pan at 21.3 fps. NFR-1
  passing does not make P2 done.
- **P2 tranche 1 (frame-chrome memoization) is landed and unmeasured.** No
  number above reflects it. See
  [research/performance-profile.md](research/performance-profile.md), which says
  so in its own tranche-1 section.

Tracked as risk R15 in
[research/risk-register.md](research/risk-register.md).

### NFR-2 Modularity

No Godfiles. Separated boundaries: geometry/projection, pure reducers,
rendering layers, input orchestration, consumer API. (The current
`infinite-canvas.tsx` composition file is the one module trending against
this; watch it during the headless extraction.)

### NFR-3 Functional Core

Pure composable functions by default, immutable data flow, side effects pushed
to boundaries.

### NFR-4 Browser Support

Baseline: Chromium. Firefox/Safari degradation must be graceful (the WebGPU
surface guard exists; DOM plane works without it).

## 6. Technical Constraints

- React 19, TypeScript strict
- `@react-three/fiber` v10 via the `/webgpu` entry (canary pin until stable)
- Vite
- state behind an adapter boundary — Legend State 3 is the current adapter;
  the pure core must stay swappable (re-evaluation deferred, not abandoned)
- no dependency on tldraw, React Flow, or similar canvas frameworks

## 7. Success Criteria

The framework succeeds when a consumer with no knowledge of its internals can:

1. mount an infinite-canvas desktop with one component ✓
2. define a window kind that renders their own React app inside it ✓
3. open, close, move, resize, snap, and tile windows through UI and API
   (tiling pending)
4. apply a custom visual theme without touching R3F internals (theme track
   pending)
5. serialize and restore a complete desktop layout ✓
