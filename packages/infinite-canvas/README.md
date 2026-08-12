# @hyphened/infinite-canvas

An infinite-canvas window manager for React: a pure reducer core, real DOM window bodies, and a programmable WebGPU spatial surface.

## Install

```bash
npm install @hyphened/infinite-canvas react react-dom
```

The package ships no renderer of its own. It declares four peers, two of which are optional:

| Peer                 | Range                         | Required?                                  |
| -------------------- | ----------------------------- | ------------------------------------------ |
| `react`              | `^19.0.0`                     | yes                                        |
| `react-dom`          | `^19.0.0`                     | yes                                        |
| `three`              | `>=0.181.0`                   | only for `@hyphened/infinite-canvas/scene` |
| `@react-three/fiber` | `>=10.0.0-canary.dbbe704 <11` | only for `@hyphened/infinite-canvas/scene` |

Windows, panning, zooming, selection, snapping, drag & drop, and persistence need no 3D engine. `three` and `@react-three/fiber` are reachable only from the `@hyphened/infinite-canvas/scene` entry — the main entry never imports them, statically or dynamically — so if you do not render scene layers you can leave both uninstalled and they never enter your bundle. A `<InfiniteCanvasDesktop>` with no scene layers is **~40 KB gzipped**.

To render scene layers, install the 3D peers and pass the surface in:

```bash
npm install three @react-three/fiber
```

```tsx
import { InfiniteCanvasWebGpuSurface } from "@hyphened/infinite-canvas/scene";

<InfiniteCanvasDesktop
  sceneLayers={sceneLayers}
  sceneSurface={InfiniteCanvasWebGpuSurface}
  {...rest}
/>;
```

`@react-three/fiber` must be a v10 release — the current `9.x` line does not satisfy the range. Install the matching canary explicitly if your package manager resolves `latest`.

## Quick start

```tsx
"use client";

import {
  InfiniteCanvasDesktop,
  createInfiniteCanvasState,
  createInfiniteCanvasWindow,
  defineInfiniteCanvasWindowRegistry,
} from "@hyphened/infinite-canvas";

type WindowKind = "note";

const windowDefinitions = defineInfiniteCanvasWindowRegistry<WindowKind>({
  note: {
    kind: "note",
    renderBody: ({ window }) => <p>{window.title}</p>,
  },
});

const initialState = createInfiniteCanvasState<WindowKind>({
  windows: [
    createInfiniteCanvasWindow({
      id: "note-1",
      kind: "note",
      rect: { height: 240, width: 360, x: 0, y: 0 },
      title: "First note",
    }),
    createInfiniteCanvasWindow({
      id: "note-2",
      kind: "note",
      rect: { height: 240, width: 360, x: 440, y: 120 },
      title: "Second note",
    }),
  ],
});

export function Workspace() {
  return (
    <div style={{ height: "100dvh" }}>
      <InfiniteCanvasDesktop initialState={initialState} windowDefinitions={windowDefinitions} />
    </div>
  );
}
```

Every `window.kind` must have a matching entry in `windowDefinitions`, and each registry key must equal its definition's `kind` — both are checked at mount and throw otherwise. Empty documents (`windows: []`) are valid.

### Typing `window.data`

Pass a second type argument to type each kind's payload:

```ts
type Kind = "chart" | "note";
type DataByKind = { chart: { series: number[] }; note: { text: string } };

const windowDefinitions = defineInfiniteCanvasWindowRegistry<Kind, DataByKind>({
  chart: { kind: "chart", renderBody: ({ window }) => plot(window.data?.series) },
  note: { kind: "note", renderBody: ({ window }) => <p>{window.data?.text}</p> },
});
```

The types apply while you write the registry and are then erased — `window.data` really is `unknown` at runtime, because it round-trips through `JSON.parse` on hydration. **If you persist the canvas, validate on read** with `getInfiniteCanvasWindowData(window, guard)`. A `renderBody` that trusts `window.data` out of `localStorage` is trusting a string the user can edit.

## Sizing: the one rule

`InfiniteCanvasDesktop` fills its parent (`width: 100%; height: 100%`). **The parent must have a bounded height.** Give it an explicit height, or make it a flex child with `minHeight: 0` — and keep `minHeight: 0` on every flex ancestor, or the canvas grows past the visible workspace and the HUD, window DOM, and WebGPU layers scroll out of view.

## Styling is optional

The package is headless. Components emit structure, geometry, and a `data-slot="…"` attribute vocabulary; they carry no visual identity of their own. The canvas is fully functional unstyled — mount it without importing anything and you get a working, colourless canvas, because the framework emits `--icx-*` custom properties only for the theme keys you actually pass.

`src/headless-boundary.test.ts` enforces the two ways that guarantee has been broken in practice: no framework source imports an icon library, and none emits a literal `className="…"`. It does not — and this is deliberate, not an oversight — forbid inline `style` colour, because the two **debug overlays** (`InfiniteCanvasRasterHud`, `InfiniteCanvasVisibilityHud`) are styled inline on purpose. They render only when you opt into `rasterization` or `diagnostics.frustum`, they are not part of the public export surface, and a debug panel that inherits your theme is a debug panel you cannot read.

To get the default look, import the theme once:

```ts
import "@hyphened/infinite-canvas/theme.css";
```

It is a single `@layer infinite-canvas` cascade layer targeting the `data-slot` contract, so unlayered consumer styles always win. Strokes drawn inside a window read `--icx-chrome-stroke`, which the framework widens as you zoom out so a 1px border never renders sub-pixel. You can skip it entirely and write your own CSS against the same selectors, or pass the `theme` prop to override the bridged `--icx-*` custom properties.

## What you get

- **Window lifecycle** — open, close, focus, minimize, maximize, restore, and pin, through one typed command facade.
- **Selection and marquee** — replace / add / toggle / clear, select-all-visible, group move, plus typed non-window selection targets for consumer-owned scene objects and edges.
- **Snapping with guides** — edge, center, and equal-gap guides while moving and resizing, with screen-pixel-stable thresholds and hysteresis (a caught guide holds until you pull `releaseThreshold` away, so nothing flickers on the boundary). Viewport snapping is opt-in through `snapPolicy`.
- **Keyboard commands** — `Escape`, `Mod+A`, `Shift+1` (fit all), `Shift+2` (fit selection), arrow-key nudge, `Alt+Arrow` (focus the neighbouring window — group members first, and a floating window over a group searches that group first too), `Shift+0` (reset zoom), `Alt+Shift+Arrow` (resize the active window), `Mod+Shift+Arrow` (place it in a half of the visible canvas), `Mod+Shift+Enter` (fill it); replaceable through `hotkeyBindings`. The vocabulary reads: bare arrow moves a little, `Shift` moves a lot, `Alt` moves focus, `Alt+Shift` changes the shape, `Mod+Shift` tiles, and `Shift+<digit>` frames the view. Centring and the quarter-tiles are commands with no default chord, because the canvas `preventDefault()`s every chord it owns and the obvious candidates are browser devtools shortcuts. Reset zoom is `Shift+0` rather than the conventional `Mod+0` for the same reason: the browser's zoom accelerators are not page-cancellable, so `Mod+0` would have reset the page zoom too. A chord the canvas owns is swallowed even when its command is unavailable, so a focus move at the edge of your windows can never fall through to the browser's Back. A group's tab strip is a single tab stop with `Arrow`/`Home`/`End` moving between tabs and `Enter`/`Space` activating, rather than one tab stop per tab.
- **Camera navigation** — frame a window, the selection, all visible windows, a world point, or an arbitrary rect, with `center`, `centerAtZoom`, or `fit` behavior.
- **World overview** — `getInfiniteCanvasMinimapLayout` projects windows, groups, and the camera's visible rect into a box of your choosing, and `getInfiniteCanvasMinimapWorldPoint` inverts it for click-to-navigate. Pure geometry; you draw the pixels. The camera's rect is unioned into the bounds, so panning into empty space shrinks the map rather than losing your position marker off the edge of it.
- **Offscreen indicators** — `getInfiniteCanvasOffscreenIndicators` returns everything you have panned away from, nearest first, each with the point on the viewport edge to draw at, the angle to rotate an arrow by, and the rect to navigate to. The minimap answers "where am I"; this answers "where did my window go" without asking you to look at anything. A group is one indicator, not one per pane. Pure geometry; you draw the chevron.
- **Persistence** — versioned JSON layouts through `storageKey`, scoped by `documentKey`, structurally validated on hydration and normalized against your registry so stale window kinds are dropped before render.
- **Typed drag & drop** — an opaque payload generic threaded through `dropPolicy.canDrop` / `onDrop`, overlay and scene-layer contexts, and valid / invalid / outside drop status. Add `dropPolicy.placement` and the drop snaps like a window move, with the framework drawing the guides; `onDrop` receives the exact placement the preview showed.
- **R3F scene layers** — `sceneLayers` render read-only React Three Fiber content above or below the DOM window plane, in camera-owned `space: "world"` or DOM-aligned `space: "screen"`, backed by projected window proxies.
- **Window groups** — windows compose into a group shell that owns a local layout and moves as one world object: `split` panes with weights, `tabs`, or an `accordion`. The group's tree owns member placement, and each member's `rect` is re-derived from it, so nothing else in the framework has to know what a group is. **Alt+drag** a floating window over another to dock them into a group; a region overlay shows where it lands, and alignment guides step aside while you aim. Drag a member's header to move the shell, its outer edge to resize the whole group, a seam to reweight panes, a tab along its strip to reorder it, or a tab out of its strip to tear the window free. A grouped window has no resize handles of its own: a pane is resized by its seam, the shell by its edge. The shell stops at a structural minimum — gutters, tab strips, accordion headers, and a floor per pane — rather than at any member's `minSize`, which the group solver has never consulted.
- **Undo / redo** — `Mod+Z`, `Mod+Shift+Z`. History is over the document (windows and groups); panning and selecting are not edits. A drag is one entry, checkpointed when it begins. Bounded at 100 entries, session-scoped, never serialized.
- **Layout recipes** — capture a named arrangement and put it back anywhere. Recipes name windows by id, translate rather than scale (so nothing is squeezed below its `minSize`), and are plain serializable values you own. Applying one is a single undo entry.
- **Portal roots** — window bodies live inside a `transform`, which breaks `position: fixed` for every floating-UI library. `<InfiniteCanvasPortal scope="window">` mounts content outside the transform, tracking the window at natural size; `scope="desktop"` escapes the window entirely. Opt in per window kind with `portalRoot: true`.
- **Custom frames** — `renderFrame` composes framework-owned slots (`Surface`, `Header`, `Title`, `Controls`, `Body`, `ActiveCorners`) so you can replace chrome without reimplementing drag, resize, focus, or body projection.

`renderFrame` and `renderBody` are both memoized on the window's identity and are not re-invoked when the camera moves — window content must not reconcile on every pan frame. Their `context.state` is live at call time. If your frame or body needs to re-render when canvas state changes, subscribe with `useInfiniteCanvasSelector` inside your own component, so invalidation stays scoped to what you actually read.

## Status

**0.1.0 — pre-1.0. The API may change between minor versions.**

The public surface is **312 stable names and 42 experimental ones**, classified per module in
[`scripts/api-stability.json`](https://github.com/tyler-mitchell/infinite-canvas/blob/main/packages/infinite-canvas/scripts/api-stability.json)
and enforced in CI. A stable export's breaking change is called out in the changelog; an
experimental one may move or vanish in any release, and each says why it is experimental — it
is unobserved, off by default, or reachable only through the R3F canary. The experimental set is
the rasterization lane, the frustum-visibility store and its diagnostics policy,
`createInfiniteCanvasHandle`, the minimap and offscreen-indicator geometry, and the whole
`/scene` entry. (An export that is merely _unconsumed_ is not classified experimental — it is
removed; the pre-proxy `scene-model` and `window-scene-shell` surfaces went that way.)

What exists is what is documented above. Notably **not** implemented yet:

- focus trapping, and a documented path to accessible controls inside window bodies.
  Group-local focus and group tab-strip keyboard navigation both landed; what remains
  is deciding how DOM focus enters and leaves a window's own content.
- focus trapping inside a window body (see above). Since 2026-07-09 a window frame carries a real
  DOM `id` (`useId()`-namespaced, unique across two canvases) and a group `role="tab"` points its
  `aria-controls` at the panel it reveals — browser-verified — so that specific gap is closed; what
  remains is how DOM focus enters and leaves the body.

Rasterization / level-of-detail is partial: the policy, scheduler, and snapshot capture exist behind the `rasterization` prop and are off by default.

There is no hosted documentation site. The full export surface is catalogued in [`docs/API.md`](https://github.com/tyler-mitchell/infinite-canvas/blob/main/docs/API.md).

## Requirements

- **React 19.** The library is client-only; the built entry points are marked `"use client"`.
- **A WebGPU-capable browser**, but only if you use `@hyphened/infinite-canvas/scene` — that surface renders through `@react-three/fiber/webgpu`. Development is Chrome-first.
- ESM only. There is no CommonJS build.

## License

MIT © Tyler Davis Mitchell
