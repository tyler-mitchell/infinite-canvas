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
let dirtyWindows = 0;
let interactionResult = "click a window to test";
/**
 * Paint + copy cost per kind of interaction, measured to the point the GPU has done it.
 *
 * Kept per cause rather than as one number, because one number is useless here: a hover flush
 * landing after a burst of typing overwrites the keystroke reading with its own, and the row that
 * matters most silently becomes the row you cannot see.
 */
const responses: Record<string, string> = {};

if (captureNative) {
  const paintCanvas = document.createElement("canvas");

  paintCanvas.width = textureSize;
  paintCanvas.height = textureSize;
  paintCanvas.id = "paint-host";
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
  const dirtyCount = Math.min(Math.max(Number(params.get("dirty") ?? 1), 1), textureLayers);
  const dirty = windowElements.slice(0, dirtyCount);

  for (const [index, element] of dirty.entries()) {
    (element.querySelector("h2") as HTMLElement).textContent = `Edited ${String(index)}`;
  }

  const incrementalStarted = performance.now();
  const changed = await paintOnce();

  for (const [index, element] of dirty.entries()) {
    copyElementImageToTexture(
      { source: element },
      { destination: { origin: [0, 0, index], texture: rawTexture } },
    );
  }

  await root.device.queue.onSubmittedWorkDone();

  incrementalMs = performance.now() - incrementalStarted;
  changedElementCount = changed.length;
  changedElementsReported = changed.length > 0;
  dirtyWindows = dirtyCount;

  /**
   * Screen point → the control under it.
   *
   * This is the difference between a compositor and a gallery of screenshots, and for a *flat*
   * surface it needs none of the GPU UV-picking a deforming one would: the quad's placement is an
   * affine transform of the camera, so inverting it on the CPU is exact. Screen point → world
   * point → which quad → local pixel → the control's own box.
   *
   * Resolved against that box rather than `document.elementFromPoint`, which returns nothing for
   * children of a `layoutsubtree` canvas: they are laid out and painted by the canvas rather than
   * composited into the page's normal hit-test tree. That is a real constraint on this
   * architecture — routing a pointer into a captured window needs geometry the compositor carries,
   * not the browser's hit test.
   */
  /**
   * What counts as a target, by the same rule a browser uses: the interactive elements.
   *
   * Hardcoding one class would have made the hit-test a demo of itself. Scanning the real
   * interactive set is the rule a compositor would actually carry, and costs a `querySelectorAll`
   * over one already-laid-out subtree.
   */
  const CONTROLS = "button, input, textarea, select, [contenteditable]";

  const resolvePointer = (clientX: number, clientY: number) => {
    const bounds = canvas.getBoundingClientRect();
    const world = {
      x: (clientX - bounds.left - canvas.clientWidth / 2) / camera.zoom + camera.center.x,
      y: (clientY - bounds.top - canvas.clientHeight / 2) / camera.zoom + camera.center.y,
    };

    // Last match wins: later instances draw over earlier ones, so the topmost is the one hit.
    let hitIndex = -1;

    for (let index = 0; index < quadCount; index++) {
      const offset = index * 4;
      const x = rects[offset] as number;
      const y = rects[offset + 1] as number;
      const width = rects[offset + 2] as number;
      const height = rects[offset + 3] as number;

      if (world.x >= x && world.x <= x + width && world.y >= y && world.y <= y + height) {
        hitIndex = index;
      }
    }

    const layer = hitIndex % textureLayers;
    const element = hitIndex < 0 ? undefined : windowElements[layer];

    if (!element) {
      return null;
    }

    // The quad shows the whole layer, so UV scales to texture space; the element occupies its own
    // box at the layer's origin.
    const offset = hitIndex * 4;
    const local = {
      x: ((world.x - (rects[offset] ?? 0)) / (rects[offset + 2] ?? 1)) * textureSize,
      y: ((world.y - (rects[offset + 1] ?? 0)) / (rects[offset + 3] ?? 1)) * textureSize,
    };
    const elementBox = element.getBoundingClientRect();
    const control =
      Array.from(element.querySelectorAll<HTMLElement>(CONTROLS)).find((candidate) => {
        const box = candidate.getBoundingClientRect();

        return (
          local.x >= box.left - elementBox.left &&
          local.x <= box.right - elementBox.left &&
          local.y >= box.top - elementBox.top &&
          local.y <= box.bottom - elementBox.top
        );
      }) ?? null;

    return { control, layer, local };
  };

  /**
   * Dirty layers, coalesced against the capture pipeline's own rate.
   *
   * The naive version — paint per interaction — measured 15.9 ms a keystroke against 4.2 ms for a
   * single paint, because fast typing put four paints in flight and each one waited behind the
   * last. That is the same fixed-round-trip cost this file already identified, arriving through a
   * door nobody was watching.
   *
   * The fix is not a fixed cadence. While a paint is in flight, further changes only mark layers
   * dirty; when it lands, one more paint covers everything that accumulated. So the capture rate
   * self-tunes to whatever the pipeline can actually sustain, and a burst of input costs one paint
   * rather than one each.
   */
  const dirtyLayers = new Set<number>();
  let flushing = false;
  let dirtyCause = "";
  let coalesced = 0;

  const flush = async () => {
    if (flushing || dirtyLayers.size === 0) {
      return;
    }

    flushing = true;

    const layers = [...dirtyLayers];
    const events = coalesced;
    const started = performance.now();

    dirtyLayers.clear();
    coalesced = 0;

    await paintOnce();

    for (const layer of layers) {
      const element = windowElements[layer];

      if (element) {
        copyElementImageToTexture(
          { source: element },
          { destination: { origin: [0, 0, layer], texture: rawTexture } },
        );
      }
    }

    await root.device.queue.onSubmittedWorkDone();

    responses[dirtyCause] =
      `${dirtyCause} ${(performance.now() - started).toFixed(2)} ms (${String(events)}→${String(layers.length)})`;
    flushing = false;

    // Anything that arrived mid-flight goes out in the next one.
    void flush();
  };

  const markDirty = (layers: readonly number[], cause: string) => {
    for (const layer of layers) {
      dirtyLayers.add(layer);
    }

    coalesced += 1;
    dirtyCause = cause;
    void flush();
  };

  /**
   * Hover, driven by the compositor rather than by CSS.
   *
   * The source DOM sits behind the surface and is never under the user's pointer, so `:hover` can
   * never fire on it. The compositor resolves what is under the pointer, marks it on the source
   * element, and repaints — which is also the honest test of the capture loop, since hover is the
   * cheapest interaction there is and it still costs a full paint.
   *
   * Only a *change* of hovered control repaints. Repainting per pointer event would pay ~3 ms a
   * move for pixels that are already correct.
   */
  let hovered: { control: HTMLElement; layer: number } | null = null;
  /** The focused field, tracked because its ring is drawn by the compositor rather than captured. */
  let focused: HTMLElement | null = null;

  canvas.addEventListener("pointermove", (event) => {
    // Dragging is a camera pan; the window under the pointer is not being aimed at.
    if (event.buttons !== 0) {
      return;
    }

    const found = resolvePointer(event.clientX, event.clientY);
    const control = found?.control ?? null;

    // Cursor feedback lives outside the texture, so it lands on the very next frame rather than
    // waiting on a paint.
    canvas.style.cursor = control === null ? "default" : "pointer";

    if ((hovered?.control ?? null) === control) {
      return;
    }

    const stale = hovered;

    hovered = control === null || found === null ? null : { control, layer: found.layer };

    stale?.control.removeAttribute("data-hover");

    if (hovered) {
      hovered.control.dataset["hover"] = "true";
    }

    markDirty([...(stale ? [stale.layer] : []), ...(hovered ? [hovered.layer] : [])], "hover");
  });

  /**
   * What activating a control means, per kind of control.
   *
   * A button changes its own state; a field takes focus. Keyed on the tag rather than branched,
   * because this is the table a compositor grows — every new control kind is a row, not a limb.
   */
  const activate: Readonly<Record<string, (control: HTMLElement) => string>> = {
    BUTTON: (control) => {
      const done = control.dataset["done"] !== "true";

      control.dataset["done"] = String(done);
      control.textContent = done ? "Done ✓" : "Mark as done";

      return "control activated";
    },
    /**
     * Real focus, not a synthesised one.
     *
     * The keyboard is a channel the compositor does not own and should not try to: once the browser
     * has focus on the field, keystrokes, selection and IME all reach it natively. The compositor's
     * whole job here is the geometry that decides *which* field — everything after that is the
     * platform's.
     */
    INPUT: (control) => {
      control.focus();

      return "field focused — type";
    },
  };

  /**
   * Clicking a captured window and having the source DOM respond.
   *
   * The window stays the authority for its own state. Nothing here reaches into the scene; the hit
   * resolves to a control, the control does its own thing, and the changed window is repainted and
   * re-copied into its layer.
   */
  canvas.addEventListener("click", (event) => {
    const found = resolvePointer(event.clientX, event.clientY);
    const control = found?.control ?? null;

    if (found === null || control === null) {
      interactionResult =
        found === null
          ? "no window under the pointer"
          : `window ${String(found.layer)} — hit, no control at ${found.local.x.toFixed(0)},${found.local.y.toFixed(0)}`;
      focused?.removeAttribute("data-focus");
      focused = null;

      return;
    }

    const outcome = activate[control.tagName]?.(control) ?? "control has no behaviour";

    // The focus ring is the compositor's to draw: the browser paints one on its own compositor,
    // above the page, so it is simply not in the pixels a capture returns.
    focused?.removeAttribute("data-focus");
    focused = control.tagName === "INPUT" ? control : null;
    focused?.setAttribute("data-focus", "true");

    interactionResult = `window ${String(found.layer)} — ${outcome}`;

    markDirty([found.layer], "click");
  });

  /**
   * Typing, which is the interaction that could still have killed this.
   *
   * Every keystroke changes a window's pixels, so every keystroke is a capture. At snapdom's 16 ms
   * that was hopeless and this file said so; the native lane's cost is what decides whether editing
   * can happen *in* the canvas rather than in a real DOM window floating above it.
   *
   * Delegated on the layout host rather than bound per field: `input` bubbles normally, since the
   * canvas is an ordinary DOM ancestor whatever it does with layout.
   */
  paintCanvas.addEventListener("input", (event) => {
    const layer = windowElements.indexOf(
      (event.target as HTMLElement).closest(".note") as HTMLElement,
    );

    if (layer >= 0) {
      markDirty([layer], "keystroke");
    }
  });
  captureLabel = `native copyElementImageToTexture  (${(captureMs / textureLayers).toFixed(2)} ms/window)`;
  nativeDirectToTexture = true;
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
          `${String(dirtyWindows)} dirty    ${incrementalMs.toFixed(2)} ms in one paint   (${(incrementalMs / dirtyWindows).toFixed(2)} ms/window)`,
          `changedEls ${changedElementsReported ? `${String(changedElementCount)} reported` : "not reported by the paint event"}`,
          `all ${String(textureLayers)}     ${captureMs.toFixed(0)} ms  (${(captureMs / textureLayers).toFixed(2)} ms/window)`,
          `click      ${interactionResult}`,
          `respond    ${Object.keys(responses).length === 0 ? "interact with a window to test" : `${Object.values(responses).join("   ")}   (events→layers)`}`,
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
