# html-in-canvas status and design implications

> Owner directive (2026-06-10):
>
> 1. Make html-in-canvas a Chrome-first design constraint.
> 2. Detect the feature at runtime.
> 3. Use html-in-canvas as the primary capture path.
> 4. Use snapdom as the fallback.
> 5. Continue the work while other browsers lag.

This document records source evidence from 2026-06-10.
Each Chrome release requires a new status review.
The API is in "early development, implementation details might change."

## Status on 2026-06-10

- Chrome 148–150 stable supplied the API through an Origin Trial.
  Local development also used `chrome://flags/#canvas-draw-element`.
  The estimate for stable release without a flag was late 2026, subject to Origin Trial data.
  Firefox and Safari had no stated support plans.
- The embedded preview used Electron 41 and Chrome 146.
  This browser did not contain the API.
  Runtime tests require Chrome 148 or later with the flag or an Origin Trial token.
  The playground server can register a token when the prototype starts.

## Origin Trial API

- `<canvas layoutsubtree>` makes the browser lay out content inside the canvas element.
- `ctx.drawElementImage(element, x, y)` draws a descendant element into a 2D context.
- `canvas.getElementTransform(element, screenSpaceTransform)` supplies the mapping transform.
  The browser also applies it to `style.transform` for event coordinates.
- `canvas.onpaint` and `canvas.requestPaint()` supply invalidation.
  `paint` fires after a drawn element changes, such as during typing or text selection.
  The handler applies updates synchronously.
- `gl.texElementImage2D(...)` supplies the WebGL texture path.
- `device.queue.copyElementImageToTexture(element, { texture })` supplies the WebGPU texture path.
  Its shape follows `copyExternalImageToTexture`.
- `canvas.captureElementImage(element)` returns a transferable `ElementImage` for OffscreenCanvas or worker use.

## Architectural constraints

1. Source elements must be descendants of `<canvas layoutsubtree>`.
   Thus, live window bodies require the DOM body plane inside a canvas subtree.
   This requirement changes composition.
2. Drawn content remains interactive and accessible.
   Hit testing, text selection, IME, context menus, the accessibility tree, and find-in-page continue to operate.
   Events use the element transform.
   This behavior exceeds the RASTERIZATION_PLAN "snapshot pixels are dead" model.
   A continuous GPU body plane can preserve FR-8 and FR-9.
3. `onpaint` supplies a capture invalidation signal and answers "when to recapture".
   Snapshot caching used idle callbacks and interaction pauses to estimate this signal.

The browser blocks cross-origin iframe content. Scrolling and animation inside the canvas require JavaScript updates.
The Chrome source identifies this limit as a performance concern for scrollable bodies.

## Framework use

- The raster adapter uses `captureElementImage` or `drawElementImage` as the primary path when the API exists.
  snapdom remains the fallback path.
  RASTERIZATION_PLAN slices 4 and 5 can share one path because `copyElementImageToTexture` writes GPU textures directly.
- R15 has two prototype levels.
  First, texture-mode-during-camera-motion shows cached textures during pan and zoom, then restores live DOM after motion.
  This level changes only the capture path.
  Second, the canvas-subtree body plane keeps windows inside `<canvas layoutsubtree>` and presents them through the GPU.
  Measurements from the first level are a prerequisite for the second level.
  Firmer Origin Trial and interoperability evidence are also prerequisites.
- FR-6 shader effects can operate on live window content after GPU presentation exists.

## Next steps

1. Add `supportsHtmlInCanvas()` with the raster adapter work.
   Make the helper examine a 2D context for `drawElementImage`.
2. Test the API in Chrome 148 or later.
   Enable `chrome://flags/#canvas-draw-element` or register an Origin Trial token for localhost.
3. Prototype texture-mode-during-camera-motion on /stress.
4. Before you select a presentation level, measure it against subscription narrowing.

Sources: [Chrome blog: HTML-in-Canvas origin trial](https://developer.chrome.com/blog/html-in-canvas-origin-trial),
[ChromeStatus entry](https://chromestatus.com/feature/5172548013916160),
[WICG/html-in-canvas](https://github.com/WICG/html-in-canvas).
