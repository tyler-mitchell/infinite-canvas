# Infinite Canvas Framework

This module is the active framework surface for the infinite canvas experiment.

## Shape

- `types.ts`: public model, window definition, and command contracts
- `geometry.ts`: pure projection, zoom, resize, and grid derivation
- `camera-navigation.ts`: pure camera target resolution and framing behavior
- `stacking.ts`: pure focus, pinning, and z-order policy
- `interaction.ts`: pure pointer gesture lifecycle
- `snap.ts`: public snap exports
- `snap-candidates.ts`: pure snap anchor and candidate extraction
- `snap-resolver.ts`: pure move and resize snap resolution
- `reducer.ts`: deterministic state transition boundary
- `persistence.ts`: versioned JSON serialization and hydration helpers
- `store.tsx`: Legend State signal adapter and framework hooks
- `infinite-canvas.tsx`: React/WebGPU/DOM composition layers
- `sample-layout.tsx`: consumer-style window definitions for the experiment

## Boundary

The viewport composes one camera-synchronized grid backdrop, a transparent
WebGPU canvas for the spatial surface, and an ordinary React DOM window plane.
The reducer is state-library agnostic; `store.tsx` adapts it to
`@legendapp/state` so consumers get signal-based subscriptions without putting
observable mutation inside core derivation logic.

## Extension Posture

The framework should stay general-purpose even when consumer projects feel
game-like. Future WebGPU extension points should use neutral concepts such as
scene layers, window proxies, external drag payloads, drop affordances, and
window decorations. DOM window frames should also be customizable through a
framework-owned frame renderer so consumers can replace chrome without
recreating move, resize, focus, body projection, or raster policy. Consumers can
model inventory, maps, simulations, or knowledge spaces above those primitives
without the framework learning their domain.

Custom scene content should receive read-only camera, viewport, proxy,
selection, and command context. Mutation should flow back through framework
actions rather than direct Three object edits, DOM body reads, or raw Legend
State access.

## Prototype Lineage

This framework is the continuation of the working
`infinite-canvas-r3f-frame-legend` proof of concept, not a rejection of it. Keep
the proven foundation intact:

- `@react-three/fiber/webgpu` remains the rendering entry for the spatial/GPU
  surface.
- `@legendapp/state` remains the runtime state adapter because the framework is
  expected to benefit from signal-style subscriptions as the window graph grows.
- The GPU/DOM boundary stays explicit: WebGPU owns the programmable spatial
  visual layer; arbitrary React window bodies stay in the DOM composition plane.

Future refactors should preserve those bets unless the shipped dependency stack
materially changes.

## Current Framework Capabilities

- Consumer factories for creating canonical windows, states, and typed window
  registries without hand-filling volatile runtime fields.
- ArkType-backed parsing for persisted layout payloads, plus registry-aware
  state normalization so stale persisted window kinds are dropped before render.
- Window lifecycle commands: open, close, focus, minimize, maximize, restore, and
  pin.
- Headless window-presence helpers for dock, taskbar, and tray UIs that need
  active, visible, pinned, and minimized window groups without reaching into raw
  window arrays.
- Controlled custom frame slots through `renderFrame`, so consumers can replace
  window chrome while keeping framework-owned drag, focus, selection, controls,
  body policy, rasterization, and resize handles.
- Read-only R3F scene layer slots through `sceneLayers`, backed by projected
  window proxies for background objects, drop affordances, diagnostics,
  and decorative effects that should not own the core DOM window frame. Scene
  layers can opt into `space: "world"` for camera-owned canvas content or
  `space: "screen"` for DOM-coupled visual effects that must align with window
  screen rects.
- Graph visual geometry helpers for connector paths, orthogonal routes, scene
  segment transforms, label/progress positions, and future path motion.
- Spatial target resolution for pointer/drop points, including empty world,
  window areas, resize handles, and consumer-provided targets through ordered
  resolver phases. Overlay and scene-layer render contexts expose
  `resolveSpatialTarget(viewportPoint)` so consumers can render hover,
  drag, and inspector affordances without reimplementing framework hit order.
- Typed drag/drop contracts with opaque consumer payloads threaded through
  desktop props, overlay contexts, scene-layer contexts, target validation,
  valid/invalid/outside drop status, and framework-owned drop commits.
- Selection model with replace/add/toggle/clear/select-all semantics, marquee
  selection, selected-window group move, and typed non-window targets for
  consumer-owned scene objects or edges.
- Keyboard command layer backed by `@tanstack/hotkeys` core for cancel,
  select-all, fit-all, fit-selection, nudge, and reset-zoom.
- Contextual command queries expose enabled command descriptors for the current
  canvas state so overlays, inspectors, and scene stages can render available
  actions without duplicating command availability rules.
- Camera navigation request model that frames windows, selections, visible
  windows, world points, or arbitrary rects with center, center-at-zoom, or fit
  behavior.
- Input policy for empty-canvas drag behavior, visible marquee/pan mode controls
  beside zoom, pan as the default mode, conventional arrow cursors by default,
  continuous pinch zoom, a 12% default zoom-out floor, policy-driven wheel
  sensitivity, and trackpad-friendly two-finger pan on the canvas surface.
  Consumers can override zoom behavior through `zoomPolicy` and cursor policy
  through `inputPolicy.cursor`. Window bodies can opt back into native wheel scrolling with
  `wheelBehavior: "native-scroll"` and native text selection with
  `textSelection: "native"`.
- Versioned layout persistence through the `storageKey` prop on
  `InfiniteCanvas.Desktop`, scoped by `documentKey` when both are provided so
  distinct workspaces do not hydrate each other's layouts.
- Snap previews while moving and resizing windows, with screen-pixel-stable
  thresholds, edge guides, center guides, equal-gap guides, and active-edge
  resize snapping. Viewport/safe-area snapping is intentionally opt-in through
  `snapPolicy` because the viewport is not a persistent world object.
- Camera-synchronized CSS grid rendering that avoids the large WebGPU background
  plane seam while preserving a transparent WebGPU surface for programmable
  scene content.
- Narrower Legend-powered subscriptions in the viewport shell so high-frequency
  pointer handlers can read the latest state from the signal boundary without
  subscribing the shell to every window change.

## Showcase Harness

Framework demos are route-backed stages, not query-param modes:

- `/experiments/infinite-canvas`: normal sample document
- `/experiments/infinite-canvas/custom-frames`: custom frame slot stage
- `/experiments/infinite-canvas/scene-chrome`: host-local chrome stage that
  demonstrates frame/body sync while reserving R3F scene layers for world
  effects and drop affordances
- `/experiments/infinite-canvas/scene-layers`: world-space scene helper stage
  for DOM windows with routed graph connectors and projected labels
- `/experiments/infinite-canvas/workflow-board`: workflow board stage anchored
  to conventional card-and-connector canvas UX. It combines live DOM cards,
  graph connectors, typed drops, connector selection/reconnect/delete actions,
  dock restore/focus, workspace switching, and camera navigation.
- `/experiments/infinite-canvas/spatial-targets`: compatibility alias for the
  workflow board while existing links are still in circulation
- `/experiments/infinite-canvas/drop-tray`: conventional asset-palette stage
  with card drops onto open canvas space or another card body, live R3F
  placement previews, and normal DOM window commits
- `/experiments/infinite-canvas/stress-live`: live DOM stress stage
- `/experiments/infinite-canvas/stress-raster`: rasterized stress stage
- `/experiments/infinite-canvas/frustum-devtools`: visibility/frustum stage
- `/experiments/infinite-canvas/raster-devtools`: raster scheduler/devtools
  stage
- `/experiments/infinite-canvas/original-proof`: preserved proof-of-concept
  comparison route

The routes are declared through TanStack virtual subroutes under
`apps/web/src/routes/experiments/infinite-canvas/__virtual.ts`. Showcase bodies
live in `showcases/` so new framework stages can be added without turning the
main route into a mode switchboard.

## Consumer Quick Start

Use the canonical barrel from `#/experiments/infinite-canvas`. The sibling
`infinite-canvas-old` and `infinite-canvas-r3f-*` directories are reference or
prototype surfaces, not the framework entry point.

```tsx
import {
  InfiniteCanvas,
  createInfiniteCanvasState,
  createInfiniteCanvasWindow,
  defineInfiniteCanvasWindowRegistry,
  type InfiniteCanvasWindowRegistry,
} from "#/experiments/infinite-canvas";

type WindowKind = "note" | "control";

const windowDefinitions = defineInfiniteCanvasWindowRegistry<WindowKind>({
  control: {
    kind: "control",
    renderBody: ({ actions }) => (
      <button
        onClick={() => {
          actions.navigateToWindow({ windowId: "note-1" });
        }}
        type="button"
      >
        Focus note
      </button>
    ),
  },
  note: {
    kind: "note",
    renderBody: ({ window }) => <div>{window.title}</div>,
  },
} satisfies InfiniteCanvasWindowRegistry<WindowKind>);

const initialState = createInfiniteCanvasState({
  windows: [
    createInfiniteCanvasWindow({
      id: "note-1",
      kind: "note",
      rect: { height: 260, width: 360, x: 0, y: 0 },
      title: "First note",
    }),
  ],
});

function MyCanvas() {
  return (
    <InfiniteCanvas.Desktop
      initialState={initialState}
      documentKey="my-project-document"
      storageKey="my-project.infinite-canvas.v1"
      title="My Project"
      windowDefinitions={windowDefinitions}
    />
  );
}
```

Important consumer rules:

- `InfiniteCanvas.Desktop` fills its parent. The consumer owns workspace
  sizing: put the desktop inside a bounded host such as a flex child with
  `h-full min-h-0 overflow-hidden`, or an explicit-height container for embedded
  canvases. Keep `min-h-0` through flex ancestors so HUD controls, window DOM,
  and WebGPU layers remain inside the visible workspace.
- Empty documents are valid. When windows are present, every `window.kind` must
  exist in `windowDefinitions`, and registry keys must match each definition's
  `kind`. Window ids should be unique; if duplicate ids reach the framework, the
  last window with that id wins and selection/focus are normalized.
- Persisted layouts are parsed with ArkType and normalized against the registry.
  Windows whose kinds no longer exist are removed before hydration, malformed
  window entries are skipped when other valid windows remain, invalid persisted
  camera data falls back to the framework baseline camera, and stale
  selection/focus ids are normalized away.
- `initialState`, `windowDefinitions`, `snapPolicy`, and `zoomPolicy` are
  mount-time framework inputs. If a route intentionally swaps documents or
  scenarios, pass a stable `documentKey`; the framework remounts its internal
  provider boundary for that document identity and scopes persisted layout under
  that identity when `storageKey` is also present.
- Pass `hotkeyBindings` to `InfiniteCanvas.Desktop` when a project needs to
  replace the default command shortcuts with a smaller or app-specific set.
- Window bodies are normal React DOM. Use `renderBody` for app content and the
  `actions` object for framework commands; do not reach into renderer internals.
- Use `actions.navigateToWindow`, `actions.navigateToPoint`,
  `actions.navigateToRect`, or the lower-level `actions.navigateView` when app
  code needs to frame a graph neighborhood, source record, dropped object, or
  tool-created region programmatically.
- Use `getInfiniteCanvasWindowPresence` for dock, taskbar, tray, or running-tool
  overlays. The helper groups active, visible, pinned, and minimized windows
  while preserving framework lifecycle commands such as `restoreWindow` and
  `focusWindow`.
- Use `renderFrame` only when the app needs custom chrome. Compose the provided
  frame slots (`Surface`, `Header`, `Title`, `Controls`, `Body`, and
  `ActiveCorners`) so framework-owned interaction wiring stays intact.
- Use `frameChrome: "host"` when the built-in chrome should use the
  host-local visual style from the scene-chrome stage. The older
  `frameChrome: "scene"` value is kept as a compatibility alias, but new code
  should use `"host"` so core frames are not confused with R3F scene layers.
- Use `sceneLayers` for WebGPU/R3F content. Leave `space` unset for true
  world-space canvas content that pans and zooms with the camera. Use
  `space: "screen"` when rendering R3F effects around DOM windows. Scene
  layer context exposes `windows` and `getWindowProxy`, whose proxies include
  `screenRect`, `screenCenter`, `screenPosition`, and `screenSize` derived from
  the same projection used by the DOM window layer.
- Scene layers should use `visibleWindows` and `visibleRect` when work can be
  culled to the current viewport. `visibleRect` always matches the layer's
  `space`; `visibleWorldRect` and `visibleScreenRect` remain available when a
  layer intentionally bridges both coordinate spaces.
- Use `getInfiniteCanvasWindowConnectorPath`,
  `getInfiniteCanvasWorldPathSceneTransforms`, and
  `getInfiniteCanvasWorldPathPointAtProgress` for graph-style connectors,
  labels, route badges, and motion along paths before hand-rolling path math in
  scene-layer code.
- Use `spatialTargetResolvers` when a consumer-owned overlay, scene object, or
  edge needs to participate in pointer/drop targeting. Resolvers should return
  domain-neutral target descriptors and leave business rules to `dropPolicy` or
  app commands. Prefer the exported
  `createInfiniteCanvasSceneObjectTargetResolver`,
  `createInfiniteCanvasEdgeTargetResolver`, and
  `createInfiniteCanvasOverlayTargetResolver` helpers before writing custom
  resolver math. Inside `renderOverlay` or `sceneLayers`, call
  `context.resolveSpatialTarget(viewportPoint)` to reuse the same ordered
  window/body/scene/edge targeting pipeline for live readouts and command UI.
- Use `actions.selectTarget`, `actions.toggleTargetSelection`, and
  `actions.setTargetSelection` when a scene object or edge should participate in
  the framework selection model without becoming a DOM window. Selection targets
  intentionally carry only `type`, `kind`, `id`, and optional opaque `data`.
- Use `context.contextualCommands` in `renderOverlay` and `sceneLayers` when a
  consumer UI needs to show available actions for the current selection or
  canvas state. Execute those descriptors through `actions.executeCommand` so
  keyboard, toolbar, and agent-driven flows stay on the same command path.
- For conventional board, mind-map, and whiteboard diagrams, prefer
  `getInfiniteCanvasWindowConnectorSegment` and
  `getInfiniteCanvasWorldSegmentSceneTransform` over hand-rolled edge math.
  They trim connectors to window edges in world space and return an R3F-ready
  transform that uses the framework's y-axis convention.
- Do not use scene layers as the default implementation path for core window
  frames. Core frames must stay in the same transformed host as the DOM body so
  drag, resize, and zoom cannot create cross-layer visual drift. Use
  `renderFrame` or `frameChrome` for host-local chrome, and reserve R3F scene
  layers for effects that can tolerate being visually decorative.
- Use `wheelBehavior: "native-scroll"` or `textSelection: "native"` only for
  window bodies that need browser-native scrolling or text selection.

## Validation

Focused framework checks:

```bash
vp test apps/web/src/experiments/infinite-canvas/agent-consumer-smoke.test.tsx apps/web/src/experiments/infinite-canvas/framework-boundary.test.ts apps/web/src/experiments/infinite-canvas/geometry.test.ts apps/web/src/experiments/infinite-canvas/input-policy.test.ts apps/web/src/experiments/infinite-canvas/keyboard.test.ts apps/web/src/experiments/infinite-canvas/persistence.test.ts apps/web/src/experiments/infinite-canvas/reducer.test.ts apps/web/src/experiments/infinite-canvas/visibility.test.ts --run
vp exec tsc --project apps/web/tsconfig.json --noEmit --pretty false
vp lint apps/web/src/experiments/infinite-canvas apps/web/src/routes/experiments/infinite-canvas.tsx apps/web/src/routes/experiments/infinite-canvas-raster-lab.tsx
```

## Planning

- `FEATURE_TRACKER.md`: active feature, capability, hardening, and next-tranche
  planning surface for the framework.
- `R3F_V10_CAPABILITY_IDEAS.md`: source-led React Three Fiber v10 capability
  ledger for ideas that still need lab validation before promotion.
