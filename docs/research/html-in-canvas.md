# html-in-canvas: Verified Status and Design Implications

> Owner directive (2026-06-10): html-in-canvas is a Chrome-first,
> first-class design constraint — feature-detected, primary capture lane,
> snapdom fallback; lagging browsers are not a blocker. This doc records
> verified API reality as of 2026-06-10 and what it implies. Re-verify at
> each Chrome release; the API is explicitly "early development,
> implementation details might change."

## Verified status (2026-06-10)

- **Chrome 148–150 stable: Origin Trial.** The API is live in stable Chrome
  behind an origin-trial token, or via `chrome://flags/#canvas-draw-element`
  for local dev. Estimated unflagged stable: late 2026, contingent on OT
  metrics. No Firefox/Safari commitment — Chrome-exclusive for the
  foreseeable future (consistent with the directive).
- **Probe caveat:** the embedded preview browser used for playground
  verification is Electron 41 / Chrome 146 — too old, API absent there.
  Real testing requires Chrome 148+ with the flag or an OT token; the
  playground dev server can register a token when we start the prototype.

## API surface (as shipped in the OT)

- `<canvas layoutsubtree>` — attribute that makes the browser lay out
  content nested inside the canvas element.
- `ctx.drawElementImage(element, x, y)` — draw a (descendant) element into
  a 2D context.
- `canvas.getElementTransform(element, screenSpaceTransform)` — transform
  for mapping; also applied back to the element (`style.transform`) to keep
  event coordinates synchronized.
- `canvas.onpaint` / `canvas.requestPaint()` — **the invalidation
  mechanism**: `paint` fires when a drawn element re-renders (typing, text
  highlight); updates are synchronous in the handler.
- `gl.texElementImage2D(...)` — WebGL texture path.
- `device.queue.copyElementImageToTexture(element, { texture })` — WebGPU
  path, mirroring `copyExternalImageToTexture`.
- `canvas.captureElementImage(element)` — snapshot as a transferable
  `ElementImage` (OffscreenCanvas/worker support).

## The three facts that shape our architecture

1. **The descendant constraint is real.** Source elements must be
   descendants of the `<canvas layoutsubtree>` element. Live drawing of our
   window bodies therefore requires the DOM body plane to live inside a
   canvas subtree — a genuine composition change, not an adapter swap.
2. **Drawn content stays fully interactive and accessible.** Hit-testing,
   text selection, IME, context menus, the accessibility tree, and
   find-in-page all keep working; events map through the element transform.
   This is far stronger than the "snapshot pixels are dead" model the
   RASTERIZATION_PLAN assumed — it makes a permanently canvas-presented
   body plane (Figma-grade) conceivable without sacrificing FR-8/FR-9.
3. **There is a real invalidation signal.** `onpaint` answers the
   "when to recapture" question that snapshot caching had to approximate
   with idle callbacks and interaction pauses.

Known limits: cross-origin iframe content is blocked; scrolling/animation
inside the canvas cannot update independently of JS (a real perf
consideration for scrollable bodies — the blog explicitly flags it).

## Posture for the framework

- **Raster pipeline:** html-in-canvas capture
  (`captureElementImage`/`drawElementImage`) becomes the **primary lane
  behind the existing raster adapter contract** where feature-detected;
  snapdom stays as the fallback lane. RASTERIZATION_PLAN slices 4 and 5
  effectively merge: captures can land directly as GPU textures
  (`copyElementImageToTexture`) instead of SVG-blob → image → texture.
- **R15 performance:** two prototype tiers, in order of invasiveness:
  (a) _texture-mode-during-camera-motion_ — capture window textures, present
  them on the WebGPU plane during pan/zoom, swap live DOM back on settle
  (no composition change; capture path only);
  (b) _canvas-subtree body plane_ — windows live inside
  `<canvas layoutsubtree>` and are presented via the GPU continuously,
  exploiting preserved interactivity (big composition change; only after
  (a) is measured and the OT/interop story firms up).
- **FR-6:** shader effects over live window content become real once bodies
  are GPU-presentable.

## Next concrete steps (perf deep-dive prerequisites)

1. Add a feature-detect helper (`supportsHtmlInCanvas()`: checks
   `drawElementImage` on a 2d context) — cheap, land with the raster
   adapter work.
2. Test in real Chrome 148+ with `chrome://flags/#canvas-draw-element` (or
   register an OT token for localhost) — the embedded preview cannot
   exercise the API.
3. Prototype (a) on the /stress stage and measure against subscription
   narrowing before committing to either.

Sources: [Chrome blog — HTML-in-Canvas origin trial](https://developer.chrome.com/blog/html-in-canvas-origin-trial),
[chromestatus entry](https://chromestatus.com/feature/5172548013916160),
[WICG/html-in-canvas](https://github.com/WICG/html-in-canvas).
