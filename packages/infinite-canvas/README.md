# @hyphened/infinite-canvas

This React window manager has a pure reducer, DOM window bodies, and a programmable WebGPU scene.

## Install

Install the package and its required peers:

```bash
npm install @hyphened/infinite-canvas react react-dom
```

The main entry does not include a renderer. The package declares two required peers and four optional ones:

| Peer             | Range     | Required?                                  |
| ---------------- | --------- | ------------------------------------------ |
| `react`          | `^19.0.0` | yes                                        |
| `react-dom`      | `^19.0.0` | yes                                        |
| `typegpu`        | `^0.12.3` | only for `@hyphened/infinite-canvas/scene` |
| `@typegpu/react` | `^0.12.0` | only for `@hyphened/infinite-canvas/scene` |
| `@typegpu/sdf`   | `^0.12.0` | only for `@hyphened/infinite-canvas/scene` |
| `@typegpu/noise` | `^0.12.0` | only for `@hyphened/infinite-canvas/scene` |

The main entry includes the core canvas features and never imports the GPU stack. Its gzip size without the compositor is approximately 40 KB. The optional entry is `@hyphened/infinite-canvas/scene`.

Every GPU package is an optional peer rather than a dependency, so a project that only uses the DOM plane installs none of them. `verify-consumer-install.ts` packs the tarball into a clean project and fails if any of them appears.

If you use the compositor, install all four:

```bash
npm install typegpu @typegpu/react @typegpu/sdf @typegpu/noise
```

`typegpu` compiles `"use gpu"` functions with a build plugin, so add it to your bundler as well:

```ts
import typegpu from "unplugin-typegpu/vite";

export default defineConfig({ plugins: [typegpu()] });
```

Then pass the surface to `<InfiniteCanvasDesktop>`:

```tsx
import { InfiniteCanvasCompositorSurface } from "@hyphened/infinite-canvas/scene";

<InfiniteCanvasDesktop sceneSurface={InfiniteCanvasCompositorSurface} {...rest} />;
```

Without WebGPU the surface mounts nothing and the DOM window plane stands on its own.

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

Each `window.kind` must have an entry in `windowDefinitions`. Each registry key must equal the definition `kind`. The component examines both conditions during mount. It throws if either condition fails. An empty `windows: []` document is valid.

Use the same flat action payload for framework commands and targeted mutations:

```tsx
import { useInfiniteCanvasDispatch } from "@hyphened/infinite-canvas";

type WindowKind = "note";

function CanvasControls() {
  const dispatch = useInfiniteCanvasDispatch<WindowKind>();

  return (
    <>
      <button onClick={() => dispatch({ type: "window.focus", windowId: "note-1" })}>Focus</button>
      <button onClick={() => dispatch({ type: "history.undo" })}>Undo</button>
      <button onClick={() => dispatch({ type: "view.fitAll" })}>Fit all</button>
    </>
  );
}
```

### Type `window.data`

Use a second type argument for the payload of each kind:

```ts
type Kind = "chart" | "note";
type DataByKind = { chart: { series: number[] }; note: { text: string } };

const windowDefinitions = defineInfiniteCanvasWindowRegistry<Kind, DataByKind>({
  chart: { kind: "chart", renderBody: ({ window }) => plot(window.data?.series) },
  note: { kind: "note", renderBody: ({ window }) => <p>{window.data?.text}</p> },
});
```

The type checker applies these payload types to the registry. TypeScript erases them at runtime. Hydration reads `window.data` through `JSON.parse`, so the value is `unknown`. If you persist the canvas, validate each payload with `getInfiniteCanvasWindowData(window, guard)`. Treat `renderBody` `window.data` from `localStorage` as untrusted input.

## Set the parent size

`InfiniteCanvasDesktop` fills its parent with `width: 100%; height: 100%`. The parent must have a bounded height. Give the parent an explicit height, or make it a flex child with `minHeight: 0`. Each flex ancestor must also have `minHeight: 0`.

Without these limits, the canvas can grow past the workspace and move its HUD, DOM, and WebGPU layers out of view.

## Add styles

The package is headless. Its components emit structure, geometry, and `data-slot="…"` attributes. They add `--icx-*` properties only for supplied theme values. The canvas works without a stylesheet and has no default visual design.

`src/headless-boundary.test.ts` rejects icon imports and literal `className="…"` values. It does not reject inline `style` values.
The debug overlays use inline styles. `InfiniteCanvasRasterHud` and `InfiniteCanvasVisibilityHud` require `rasterization` or `diagnostics.frustum`. The package does not export them.

Import the default theme once:

```ts
import "@hyphened/infinite-canvas/theme.css";
```

The stylesheet uses one `@layer infinite-canvas` cascade layer and targets the public `data-slot` contract. As zoom decreases, the canvas increases `--icx-chrome-stroke` so a one-pixel border remains visible. You can omit the theme and write CSS for the same slots. The `theme` prop overrides bridged `--icx-*` properties.

If your application uses cascade layers, declare their order before the imports:

```css
@layer infinite-canvas, components, utilities;
```

This declaration keeps `infinite-canvas` before `utilities`. Unlayered styles override every layer. If the application imports `@import "tailwindcss"`, keep slot overrides in `components`.

## Features

- **Window lifecycle.** The typed dispatch API opens, closes, focuses, minimizes, maximizes, restores, and pins windows.
- **Selection.** The canvas supports replace, add, toggle, clear, marquee, group movement, and typed consumer targets.
- **Snapping.** Move and resize operations use edge, center, and equal-gap guides. Thresholds remain stable in screen pixels. `snapPolicy` controls hysteresis and viewport snapping.
- **Camera navigation.** Actions use `center`, `centerAtZoom`, or `fit` behavior for a window, selection, point, or rectangle.
- **World overview.** `getInfiniteCanvasMinimapLayout` projects windows, groups, and the camera rectangle. The camera remains inside the bounds. `getInfiniteCanvasMinimapWorldPoint` converts map points to world points.
- **Offscreen indicators.** `getInfiniteCanvasOffscreenIndicators` returns targets from nearest to farthest. Each group produces one indicator with an angle, edge point, and navigation rectangle.
- **Persistence.** `storageKey` and `documentKey` select versioned JSON layouts. Hydration validates the layout and removes unknown window kinds.
- **Drag and drop.** `dropPolicy.canDrop` checks a typed payload. `dropPolicy.placement` gives the preview and `onDrop` the same snapped placement. The framework draws the guides.
- **Compositor passes.** `sceneLayers` add TypeGPU render or compute passes above or below the DOM window plane. Each pass builds its pipelines once and reads the shared camera and window instances, in `space: "world"` or `space: "screen"`.
- **Semantic detail.** A window kind with `renderSummary` shows its summary below 180 screen pixels. Full content returns above 240 pixels. Hysteresis separates the thresholds.
- **Window groups.** A group shell uses `split`, `tabs`, or `accordion`. `Alt+drag` docks a floating window. Headers move shells, outer edges resize shells, and gutters reweight panes. The tree derives each member `rect` without using `minSize`.
- **Layout recipes.** Recipes translate named serializable arrangements. They do not scale windows below `minSize`. Each recipe application creates one undo entry.
- **History.** `Mod+Z` and `Mod+Shift+Z` change document history. Camera and selection changes do not enter history. History stores 100 session entries and is not serialized.
- **Portal roots.** A window `transform` changes `position: fixed`. The `portalRoot: true` option enables a window portal. `scope="window"` tracks the window at natural size. `scope="desktop"` escapes it.
- **Custom frames.** `renderFrame` supplies `Surface`, `Header`, `Title`, `Controls`, `Body`, and `ActiveCorners`.

The default keyboard map contains these main commands:

| Chord             | Command                             | Chord             | Command                              |
| ----------------- | ----------------------------------- | ----------------- | ------------------------------------ |
| `Escape`          | Cancel the operation                | `Mod+A`           | Select non-minimized desktop windows |
| `Shift+1`         | Frame non-minimized desktop windows | `Shift+2`         | Frame the selection                  |
| `Shift+0`         | Reset zoom                          | Arrow keys        | Nudge the selection                  |
| `Alt+Arrow`       | Move focus                          | `Alt+Shift+Arrow` | Resize the active window             |
| `Mod+Shift+Arrow` | Place in half                       | `Mod+Shift+Enter` | Fill the canvas                      |

Use `hotkeyBindings` to replace these bindings. The canvas applies `preventDefault()` to each owned chord, even for an unavailable command. `Shift` increases movement, `Alt` moves focus, `Alt+Shift` resizes, and `Mod+Shift` places a window. `Shift+<digit>` frames the view.

`Shift+0` resets zoom. The browser owns `Mod+0`, so the map omits `Mod+0`. A group tab strip uses one tab stop. `Arrow`, `Home`, and `End` move focus. `Enter` and `Space` activate a tab.

`renderFrame` and `renderBody` use window identity as their memoization key. Camera movement does not invoke them. `context.state` is current at invocation time. Use `useInfiniteCanvasSelector` in a child component for state updates.

## Status

Version 0.2.0 is pre-1.0 and can change between minor versions.
The [stability manifest](https://github.com/tyler-mitchell/infinite-canvas/blob/main/packages/infinite-canvas/scripts/api-stability.json) is `scripts/api-stability.json`. CI enforces its classes. A stable breaking change appears in the changelog. An experimental export can change or disappear in a release.

The experimental API covers rasterization, frustum visibility, native drops, and the `/scene` entry. The removed `scene-model` and `window-scene-shell` modules are not experimental.

`Tab` from the desktop enters the active window body. `Tab` then cycles inside that body, and `Escape` returns focus to the command surface. The window frame gets a unique DOM `id` from `useId()`. A group `role="tab"` points `aria-controls` to its visible panel.

Rasterization is partial. The `rasterization` prop is off by default. It controls the policy, scheduler, and snapshot capture.

The project has no hosted documentation site. [`docs/API.md`](https://github.com/tyler-mitchell/infinite-canvas/blob/main/docs/API.md) lists the full public API.

## Requirements

- **React 19.** The library is client-only. Each built entry has `"use client"`.
- **A WebGPU browser for the compositor.** `@hyphened/infinite-canvas/scene` uses TypeGPU. Development targets Chrome first.
- **ESM.** The package has no CommonJS build.

## License

MIT © Tyler Davis Mitchell
