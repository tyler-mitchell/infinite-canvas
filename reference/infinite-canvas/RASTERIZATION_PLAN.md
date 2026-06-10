# Infinite Canvas Rasterization Plan

This document is the active research and implementation plan for making
zoomed-out canvas content readable without abandoning the framework's current
WebGPU/R3F + Legend State foundation.

The current framework keeps arbitrary React window bodies in a DOM plane and
uses the WebGPU/R3F surface for the spatial scene. That hybrid seam remains the
right base. The rasterization system should add explicit level-of-detail and
snapshot rendering lanes instead of trying to make one CSS primitive solve every
zoom level.

## Research Conclusions

### Figma Is Not CSS-Only

Figma's public engineering writing points toward a custom GPU renderer, not a
DOM/CSS scaling trick. Their WebGPU renderer work emphasizes explicit draw-call
state, batching, shader processing, GPU buffers, and fallback handling. Earlier
Figma writing described the product as effectively building a browser inside a
browser for high-fidelity design editing.

Framework implication: we should use modern browser primitives where they are
strong, but the closest path to Figma-like behavior is a deliberate LOD pipeline
with GPU-backed representations, not pure DOM scaling.

Sources:

- <https://www.figma.com/blog/figma-rendering-powered-by-webgpu/>
- <https://www.figma.com/blog/building-a-professional-design-tool-on-the-web/>

### CSS `zoom` Is Useful, But Not A Full Rasterization Strategy

CSS `zoom` is now broadly available and has real value for live DOM clarity. It
scales layout, unlike `transform: scale()`, and can avoid some scaled-text blur.
However, it is not animatable, it changes layout coordinate behavior, and it is
not a snapshot/cache/texture mechanism.

Local probe:

- `left: 100px; zoom: 0.5` measured at `x: 50`, not `x: 100`.
- To keep a world rect at a fixed screen position with CSS zoom, the projected
  `left`/`top` must be compensated by dividing by zoom, or the framework must
  use a screen-space outer wrapper and zoom an inner body.

Recommendation: use CSS zoom only through a framework-owned scaling adapter,
not ad hoc on every body node.

Sources:

- <https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/zoom>
- <https://caniuse.com/css-zoom>

### Container Queries Help LOD, But Need The Right Wrapper

The prior claim that container queries automatically switch content based on CSS
zoomed size is not generally true. In a direct probe, a 400px container with
`zoom: 0.5` had a 200px bounding rect, but its `@container (max-width: 300px)`
rule did not apply because the layout container width was still 400px.

This does not invalidate container queries. It means the framework should expose
a screen-space wrapper whose actual CSS width is `worldWidth * zoom`, then zoom
or transform the inner content. Container queries can then respond to effective
screen size, while the inner body can still use a clarity strategy.

Sources:

- <https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_containment/Container_queries>
- <https://caniuse.com/css-container-queries>

### View Transitions Are Polish, Not The Renderer

Single-document View Transitions are now viable across current major browsers.
They can smooth a full-body to summary-body threshold change, and they are worth
supporting as progressive enhancement. They should not be the canonical state
machine because transitions can be skipped, respect browser constraints, and
produce temporary snapshots rather than durable raster assets.

Recommendation: use View Transitions only around explicit LOD mode swaps, and
disable them during drag/resize/zoom streams or reduced-motion mode.

Sources:

- <https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API>
- <https://caniuse.com/view-transitions>

### CSS `element()` Is Not A Practical Framework Primitive

`element()` is a live CSS image primitive, but it is not viable for a Chrome /
Safari-centered web app today. MDN marks it limited and experimental, and Can I
Use shows Chrome and Safari unsupported with only Firefox support.

This is distinct from the Chrome `chrome://flags/#canvas-draw-element` path.
That flag enables the HTML-in-Canvas proposal (`drawElementImage`,
`captureElementImage`, and related canvas/GPU primitives), not the CSS
`element()` function used as `background: element(#id)`.

Recommendation: do not build the framework around `element()`.

Sources:

- <https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/element>
- <https://caniuse.com/css-element-function>

### `content-visibility` Is Still Worth Keeping

`content-visibility: auto` can reduce work for offscreen DOM bodies, and
`content-visibility: hidden` can preserve rendering state while skipping
rendering. It does not create readable zoomed-out content and does not replace
snapshot caching.

Recommendation: keep it as a culling/performance support primitive with
`contain-intrinsic-size`, not as the main LOD mechanism.

Sources:

- <https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/content-visibility>
- <https://caniuse.com/css-content-visibility>

### DOM Capture Libraries Are A Bridge

Client-side DOM-to-image libraries are useful as a first snapshot adapter, but
they are inherently a compatibility bridge around browser limitations.

Best candidate right now: `@zumer/snapdom`.

Why:

- Actively maintained and current.
- No dependencies.
- Exports SVG/PNG/JPG/WebP/canvas/blob.
- Uses standard APIs and SVG `foreignObject`.
- Has cache controls, font/image options, plugin hooks, and published benchmark
  claims against `html2canvas` and `html-to-image`.

Risk:

- It is still library-mediated DOM serialization, so CORS, fonts, SVG
  `foreignObject`, WebKit quirks, and exact CSS feature coverage remain risks.

Fallback candidate: `modern-screenshot`.

Avoid as primary: `html2canvas`. Its own FAQ says full CSS support is not
possible because each CSS property must be manually implemented.

Sources:

- <https://github.com/zumerlab/snapdom>
- <https://www.npmjs.com/package/modern-screenshot>
- <https://html2canvas.hertzen.com/faq/>

### HTML-in-Canvas Is The Future-Native Lane

The WICG HTML-in-Canvas proposal is the most important emerging primitive for
this framework. It defines `drawElementImage`, `captureElementImage`, and
WebGL/WebGPU equivalents for drawing real browser-rendered HTML into canvas and
GPU textures. That is much closer to the dream than CSS `element()`.

Current reality:

- Official docs still describe it as behind `chrome://flags/#canvas-draw-element`.
- Local Chrome 147 without the feature flag: unavailable.
- Local Chrome 147 with `--enable-features=CanvasDrawElement`:
  `drawElementImage` available, `captureElementImage` not available.
- Local Chrome Canary 149 with `--enable-features=CanvasDrawElement`:
  both `drawElementImage` and `captureElementImage` available.

Recommendation: design the rasterization system with an adapter slot for
HTML-in-Canvas, but ship a non-flag fallback first.

Sources:

- <https://github.com/WICG/html-in-canvas>
- <https://html-in-canvas.dev/docs/browser-support/>

## Recommended Architecture

Use a five-lane LOD/raster pipeline:

1. **Live DOM lane**
   - Used near normal zoom and for focused/editing windows.
   - Add a framework-owned scaling strategy: `transform-scale`,
     `css-zoom-compensated`, or `screen-wrapper-css-zoom`.
   - Default candidate: screen wrapper for effective-size LOD, with carefully
     measured CSS zoom behavior for the inner content.

2. **Semantic LOD lane**
   - Consumers can provide `renderSummary` and `renderIcon` representations.
   - Thresholds should be based on effective screen size, not raw zoom alone.
   - This is the only lane that truly solves readability at far zoom. No
     rasterized paragraph remains legible at 12% without semantic substitution.

3. **Snapshot lane**
   - Inactive, non-editing windows can switch to cached snapshots at medium/far
     zoom or during expensive interactions.
   - First implementation can render snapshots as DOM `<img>` elements in the
     existing body plane.
   - Later implementation can upload snapshots to Three/WebGPU texture planes.

4. **Native HTML-in-Canvas lane**
   - Feature-detected adapter for `drawElementImage` / `captureElementImage` /
     WebGPU texture copy when browser support becomes real enough.
   - This should share the same cache/representation contract as the snapshot
     lane so we can swap implementation without changing consumer APIs.

5. **Far proxy lane**
   - At extreme zoom, represent windows as stable, readable labels, icons,
     counts, and shape hints.
   - This should be vector/DOM/GPU text, not a downscaled screenshot.

## Proposed Framework API Shape

```ts
type InfiniteCanvasRasterPolicy = Readonly<{
  cacheBudgetMb: number;
  captureScale: number;
  enabled: boolean;
  freezeSnapshotsDuringInteraction: boolean;
  liveDomMinEffectiveWidth: number;
  nativeHtmlInCanvas: "auto" | "off" | "required";
  snapshotMinEffectiveWidth: number;
  strategy: "auto" | "transform-scale" | "css-zoom" | "screen-wrapper-css-zoom";
  transitionLodSwaps: boolean;
}>;

type InfiniteCanvasWindowDefinition<Kind extends string = string> = Readonly<{
  getRasterKey?: (context: InfiniteCanvasWindowRenderContext<Kind>) => string;
  renderBody?: (context: InfiniteCanvasWindowRenderContext<Kind>) => ReactNode;
  renderIcon?: (context: InfiniteCanvasWindowRenderContext<Kind>) => ReactNode;
  renderSummary?: (context: InfiniteCanvasWindowRenderContext<Kind>) => ReactNode;
  rasterMode?: "auto" | "live-only" | "snapshot-only" | "semantic-only";
}>;
```

The cache must live outside serialized Legend state. The serializable model
should store windows, camera, selection, and policies; snapshot blobs,
ImageBitmaps, object URLs, and native handles are runtime resources.

## Implementation Slices

### Slice 0: Lab And Measurement

Status: started.

- Add `/experiments/infinite-canvas-raster-lab`.
- Compare `transform: scale`, compensated CSS `zoom`, and screen-wrapper CSS
  `zoom`.
- Show browser feature probes for CSS zoom, container queries, View
  Transitions, `element()`, and HTML-in-Canvas.
- Use the lab before changing the production canvas projection.

### Slice 1: LOD Contracts, No Snapshots Yet

- Add raster policy types and defaults.
- Add `renderSummary` / `renderIcon` to window definitions.
- Derive each window's effective screen rect from the existing canonical camera
  projection.
- Render live/full, summary, or icon bodies through the existing DOM plane.
- Keep active/focused/native-text-selection windows live.
- Add tests for pure LOD selection helpers.

### Slice 2: CSS Zoom Scaling Adapter

- Introduce a single body scaling adapter in `InfiniteCanvasWindowFrame`.
- Compare `screen-wrapper-css-zoom` against current `transform-scale` in the lab.
- Only enable CSS zoom behind `rasterPolicy.strategy`.
- Verify pointer targeting, outside-click deselection, wheel panning, marquee,
  resizing, and text selection suppression.

### Slice 3: Snapshot Adapter And Runtime Cache

Status: first framework slice implemented for performance experiments.

- Add runtime-only snapshot cache keyed by window id, raster key, theme, DPR,
  capture scale, and effective mode.
- Use `@zumer/snapdom` behind dynamic import for first implementation.
- Render cached snapshots as DOM images first.
- Revoke object URLs and enforce a memory budget.
- Keep cache invalidation explicit and testable.

Current implementation notes:

- Rasterization is contained behind `rasterization-layer`, `rasterization`, and
  `window-raster-body`; the core window frame only composes the adapter.
- The SnapDOM path uses the reusable `snapdom(element)` result and reads
  `CaptureResult.url` for SVG snapshots, avoiding an unnecessary SVG image
  decode.
- Captures are paused while pointer interactions are active, then resumed after
  the canvas returns to idle.
- Automatic background capture is bounded by `maxPendingCaptures` so large
  stress scenes do not commit the browser to rasterizing every window at once.
- Stress showcase routes default to a lower window count; larger pathological
  load tests should be added as explicit routes or lab controls instead of
  hiding mode changes in query parameters.
- This slice is about reducing live DOM pressure. Readability at far zoom still
  belongs to semantic LOD / summary / icon lanes.

### Slice 4: WebGPU Texture Presentation

- Convert snapshot blobs/ImageBitmaps into Three textures.
- Use mipmaps and filtering intentionally for far zoom.
- Keep hit testing/accessibility in the DOM body plane or semantic proxy lane.

### Slice 5: HTML-in-Canvas Adapter

- Add feature detection for `drawElementImage`, `captureElementImage`, and any
  WebGPU texture-copy method that reaches stable browsers.
- Use the same raster adapter contract as the snapshot lane.
- Ship as progressive enhancement only until no-flag browser support is
  dependable.

## Acceptance Criteria

- At 12-25% zoom, windows remain identifiable without needing to zoom back in.
- Focused/editing windows remain live DOM.
- Inactive windows can use summary/icon/snapshot representations without losing
  selection, focus, panning, resizing, or keyboard command behavior.
- The implementation has no browser-flag requirement.
- Flag-gated HTML-in-Canvas can be tested from the lab without becoming a
  dependency for normal users.
- Snapshot cache memory is bounded and object URLs are always released.
