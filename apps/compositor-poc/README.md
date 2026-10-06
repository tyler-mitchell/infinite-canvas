# Compositor proof of concept

This throwaway application measures the [compositor design](../../docs/compositor.md).
It imports nothing from `@hyphened/infinite-canvas`.

[The TypeGPU spike](../polkadot/SPIKES.md) already proves that the field shader compiles and creates a pipeline on a real device.
This application asks whether textured quads and full-screen passes can support the window workload.

The application exposes these measurement controls:

| Query          | Measurement                         |
| -------------- | ----------------------------------- |
| `?html=1`      | snapdom capture                     |
| `?native=1`    | native HTML capture                 |
| `?dirty=N`     | Incremental capture of N windows    |
| `?overdraw=1`  | Full-screen overdraw                |
| `?emptypass=1` | Material passes with zero instances |

## Geometry

The geometry test uses an Apple GPU with `metal-3` and Chrome 151.
Each frame uses one `draw(6, n)` call.
Each quad reads its rectangle through `$instanceIndex` and samples one texture-array layer.

| quads   | draw calls | GPU time | samples | frame           |
| ------- | ---------- | -------- | ------- | --------------- |
| 20 000  | 1          | 0.262 ms | 2       | 8.3 ms (120fps) |
| 100 000 | 1          | 1.180 ms | 99      | 8.3 ms (120fps) |
| 500 000 | 1          | 1.638 ms | 1186    | 8.4 ms (119fps) |

GPU time comes from `withPerformanceCallback`.
This callback uses GPU timestamp queries instead of frame deltas.
The frame rate stayed at the display limit of 120 Hz.
A zero GPU value means that no timestamp sample arrived.

The same tests without textures measured 0.131 ms for 20 000 quads and 0.918 ms for 100 000 quads.
Texture sampling added little time to the geometry pass.

One instanced draw supports far more geometry than the expected window count.
The compositor does not require a scene graph for this workload.

## Texture memory and upload

Each distinct window occupies one layer of a `texture_2d_array`.
The upload measurement ends after `queue.onSubmittedWorkDone()`.

| layers | size  | VRAM   | upload       | rate         |
| ------ | ----- | ------ | ------------ | ------------ |
| 64     | 256px | 16 MB  | Not measured | Not measured |
| 256    | 512px | 256 MB | 131.2 ms     | 1951 MB/s    |

`maxTextureArrayLayers` limits one array to 256 layers.
The device limits a 2D texture to 8192².
An 8192² atlas holds approximately 341 windows at 512×384.

Texture memory limits the canvas before geometry does.
The resource manager must control `scale`, residency, and eviction.
At 1951 MB/s, one 512² upload costs approximately 0.5 ms.

## HTML capture

The fallback path uses `?html=1` and snapdom.
It rasterizes one styled DOM subtree for each window.

| stage                           | cost per window |
| ------------------------------- | --------------- |
| **capture** (snapdom, real DOM) | **16.0 ms**     |
| upload (1 MB at ~1500 MB/s)     | ~0.7 ms         |
| draw (amortized over 500 000)   | ~0.000003 ms    |

One snapdom capture consumes almost one 60 Hz frame.
Content changes must trigger capture.
The capture queue must coalesce changes.

The native path uses `?native=1`.
It copies each direct DOM child to one TypeGPU texture-array layer.

| path                                                 | per window  | upload   |
| ---------------------------------------------------- | ----------- | -------- |
| snapdom → `ImageBitmap` → `write`                    | 16.0 ms     | +0.7 ms  |
| native `drawElementImage` → `ImageBitmap` → `write`  | 4.10 ms     | +0.7 ms  |
| **native `copyElementImageToTexture` → array layer** | **4.06 ms** | **none** |

The native copy removes the separate upload step.
One layout canvas can host all window subtrees.

| arrangement                         | total        | per window  |
| ----------------------------------- | ------------ | ----------- |
| one paint cycle per window          | Not measured | 4.06 ms     |
| **all 64 in one canvas, one paint** | 45 ms        | **0.70 ms** |
| one window changed, one paint       | 3.70 ms      | 3.70 ms     |

The cost model is:

```
paint round trip   ~3.0 ms   fixed, per paint — not per window
rasterisation      ~0.7 ms   marginal, per window actually repainted
transfer            0        copyElementImageToTexture — no upload step at all
```

The fixed paint round trip dominates a small batch.
One coalesced paint amortizes that cost across all dirty windows.

`?dirty=N` edits N windows before one paint.
The `changedElements` event reported exactly 1, 5, 20, and 64 dirty elements in the measured tests.

| dirty windows | one coalesced paint | per window | fits in a 60 Hz frame? |
| ------------- | ------------------- | ---------- | ---------------------- |
| 1             | 3.70 ms             | 3.70 ms    | yes                    |
| 5             | 9.00 ms             | 1.80 ms    | yes                    |
| 20            | 11.20 ms            | 0.56 ms    | yes                    |
| 64            | 32.30 ms            | 0.50 ms    | no, about two frames   |

The earlier `all 64` control included first layout and cold-start noise.
The `?dirty=N` rows record steady-state work.

The native API call is:

```ts
queue.copyElementImageToTexture(
  { source: element },
  { destination: { texture, origin: [0, 0, layer] } },
);
```

The source element must be an immediate child of a `layoutsubtree` canvas.
The canvas must also have a rendering context.
The copy otherwise fails with "containing canvas does not have a rendering context".

## Fill rate

`?overdraw=1` places every quad over the visible world and writes each fragment `n` times.
Fifty full-screen textured layers measured 0.240 ms.
Fill rate stayed below the frame budget in this test.

## Interaction

The compositor converts a screen point to world space and searches the quads in draw order.
The last matching quad is the visible target.
The compositor then maps the point to the source element box.

This CPU hit test is exact for the current flat affine surface.
A deformed surface requires a different picking method.

`document.elementFromPoint` cannot find children of a `layoutsubtree` canvas.
The source subtree must stay attached because `getBoundingClientRect` supplies its control boxes.

| interaction                 | hit-test → DOM change → paint → copy |
| --------------------------- | ------------------------------------ |
| hover enter / leave         | 2.50 ms                              |
| click (state + text change) | 4.10 ms                              |

The compositor dispatches a real `MouseEvent` after hit testing.
The event reaches the delegated React listener.
The React component owns the state change.

The compositor calls `focus()` for a captured field.
The platform then owns keystrokes, selection, and IME input.
The captured pixels include the caret.

The browser focus ring is outside the captured page pixels.
CSS on the source element supplies the focus ring.
The caret blink also requires periodic capture or a compositor caret.

The capture queue coalesces input events while one paint is active.

| interaction         | coalesced cost                    |
| ------------------- | --------------------------------- |
| hover enter / leave | 1.90 ms (1 event → 1 layer)       |
| click               | 4.10 ms (1 event → 1 layer)       |
| **typing burst**    | **5.10 ms (36 events → 1 layer)** |

One React root renders each `.note` as a direct child of the layout canvas.
`flushSync` commits those children before the first paint request.

| interaction  | React                       | static HTML (before) |
| ------------ | --------------------------- | -------------------- |
| hover        | 2.70 ms (1 event → 1 layer) | 1.90 ms              |
| click        | 5.40 ms (1 → 1)             | 4.10 ms              |
| typing burst | **9.90 ms (31 → 1)**        | 5.10 ms              |

The controlled input and its character count both update on the canvas.
This result proves the path from React state to the GPU texture.

## Content signatures

The compute pass samples a 24×24 grid from each texture layer.
It writes the content color, ink density, ground color, and eight horizontal density bands.

The frame uses this order:

1. `analyse` writes one signature for each window.
2. `light` draws one additive light quad for each window.
3. `windows` draws captured window pixels over the light.

The light color and range come from captured pixels.
Content changes alter the light without a state mirror or event channel.

Twelve windows, six textures, and three materials produced these 90-sample medians:

| pass        | median GPU       |
| ----------- | ---------------- |
| **analyse** | **0.138 ms**     |
| light       | 0.038 ms         |
| windows     | 0.019–0.037 ms   |
| glass       | 0.058 ms         |
| edge        | 0.060–0.094 ms   |
| sheen       | 0.013–0.084 ms   |
| **total**   | **0.35–0.44 ms** |

The analysis pass costs more than each render pass in this sample.
It runs every frame at this time.
With reliable invalidation, capture-time analysis can recover approximately 0.138 ms.

## Semantic zoom

Each signature stores ink density in eight horizontal bands.
Below the legibility limit, the shader uses those bands.

The shader uses the window width on the screen as the input.
It shows only measured bands below 70 device pixels.
It shows captured pixels above 190 device pixels.
It blends between the two limits.

The texture layer matches the 300×220 window aspect ratio.
A square 512×512 layer distorted the window by 27% and left an unwritten band.

## Component materials

Each component is a UV rectangle inside one captured window layer.
The compositor collects these rectangles during the source-geometry walk.
It groups material instances into contiguous draw ranges.

The original declaration probe used this markup:

```tsx
<button className="note-action" data-radius="8" data-surface="sheen">
```

The measured batch report was:

```
surfaces   12 instances / 2 draws  (sheen 6, edge 6)
```

The current implementation reads the corner radius from computed CSS.
The component declares only `data-surface`.

Additive materials preserve the captured pixels.
Glass uses over blending only inside its refractive rim.
Hover changes one float per instance and does not trigger capture.

Material geometry follows content reflow because collection runs after each capture.
The buffer reserves extra capacity and reports overflow in the readout.

The collection measurements are:

| collection method                     | cold (first measurement) | steady state |
| ------------------------------------- | ------------------------ | ------------ |
| `[data-surface]` walk + geometry      | 3.1–5.7 ms               | **0.60 ms**  |
| `getComputedStyle` over every element | **0.00 ms**              | 0.00 ms      |

The 0.00 ms result is below the timer resolution for six windows.
Geometry measurement through `getBoundingClientRect` supplies the recurring cost.

Glass requires a scene texture because a pass cannot sample its current render target.
The pass order is:

```
analyse  → signature buffer
light    → scene texture   (clear)
windows  → scene texture   (load)
blit     → canvas
glass, edge, sheen → canvas, sampling the scene texture as a backdrop
```

Every scene attachment uses `getPreferredCanvasFormat()`.
A mismatch with `rgba8unorm` produced an empty scene without a visible WebGPU error.

`querySelectorAll` searches descendants only.
The collector includes the window root separately so a root glass material produces instances.

## Material pass cost

`?emptypass=1` measures each material pass with zero instances.

| pass    | 12 instances | 0 instances |
| ------- | ------------ | ----------- |
| glass   | 0.063 ms     | 0.217 ms    |
| edge    | 0.135 ms     | 0.128 ms    |
| sheen   | 0.130 ms     | 0.107 ms    |
| _total_ | _0.741 ms_   | _0.863 ms_  |

An empty pass costs approximately as much as a pass with twelve instances.
The fixed render-pass cost dominates this sample.
A shared pass with pipeline changes can reduce that cost.

TypeGPU supports one shared pass through `pipeline.with(pass).draw(...)`.
The lower-level form uses `pass.setPipeline()` and `pass.draw()`.
This design removes timing for each material because the render pass becomes the measured unit.

## Measurement record

This proof of concept can contain hard-coded test values.
Only the measurements and conclusions can move into the library.
The first geometry probe used no React because React does not own GPU objects in the compositor.

The expected workbench has hundreds or low thousands of windows.
Half a million textured quads measured 1.6 ms.
As a result, `three` supplies no required geometry feature here.
The pass design in `docs/compositor.md` does not require `three`.

At 256 windows, textures use 256 MB.
The upload of all 256 textures took 131 ms.
Before textures, 100 000 quads cost approximately 0.9 ms.

One texture array ends at 256 windows.
Larger canvases require multiple arrays, an atlas, or both.
Far windows require smaller textures or no resident texture.
Off-screen windows must release their textures.
Browser compositors manage the same constraint with tiles.

The early timestamp readout showed `0.000 ms` before the callback produced a sample.
At 500 000 quads, the callback later produced 1186 samples.
The sample count distinguishes absent data from free work.

The fallback mutates each heading before capture so every texture layer contains different pixels.
At 512², capture costs twenty times more than upload and six orders more than drawing.
A window drag changes its transform and does not require capture.

The snapdom result first suggested that live editing required a DOM window above the canvas.
The native test corrected that conclusion.
A burst of 36 keystrokes costs 5.1 ms on the native path.
A hybrid editor can still have other product reasons.

The native copy is four times faster than snapdom.
It uses no canvas backing store, `ImageBitmap`, or separate upload.
One `requestPaint` call starts the paint cycle.
The `paint` event reports the changed elements.

The estimate for twenty dirty windows is `3 + 20 × 0.7 ≈ 17 ms`.
Approximately twenty windows fit inside one 60 Hz frame.
More than thirty dirty windows require work across frames.

The browser reported each `dirty` count without extra or missing elements.
The compositor can use this engine-owned dirty set.
The 64-window control measured 43, 88, and 67 ms across identical cold runs.

The native constraints came from API probes.
The `CanvasTexture` route requires one canvas for each window.
`copyElementImageToTexture` lets one canvas host every window.
The canvas still requires a rendering context.

The transfer benchmark waits for `queue.onSubmittedWorkDone()`.
Without this wait, the call measured only enqueue time.

## Interaction record

The CPU maps UV coordinates with `textureSize` for the horizontal axis and the texture height for the vertical axis.
The original square-layer path used `textureSize` for both axes.

The first hit test used `elementFromPoint`.
It returned no child for every tested point inside the `layoutsubtree` canvas.
The compositor reads each source box through `getBoundingClientRect`.

The attached `layoutsubtree` gives every source element a valid box.
A detached source reports zero-size boxes and prevents all control hits.
One layout canvas gives all windows one coordinate space.

The source DOM stays behind the WebGPU canvas.
As a result, `:hover` cannot change source elements.
CSS transitions and animations also stop between captures.
Shader materials own presentation motion.

The first input loop repainted once for each event.
It measured 15.9 ms for each keystroke, compared with 4.2 ms for one paint.
The coalesced loop bounds cost by paint rate instead of event rate.

Each window is a React component with `useState`.
The `Note` component does not know that capture reads its pixels.
The measured path is state → render → browser paint → GPU texture.

React approximately doubles the coalesced cost and stays within one frame.
The draft character count proves that React state produced the captured output.
After `focus()`, the platform carries keystrokes, selection, and IME input.

## Signature calibration

The shared texture array lets the compute pass read every captured window.
The DOM cannot read its own rasterization.
A draw-only renderer cannot examine its previous pixels.

The pass order matches `docs/compositor.md`.
A click on **Mark as done** changed the measured values without a light event:

|          | measured ink | the space around it                 |
| -------- | ------------ | ----------------------------------- |
| open     | 0.86         | dim, neutral                        |
| **done** | **1.26**     | **blooms in the note's own accent** |

The compute pass reads the changed pixels on the next frame.
No event bus, state mirror, or manual invalidation updates the light.
At distant zoom levels, the measured light identifies dense window regions without tags or rankings.

The analysis pass is the most expensive pass in the measured sample.
It costs more than the windows and each material.
Frame time did not reveal this cost because the display fixed the frame rate.

The 90-sample median prevents one timestamp from becoming the result.
Three raw glass samples measured 0.113, 0.553, and 0.049 ms.
The measurement contained approximately twelve thousand samples.

The first ink scale was seven times too small.
The next scale was three times too large and saturated every window.
The readout exposed both errors.

A presence-only color weight produced near-white output because body text dominated the sample count.
The cubic chroma weight lets accent pixels supply the hue.
Each note also received a distinct, moderate accent color.

One correction increased color too far and made six accents pure red, green, or blue.
The next correction reduced chroma, saturation, and brightness together and made the light difficult to see.
The current values lie between those results.

The first readback gate used `frames.length % 30`.
The frame array stops at 90 entries, so the gate became true on every warm frame.
Continuous readback increased hover cost from 2.6 ms to 26 ms.

## Semantic zoom record

Small captured text becomes gray noise.
The band profile replaces that noise with rows from the measured ground and content colors.
This result is a reduction of captured content rather than a placeholder.

At zoom 0.13, one hundred windows retain document structure and identity.
At zoom 0.9, the shader shows captured pixels.
The width-based blend changes continuously between these states.

The first square texture left a black strip under each note.
The note content was approximately 215 pixels high inside a 512-pixel layer.
An external size update removed the strip and increased one repaint from 4 ms to 136 ms.

The window receives its size as a prop.
The measured repaint returned to 5.4 ms.
The matching aspect ratio also removes the 27% vertical distortion.

The old quad `tint` changed displayed pixels without changing the pixels measured by the compute pass.
The fragment returns captured pixels without that tint.

## Material record

One material draw can cover one thousand buttons that share the material.
The earlier 500 000-quad result shows that instance count is not the material limit.
Additive blending preserves text, layout, and accessibility inside the captured component.

The old hover path repainted and copied one window for 2.6 ms.
The material path updates one float per instance at display rate.
The `respond` readout remains "interact with a window to test" because hover does not trigger capture.

Capture cadence applies to content changes.
Presentation changes stay in the material path.

The cascade probe reads `--surface: sheen` through `getComputedStyle`.
The selected implementation finds `[data-surface]` and measures boxes with `getBoundingClientRect`.
The table shows that geometry measurement costs more than the style lookup.

The first collection numbers included initial layout.
Steady-state collection costs 0.60 ms beside a 3.8 ms paint.
This cost permits collection after each capture.

The **Mark as done** label changes the button width.
Mount-only geometry left the sheen at the old box.
Capture-time collection keeps the material box aligned with reflow.

Glass blends `over` inside the bevel and samples the completed scene texture.
The measured batch was `36 instances / 3 draws (glass 12, edge 12, sheen 12)`.

The canvas target format was `bgra8unorm` on the measured machine.
An `rgba8unorm` scene texture caused the window and light passes to produce no output.
A UV gradient from the blit proved that the blit path was valid.
The readout showed `0 samples / 2408 callbacks` for the rejected pass.

The root-window collector first used only `querySelectorAll`.
Glass then produced zero instances, while the readout showed `edge 12, sheen 12`.
The collector examines the root and its descendants.

The aspect-ratio correction exposed a hit-test error in `resolvePointer`.
The old vertical calculation used `textureSize` and placed each click 36% above its target.
This failure proves that the hit test derives positions from geometry.

Every window is a sibling inside one `layoutsubtree` canvas.
Each window copies to one array layer and reports geometry through `getBoundingClientRect`.
The first geometry version used static HTML clones before the React capture test.

## Open limits

- The application does not cull off-screen instances.
- The geometry results include all off-screen instances and are a conservative worst case.
- The material path supports 128 window instances and reports truncation.
- Rotated, scaled, and clipped components do not have matching UV rectangles.
- Capture triggers geometry collection. Layout changes without capture can leave stale boxes.
- Text selection drag and IME composition do not have runtime proof.
- Browser and compositor transforms do not have synchronization proof.
