import { common, d, std, tgpu } from "typegpu";

/**
 * Question 1 and 2, and nothing else.
 *
 * Can N textured quads — window proxies, in the real thing — be drawn as **one instanced draw**
 * reading their rects from a buffer, and where does it break? If the answer is yes at counts that
 * hurt, the compositor in `docs/compositor.md` is the right shape and a scene graph is dead weight.
 * If per-quad state forces a draw call each, that is the finding and the plan is wrong.
 *
 * Deliberately ugly. No React, no abstraction, no reuse — a reconciler is the thing being removed,
 * so bringing one in would prove nothing.
 */

/** One window proxy: its world rect, and a tint standing in for its captured texture. */
const Quad = d.struct({
  rect: d.vec4f,
  tint: d.vec4f,
});

const Camera = d.struct({
  center: d.vec2f,
  viewport: d.vec2f,
  zoom: d.f32,
});

/** Read `?n=` and `?tex=` so counts can be pushed until something gives, without a rebuild. */
const params = new URLSearchParams(globalThis.location.search);
const quadCount = Math.max(Number(params.get("n") ?? 2000), 1);
/** Distinct window textures. Capped by `maxTextureArrayLayers`, which is where this gets
 * interesting — see the README. */
const textureLayers = Math.max(Number(params.get("tex") ?? 64), 1);
const textureSize = Math.max(Number(params.get("texsize") ?? 256), 8);

const canvas = document.querySelector("canvas") as HTMLCanvasElement;
const readout = document.querySelector("#readout") as HTMLPreElement;

const root = await tgpu.init({
  // Timestamp queries are how frame cost stops being a guess: `withPerformanceCallback` reports
  // GPU nanoseconds. Optional rather than required so the PoC still runs where it is unavailable.
  device: { optionalFeatures: ["timestamp-query"] },
});

const context = root.configureContext({ alphaMode: "opaque", canvas });
const hasTimestamps = root.enabledFeatures.has("timestamp-query");

const layout = tgpu.bindGroupLayout({
  camera: { uniform: Camera },
  quads: { storage: d.arrayOf(Quad), access: "readonly" },
  sampler: { sampler: "filtering" },
  windows: { texture: d.texture2dArray() },
});

const cameraBuffer = root.createBuffer(Camera).$usage("uniform");
const quadsBuffer = root.createBuffer(d.arrayOf(Quad, quadCount)).$usage("storage");

/**
 * One layer per distinct window, which is the honest model: every window shows different pixels,
 * so nothing is shared. `'render'` usage is required to write an image source at all.
 */
const windowTextures = root
  .createTexture({
    format: "rgba8unorm",
    size: [textureSize, textureSize, textureLayers],
  })
  .$usage("sampled", "render");

/**
 * Stand-in for an HTML capture, and a fair one: `snapdom` and friends hand back a canvas or an
 * `ImageBitmap`, and writing one to a GPU texture is the same operation whatever drew it. What is
 * being measured here is the upload, not the rasterisation.
 */
const painted = document.createElement("canvas");

painted.width = textureSize;
painted.height = textureSize;

const paint = painted.getContext("2d") as CanvasRenderingContext2D;
const captures: ImageBitmap[] = [];

/**
 * `?html=1` rasterises a real DOM subtree per layer instead of painting shapes.
 *
 * This is the difference between measuring the *upload* and measuring the whole capture path.
 * Painting with 2D canvas calls is a fair stand-in for the former — a rasteriser hands back a
 * canvas either way — and tells you nothing about the latter, which is the part that decides
 * whether HTML can be a graphics-engine substrate.
 *
 * **Chrome's native lane is not what runs here.** `CanvasRenderingContext2D.drawElement` is the
 * primary capture lane and is undefined in this browser without a flagged build, so what is
 * measured below is the *fallback*: snapdom, which walks the DOM, inlines styles, and rasterises
 * through an SVG foreign object. Expect the native path to be materially faster; nothing here
 * establishes by how much.
 */
const captureHtml = params.get("html") === "1";
/**
 * `?native=1` uses Chrome's html-in-canvas instead of snapdom.
 *
 * Not a faster capture — a different mechanism. The canvas carries `layoutsubtree` and the window's
 * DOM is a *direct child* of it, so the browser lays the subtree out itself; `requestPaint()` asks
 * for a paint, a `paint` event says what changed, and `drawElementImage` puts the browser's own
 * rasterisation into the canvas backing store. No DOM walk, no style inlining, no SVG round trip.
 */
const captureNative = params.get("native") === "1";
const captureSource = document.querySelector("#capture-source .note") as HTMLElement;
let captureMs = 0;
let captureLabel = "canvas-painted (no DOM)";
/** When the native path writes layers itself, there is no separate upload step left to time. */
let nativeDirectToTexture = false;
/** Cost of re-capturing after exactly one window changed, against the full pass as control. */
let incrementalMs = 0;
let changedElementCount = 0;
let changedElementsReported = false;

if (captureNative) {
  const paintCanvas = document.createElement("canvas");

  paintCanvas.width = textureSize;
  paintCanvas.height = textureSize;
  paintCanvas.toggleAttribute("layoutsubtree", true);
  document.body.append(paintCanvas);

  /**
   * Every window as a sibling child of **one** canvas.
   *
   * The immediate-child rule is about layout, so it does not force a canvas per window — this is
   * the arrangement that claim rests on, and hosting all of them here is what tests it.
   */
  const windowElements = Array.from({ length: textureLayers }, (_, layer) => {
    const element = captureSource.cloneNode(true) as HTMLElement;

    (element.querySelector("h2") as HTMLElement).textContent = `Meeting notes ${String(layer)}`;
    paintCanvas.append(element);

    return element;
  });

  captureSource.remove();

  // Required even though nothing is ever drawn into it: `copyElementImageToTexture` refuses with
  // "containing canvas does not have a rendering context". The canvas is a layout host, but it
  // still has to be a canvas.
  paintCanvas.getContext("2d");

  const requestPaint = (paintCanvas as HTMLCanvasElement & { requestPaint: () => void })
    .requestPaint;
  /**
   * DOM straight into a texture-array layer. No canvas backing store, no `ImageBitmap`, no
   * `write()`.
   *
   * The element must be an immediate child of a `layoutsubtree` canvas — the API says so in as
   * many words — but that is a *layout* requirement, not a texture one. One canvas can host every
   * window's subtree and each child copies into its own array layer, so this does not force a
   * canvas per window the way the `CanvasTexture` route does.
   */
  const copyElementImageToTexture = (
    root.device.queue as GPUQueue & {
      copyElementImageToTexture: (
        source: Readonly<{ source: Element }>,
        destination: Readonly<{
          destination: Readonly<{ origin: readonly number[]; texture: GPUTexture }>;
        }>,
      ) => void;
    }
  ).copyElementImageToTexture.bind(root.device.queue);
  const rawTexture = root.unwrap(windowTextures);

  await document.fonts.ready;

  /** One paint of the whole subtree; resolves with whatever the browser says changed. */
  const paintOnce = async () =>
    new Promise<readonly Element[]>((done) => {
      paintCanvas.addEventListener(
        "paint",
        (event) => {
          done((event as Event & { changedElements?: readonly Element[] }).changedElements ?? []);
        },
        { once: true },
      );
      requestPaint.call(paintCanvas);
    });

  const captureStarted = performance.now();

  await paintOnce();

  for (const [layer, element] of windowElements.entries()) {
    copyElementImageToTexture(
      { source: element },
      { destination: { origin: [0, 0, layer], texture: rawTexture } },
    );
  }

  await root.device.queue.onSubmittedWorkDone();

  captureMs = performance.now() - captureStarted;

  /**
   * The question the whole capture story hangs on: when **one** window changes, does the browser
   * re-rasterise only that one?
   *
   * The full pass above is the control. Here a single note's heading is edited, and the paint event
   * is asked what it considers changed. If `changedElements` narrows to that element and the pass
   * costs a fraction of the full one, capture is a solved problem rather than a scheduling one —
   * because nothing else gets under the per-window rasterisation floor.
   */
  const edited = windowElements[0];

  if (edited) {
    (edited.querySelector("h2") as HTMLElement).textContent = "Edited just now";

    const incrementalStarted = performance.now();
    const changed = await paintOnce();

    copyElementImageToTexture(
      { source: edited },
      { destination: { origin: [0, 0, 0], texture: rawTexture } },
    );
    await root.device.queue.onSubmittedWorkDone();

    incrementalMs = performance.now() - incrementalStarted;
    changedElementCount = changed.length;
    changedElementsReported = changed.length > 0;
  }
  captureLabel = `native copyElementImageToTexture  (${(captureMs / textureLayers).toFixed(2)} ms/window)`;
  nativeDirectToTexture = true;
  paintCanvas.remove();
} else if (captureHtml) {
  await document.fonts.ready;

  const { snapdom } = await import("@zumer/snapdom");
  const captureStarted = performance.now();

  for (let layer = 0; layer < textureLayers; layer++) {
    // Mutated per layer so nothing can be cached away — every window shows different pixels, and a
    // capture path that only pays once is not the path a real canvas walks.
    const heading = captureSource.querySelector("h2") as HTMLElement;

    heading.textContent = `Meeting notes ${String(layer)}`;

    const shot = await snapdom(captureSource, { backgroundColor: "transparent" });
    const image = await shot.toCanvas();

    paint.clearRect(0, 0, textureSize, textureSize);
    paint.drawImage(image, 0, 0, textureSize, textureSize);
    captures.push(await createImageBitmap(painted));
  }

  captureMs = performance.now() - captureStarted;
  captureLabel = `snapdom fallback  (${(captureMs / textureLayers).toFixed(1)} ms/window)`;
} else {
  for (let layer = 0; layer < textureLayers; layer++) {
    paint.fillStyle = `oklch(0.24 0.03 ${String((layer * 37) % 360)})`;
    paint.fillRect(0, 0, textureSize, textureSize);
    paint.fillStyle = `oklch(0.85 0.12 ${String((layer * 37 + 40) % 360)})`;
    paint.fillRect(12, 12, textureSize - 24, 26);
    paint.fillStyle = "oklch(0.95 0.01 85)";
    paint.font = "13px ui-sans-serif, system-ui, sans-serif";
    paint.fillText(`window ${String(layer)}`, 16, 62);

    captures.push(await createImageBitmap(painted));
  }
}

/**
 * One batched write for every layer, timed to the point the GPU has actually done it.
 *
 * `write` only enqueues, so timing the call alone reported 0.4 ms and an absurd 40 GB/s — the
 * same shape of lie as reading a timestamp query that never landed. Awaiting
 * `onSubmittedWorkDone` is what makes this a transfer measurement rather than a measurement of
 * how fast JavaScript can ask.
 */
const uploadStarted = performance.now();

// Nothing to upload when the native path already wrote each layer straight from the DOM. That
// absence *is* the finding: the whole capture-then-upload pipeline collapses into one call.
if (!nativeDirectToTexture) {
  windowTextures.write(captures);
  await root.device.queue.onSubmittedWorkDone();
}

const uploadMs = nativeDirectToTexture ? 0 : performance.now() - uploadStarted;

const bindGroup = root.createBindGroup(layout, {
  camera: cameraBuffer,
  quads: quadsBuffer,
  sampler: root.createSampler({ magFilter: "linear", minFilter: "linear" }),
  windows: windowTextures,
});

/**
 * Scattered on a loose grid with jitter, sized like real notes.
 *
 * Seeded through `writeSoA` — per-field packed arrays — rather than an array of typed instances.
 * At these counts the wrapper objects would be the allocation rather than the data, and this is
 * the case the API exists for: it scatters field-wise arrays into the GPU's array-of-structs
 * layout, inserting the padding itself.
 */
const columns = Math.ceil(Math.sqrt(quadCount));
const rects = new Float32Array(quadCount * 4);
const tints = new Float32Array(quadCount * 4);
/**
 * `?overdraw=1` stacks every quad over the whole visible world instead of tiling them.
 *
 * The grid layout is instance-count-bound: zoomed out, each quad covers a handful of pixels and
 * the shading is nearly free, so it measures how many instances the GPU can chew. Stacking is the
 * opposite test — every fragment is written `n` times, which is the fill-rate case and the one
 * thing that could still make "quads and passes" the wrong shape.
 */
const overdraw = params.get("overdraw") === "1";

for (let index = 0; index < quadCount; index++) {
  const offset = index * 4;

  if (overdraw) {
    // Far larger than any visible region, so every instance covers every pixel at any sane zoom.
    rects[offset] = -20000;
    rects[offset + 1] = -20000;
    rects[offset + 2] = 40000;
    rects[offset + 3] = 40000;
  } else {
    rects[offset] = (index % columns) * 420 + ((index * 97) % 140);
    rects[offset + 1] = Math.floor(index / columns) * 320 + ((index * 53) % 110);
    rects[offset + 2] = 300;
    rects[offset + 3] = 220;
  }

  tints[offset] = 0.55 + ((index * 17) % 100) / 400;
  tints[offset + 1] = 0.45 + ((index * 31) % 100) / 300;
  tints[offset + 2] = 0.7;
  tints[offset + 3] = 1;
}

common.writeSoA(quadsBuffer, { rect: rects, tint: tints });

/**
 * One instanced draw for every quad.
 *
 * Six vertices per instance, the rect fetched from the storage buffer by `$instanceIndex`. If this
 * holds at scale then "the workload is textured quads" is true and the scene graph is unused
 * machinery — which is the entire question this PoC exists to answer.
 */
/**
 * Shelled rather than inline callbacks.
 *
 * The terser `createRenderPipeline({ vertex: (input) => … })` form cannot infer what the vertex
 * hands the fragment, so the varyings arrive as an empty record and every read of them is a type
 * error. Declaring the IO records is what makes `tint` and `uv` exist on both sides.
 */
const vertex = tgpu.vertexFn({
  in: { instanceIndex: d.builtin.instanceIndex, vertexIndex: d.builtin.vertexIndex },
  out: { layer: d.interpolate("flat", d.f32), pos: d.builtin.position, tint: d.vec4f, uv: d.vec2f },
})((input) => {
  "use gpu";
  const corners = [
    d.vec2f(0, 0),
    d.vec2f(1, 0),
    d.vec2f(0, 1),
    d.vec2f(0, 1),
    d.vec2f(1, 0),
    d.vec2f(1, 1),
  ];
  const corner = corners[input.vertexIndex];
  const quad = layout.$.quads[input.instanceIndex];
  const camera = layout.$.camera;

  const world = d.vec2f(quad.rect.x + corner.x * quad.rect.z, quad.rect.y + corner.y * quad.rect.w);
  const screen = std.add(
    std.mul(std.sub(world, camera.center), camera.zoom),
    std.mul(camera.viewport, 0.5),
  );
  const clip = std.sub(std.mul(std.div(screen, camera.viewport), 2), d.vec2f(1, 1));

  return {
    // Flat: a layer index must not be interpolated across the quad.
    layer: d.f32(input.instanceIndex % textureLayers),
    pos: d.vec4f(clip.x, -clip.y, 0, 1),
    tint: quad.tint,
    uv: corner,
  };
});

const fragment = tgpu.fragmentFn({
  in: { layer: d.interpolate("flat", d.f32), tint: d.vec4f, uv: d.vec2f },
  out: d.vec4f,
})((input) => {
  "use gpu";
  const captured = std.textureSample(
    layout.$.windows,
    layout.$.sampler,
    input.uv,
    d.u32(input.layer),
  );

  return d.vec4f(std.mul(captured.xyz, input.tint.xyz), 1);
});

const pipeline = root
  .createRenderPipeline({
    fragment,
    primitive: { topology: "triangle-list" },
    targets: { format: navigator.gpu.getPreferredCanvasFormat() },
    vertex,
  })
  .with(layout, bindGroup);

// `?zoom=` so the fill-bound case can be reached deliberately: zoomed out, quads are tiny and the
// instance count dominates; zoomed in, a handful of windows cover every pixel and overdraw does.
const camera = {
  center: { x: 0, y: 0 },
  zoom: Math.max(Number(params.get("zoom") ?? 0.35), 0.01),
};
let gpuNanoseconds = 0;

let gpuSamples = 0;
let gpuCallbacks = 0;

// The query set skips a frame when a previous read is still in flight, so a reading of zero means
// "no sample landed", not "it was free". Counting samples is what tells those apart — reporting
// the zero as a measurement is how the 500 000 row first lied.
//
// Callbacks and samples are counted separately because they fail differently: no callbacks at all
// means the timing path is not wired, while callbacks carrying zeros means the query resolved
// empty. Collapsing them into one counter hides which.
const timed = hasTimestamps
  ? pipeline.withPerformanceCallback((start, end) => {
      const elapsed = Number(end - start);

      gpuCallbacks += 1;

      if (elapsed > 0) {
        gpuNanoseconds = elapsed;
        gpuSamples += 1;
      }
    })
  : pipeline;

const resize = () => {
  const ratio = Math.min(globalThis.devicePixelRatio, 2);

  canvas.width = Math.max(Math.round(canvas.clientWidth * ratio), 1);
  canvas.height = Math.max(Math.round(canvas.clientHeight * ratio), 1);
};

new ResizeObserver(resize).observe(canvas);
resize();

canvas.addEventListener("pointermove", (event) => {
  if (event.buttons === 0) {
    return;
  }

  camera.center.x -= event.movementX / camera.zoom;
  camera.center.y -= event.movementY / camera.zoom;
});

canvas.addEventListener("wheel", (event) => {
  event.preventDefault();
  camera.zoom = Math.min(Math.max(camera.zoom * (event.deltaY < 0 ? 1.1 : 0.9), 0.02), 4);
});

const frames: number[] = [];
let previous = performance.now();

const frame = () => {
  const now = performance.now();

  frames.push(now - previous);

  if (frames.length > 90) {
    frames.shift();
  }

  previous = now;

  cameraBuffer.write({
    center: d.vec2f(camera.center.x, camera.center.y),
    viewport: d.vec2f(canvas.width, canvas.height),
    zoom: camera.zoom,
  });

  timed
    .withColorAttachment({
      clearValue: [0.055, 0.06, 0.07, 1],
      loadOp: "clear",
      storeOp: "store",
      view: context,
    })
    .draw(6, quadCount);

  const sorted = [...frames].sort((left, right) => left - right);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0;

  const textureBytes = textureSize * textureSize * 4 * textureLayers;

  readout.textContent = [
    `quads      ${String(quadCount)}${overdraw ? "  (stacked — fill test)" : ""}`,
    `draw calls 1`,
    `frame      ${median.toFixed(2)} ms  (${(1000 / median).toFixed(0)} fps)`,
    hasTimestamps
      ? `gpu        ${(gpuNanoseconds / 1e6).toFixed(3)} ms   (${String(gpuSamples)} samples / ${String(gpuCallbacks)} callbacks)`
      : `gpu        timestamp-query unavailable`,
    `textures   ${String(textureLayers)} x ${String(textureSize)}px  = ${(textureBytes / 1024 ** 2).toFixed(1)} MB`,
    `capture    ${captureLabel}`,
    ...(captureNative
      ? [
          `1 changed  ${incrementalMs.toFixed(2)} ms   vs ${captureMs.toFixed(0)} ms for all ${String(textureLayers)}`,
          `changedEls ${changedElementsReported ? `${String(changedElementCount)} reported` : "not reported by the paint event"}`,
        ]
      : []),
    nativeDirectToTexture
      ? `upload     none — DOM written straight into the texture array`
      : `upload     ${uploadMs.toFixed(1)} ms  (${(textureBytes / 1024 ** 2 / (uploadMs / 1000)).toFixed(0)} MB/s)`,
    `zoom       ${camera.zoom.toFixed(2)}   drag to pan, wheel to zoom`,
  ].join("\n");

  requestAnimationFrame(frame);
};

requestAnimationFrame(frame);
