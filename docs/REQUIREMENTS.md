# Infinite Canvas framework requirements

> Provenance: adapted on 2026-06-10 from `project-requirements.md` in the kek-monorepo.
> The source document dates from 2026-04-22, when implementation started.
> This version removes old proof-of-concept sections and adds status.
> It also records DOM chrome as host-owned instead of scene-owned.

## 1. Product definition

The product is a general React framework for spatial applications with multiple windows. The playground is a
normal consumer of the public API.

## 2. Core definition

`@react-three/fiber` and WebGPU render the spatial surface. React DOM renders application content inside
windows. The framework manages windows, chrome, overlays, and effects. The public API uses React composition.

## 3. Scope

| Scope   | Capabilities                                                                                                    |
| ------- | --------------------------------------------------------------------------------------------------------------- |
| In      | Infinite 2D desktop behavior, movable and resizable windows, focus, z-order, snapping, docking, and tiling.     |
| In      | Configurable surfaces and chrome, React DOM bodies, persistence, keyboard and pointer input, and accessibility. |
| Outside | Diagram editing and node-edge editing are not product features. Connector helpers remain building blocks.       |
| Outside | Whiteboards, freehand drawing, document editing, and 3D world navigation are not product features.              |

## 4. Functional requirements

Status values are `done`, `partial`, and `open`.

### FR-1 Correct infinite-canvas primitives: done

The framework uses an orthographic camera for pan, zoom, and world-to-screen projection. The DOM layer derives
CSS and screen placement from the same camera. Device-pixel snapping is part of the projection contract. The
projection must prevent drift, jitter, and precision loss across the supported zoom range.

### FR-2 First-class window management: done

The framework can open, close, focus, blur, pin, unpin, minimize, maximize, restore, move, and resize windows.
It also manages z-order. Window state is explicit and subscribable. Renderer state cannot hide window state.

### FR-3 Pure window operations: done

Pure functions implement rectangle changes, focus transitions, stacking, snapping, and keyboard placement.
Reducer, geometry, and snap tests do not require rendering.

### FR-4 Advanced spatial behavior: partial

| Status | Behavior                                                                                                              |
| ------ | --------------------------------------------------------------------------------------------------------------------- |
| Done   | Edge, center, gap, and active-edge resize snapping. Multiple-window selection, group movement, and keyboard movement. |
| Open   | Drag-to-edge tiling, halves, quarters, thirds, keyboard arrangement, group resize, and docking groups.                |

See [research/grouping-and-docking.md](research/grouping-and-docking.md). Each behavior must remain a
separate, composable module.

### FR-5 Hybrid GPU and DOM rendering: done

WebGPU owns the programmable spatial and visual layer. React DOM owns window chrome and bodies. Both layers
use the same camera.

DOM content does not enter the WebGPU render pass. Scene geometry cannot appear between DOM descendants.
Full-frame GPU effects do not change DOM content.

The source requirement placed chrome on the GPU layer. The implementation moved core chrome into the
transformed DOM host. This change prevents drift between chrome and body content. Scene layers contain
decorative content and world content.

### FR-6 Programmable visual layer: partial

Consumers can configure desktop appearance, chrome, focus, hover, guides, previews, and shader effects without
R3F internals.

| Status | API                                                                                                                    |
| ------ | ---------------------------------------------------------------------------------------------------------------------- |
| Done   | `renderFrame`, `sceneLayers`, and the `theme` color object.                                                            |
| Open   | Headless and styled distributions, data-slot attributes, design tokens, theme.css, and guide and marquee theme inputs. |

### FR-7 React API: done

Consumers mount one component and register window kinds. They can open windows through declarative and
imperative APIs. Hooks expose state and documented extension points. Consumers do not need R3F, Three, WebGPU,
or coordinate calculations.

### FR-8 Input ownership: partial

The framework routes pointer input across GPU and DOM layers. It also manages keyboard input, focus handoff,
pointer capture, and drag isolation.

Input policy, the shortcut guard, and pointer capture are implemented. Open work covers body-focus handoff,
pinch policy, and modifier zoom. See [zoom-policy.md](zoom-policy.md).

### FR-9 Accessibility: partial

Windows use `role="group"` and `aria-roledescription="window"`. The active window uses `aria-current`.
Framework buttons have accessible names. `src/accessibility.test.tsx` covers these semantics.

Directional focus is implemented through `window.focusDirection` and `Alt+Arrow`. The algorithm selects the
nearest window that is strictly ahead. It prefers a window whose span overlaps on the cross axis. This rule
prevents diagonal drift.

If no window has focus, an arrow selects the window nearest the camera center. The command uses `focusWindow`.
Pointer and keyboard input use the same mutation. The camera moves only when the selected window is
not fully visible. The pure geometry lives in `src/window-focus.ts`.

The command surface consumes each chord that it owns. It also consumes the chord when its command is
unavailable. This rule prevents `Alt+ArrowLeft` from opening browser history at the edge of the window set.

Close and minimize restore focus to the highest remaining window. `closeWindow` and `minimizeWindow` use that
fallback. Their controls return DOM focus to the command surface before they unmount. Without this transfer,
focus moves to `<body>` and hotkeys stop.

FOCUS-001 group-local focus is implemented. Directional focus searches the current group first. It searches
outside the group only when no member is in that direction. An inactive tab and a collapsed fold are not focus
targets.

Group tab strips use one tab stop. A tab remains a native `<button>`. A roving `tabIndex` moves with Arrow,
Home, and End.

Enter or Space activates a tab through the same `onClick` as pointer input. Manual activation prevents each
arrow key from mounting and removing a window body.

Keyboard resize uses `Alt+Shift+Arrow`. It calls `resizeRectFromHandle` and obeys `minSize`. The origin stays
fixed. Only the east and south edges move. The step is ten screen pixels.

The camera converts that step to
world units. Thus, the step does not change with zoom.

The frame traps Tab input inside the active window. Tab input from the command surface enters the active body.
Escape returns focus to the command surface. Browser and screen-reader evidence remains open. Open, focus,
move, resize, arrange, and close all have a chord.

On 2026-07-09, `role="tab"` gained `aria-controls`. Each window frame has a DOM `id`. React `useId()` creates
a canvas instance token at the desktop root. The window and group layers share that token. The format

`${instanceId}-window-${windowId}` stays unique across two canvases.

A tab uses its `childId` as the window identifier. Thus, each tab controls its related panel. The preview
browser showed a valid `aria-controls` value for each tab. The active tab referenced its rendered frame.

Inactive tab panels mount only after activation. Their references resolve after activation. This is the
standard lazy-tabpanel pattern. The frame identifier helper remains internal. It supplies the current focus
path.

The shortcut guard protects editable targets.

### FR-10 Serializable desktop state: partial

| Status | Behavior                                                             |
| ------ | -------------------------------------------------------------------- |
| Done   | JSON state for windows, rectangles, z-order, camera, and selection.  |
| Done   | Versioned, validated, document-scoped persistence.                   |
| Open   | Desktop undo and redo, command coalescing, and saved layout recipes. |

The command layer can support transactions. See
[research/state-focus-and-recipes.md](research/state-focus-and-recipes.md).

## 5. Non-functional requirements

### NFR-1 Performance: met at its stated limit and unmeasured beyond it

The stated limit is ten active windows without visible frame-rate loss. This limit applies to pan, zoom, move,
and resize. Background and inactive windows must support throttling. The rasterization lanes provide this
mechanism.

The /stress route is the measurement surface.

The document corrected this status on 2026-07-08. It previously said "failing as of 2026-06-10". It also said
"interaction degrades at even ~20 live windows". Measurements from the same day contradicted those statements.

Commit `962e42c` restored memoization for window body content. At 20 windows, pan changed from 15.6 fps to
96.9 fps. At 20 windows, drag changed from 4.4 fps to 58.3 fps. At 40 windows, pan changed from 8.2 fps to
52.1 fps.

As a result, the ten-window requirement passed with additional capacity.

The measurements used the embedded preview browser. That browser limits `rAF` under load. The ratios and
slopes remain evidence. Absolute values require real hardware.

P2 has a different target. It requires 100 windows at 60 fps for pan, zoom, and drag. At 80 windows, pan was
21.3 fps. Passing NFR-1 does not complete P2.

P2 tranche 1 added frame-chrome memoization. The listed measurements do not include that change. The change
remains unmeasured.

See [research/performance-profile.md](research/performance-profile.md). The same evidence source remains
[research/performance-profile.md](research/performance-profile.md).

Risk R15 tracks this work. See [research/risk-register.md](research/risk-register.md).

### NFR-2 Modularity

Geometry, projection, reducers, rendering, input, and the consumer API have separate boundaries. The
`infinite-canvas.tsx` composition module did not meet this requirement. The headless extraction must prevent
further growth.

### NFR-3 Functional core

Core functions are pure and composable by default. They use immutable data flow. Side effects stay at system
boundaries.

### NFR-4 Browser support

Chromium is the baseline browser. When WebGPU is unavailable, Firefox and Safari must keep a usable DOM plane.
The WebGPU guard already permits that behavior.

## 6. Technical constraints

The framework uses React 19, strict TypeScript, and Vite. The scene entry uses `@react-three/fiber` v10 through
`/webgpu`, with a canary pin until a stable release exists. Legend State 3 is the current adapter. The pure
core must permit another adapter, and its review remains open.

The framework does not depend on tldraw, React
Flow, or similar canvas frameworks.

## 7. Success criteria

A consumer with no internal framework knowledge can do these tasks:

1. Mount an infinite-canvas desktop with one component. Status: done.
2. Register a window kind that renders a React application. Status: done.
3. Open, close, move, resize, snap, and tile windows. Status: tiling open.
4. Apply a custom theme without R3F code. Status: theme work open.
5. Serialize and restore a desktop layout. Status: done.
