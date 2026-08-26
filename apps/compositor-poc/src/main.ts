import { common, d, std, tgpu } from "typegpu";

import { createLightField, lightLayout } from "./light-field.ts";
import { Camera, Quad } from "./scene.ts";
import { analyzeWindows, BANDS, Signature, signatureLayout } from "./signature.ts";
import {
  edgeFragment,
  glassFragment,
  sheenFragment,
  Surface,
  surfaceLayout,
  surfaceVertex,
} from "./surface.ts";

/**
 * Three passes over one texture array: analyse, light, draw.
 *
 * It started as one question — can N textured quads be drawn as **one instanced draw** reading
 * their rects from a buffer, and where does it break? — and the answer held so far past the counts
 * that matter that the interesting work moved elsewhere. See the README for every number.
 *
 * What it grew into is the shape `docs/compositor.md` describes: a render graph of passes over
 * shared resources, where the windows' captured pixels are just memory the GPU can read. The
 * signature pass is the proof of that last part, and the light field is what it looks like.
 */

/** Read `?n=` and `?tex=` so counts can be pushed until something gives, without a rebuild. */
const params = new URLSearchParams(globalThis.location.search);
const quadCount = Math.max(Number(params.get("n") ?? 2000), 1);
/** Distinct window textures. Capped by `maxTextureArrayLayers`, which is where this gets
 * interesting — see the README. */
const textureLayers = Math.max(Number(params.get("tex") ?? 64), 1);
const textureSize = Math.max(Number(params.get("texsize") ?? 256), 8);

/**
 * Draw order for materials, and the batching order the instance buffer is laid out in.
 *
 * Glass first, so the accents and the sheen sit on top of the bevel rather than under it. The order
 * is a list because that is what it is — a material library grows by adding a row.
 */
const MATERIAL_ORDER = ["glass", "edge", "sheen"];

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
  signatures: { access: "readonly", storage: d.arrayOf(Signature) },
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
 * A CSS colour as linear-ish RGB, by letting the browser do the conversion.
 *
 * Parsing `oklch()` by hand was tried and produced a bright blue ground, because the components
 * were read as if they were RGB. Painting one pixel and reading it back cannot be wrong about a
 * colour space the browser already implements.
 */
const readColour = (value: string) => {
  paint.fillStyle = value.trim() === "" ? "#ffffff" : value;
  paint.fillRect(0, 0, 1, 1);

  const pixel = paint.getImageData(0, 0, 1, 1).data;

  return [(pixel[0] ?? 0) / 255, (pixel[1] ?? 0) / 255, (pixel[2] ?? 0) / 255] as const;
};

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

/**
 * A component that asked for a shader material, and where it sits inside its window.
 *
 * The box is stored as a *fraction* of the window rather than in pixels, because the same window
 * texture is drawn at many sizes and positions — one collection serves every instance of it.
 */
type SurfaceSource = {
  readonly box: readonly [number, number, number, number];
  readonly element: HTMLElement;
  readonly layer: number;
  readonly material: string;
  readonly radius: number;
  readonly tint: readonly [number, number, number];
};

let surfaceSources: readonly SurfaceSource[] = [];
let collectSurfaces: (() => void) | null = null;
let hoveredElement: HTMLElement | null = null;
/** Hover per element, kept outside the source list so a re-collection does not reset a transition. */
const hoverAmounts = new Map<HTMLElement, number>();
let surfaceCollectMs = 0;
let cascadeProbeMs = 0;
/** Instances the plan wanted that the buffer could not hold. Reported, never swallowed. */
let surfaceOverflow = 0;

if (captureNative) {
  const paintCanvas = document.createElement("canvas");

  paintCanvas.width = textureSize;
  paintCanvas.height = textureSize;
  paintCanvas.id = "paint-host";
  paintCanvas.toggleAttribute("layoutsubtree", true);
  document.body.append(paintCanvas);

  /**
   * Every window as a sibling child of **one** canvas, rendered by React.
   *
   * The immediate-child rule is about layout, so it does not force a canvas per window — this is
   * the arrangement that claim rests on, and hosting all of them here is what tests it.
   *
   * React renders straight *into* the canvas rather than into a host element per window, so each
   * `.note` really is an immediate child and the layout rule holds unchanged. One root for every
   * window, which is the arrangement a real app has; N roots would have proven something weaker.
   *
   * `flushSync` because the elements have to exist before the first paint is asked for — React's
   * default async commit would hand back an empty canvas to capture.
   */
  const { createRoot } = await import("react-dom/client");
  const { flushSync } = await import("react-dom");
  const { Note } = await import("./note.tsx");
  const { createElement, Fragment } = await import("react");

  captureSource.remove();
  flushSync(() => {
    createRoot(paintCanvas).render(
      createElement(
        Fragment,
        null,
        Array.from({ length: textureLayers }, (_, layer) =>
          createElement(Note, { index: layer, key: layer, size: textureSize }),
        ),
      ),
    );
  });

  const windowElements = Array.from(paintCanvas.querySelectorAll<HTMLElement>(":scope > .note"));

  /**
   * Turn `data-surface` declarations into geometry the GPU can draw.
   *
   * This is the same subtree walk the hit-test already does — the compositor needs every control's
   * box either way — so a material system costs one more field per element rather than a second
   * traversal. What comes out is each component's box as a *fraction* of its window, which is what
   * makes one collection serve every quad that shows that window.
   */
  collectSurfaces = () => {
    const started = performance.now();
    const found: SurfaceSource[] = [];

    for (const [layer, element] of windowElements.entries()) {
      const box = element.getBoundingClientRect();
      const accent = readColour(getComputedStyle(element).getPropertyValue("--accent"));

      /*
       * The window itself counts.
       *
       * `querySelectorAll` searches descendants only, so a material declared on the window root was
       * collected zero times and glass silently produced no instances — the readout said
       * `edge 12, sheen 12` and nothing about the material that was missing. A window is a
       * component like any other.
       */
      const candidates = [
        ...(element.dataset["surface"] === undefined ? [] : [element]),
        ...element.querySelectorAll<HTMLElement>("[data-surface]"),
      ];

      for (const node of candidates) {
        const material = node.dataset["surface"];
        const nodeBox = node.getBoundingClientRect();

        if (material === undefined || box.width === 0) {
          continue;
        }

        /*
         * The corner comes from CSS, not from an attribute beside it.
         *
         * A `data-radius` said the same thing the stylesheet already said, in a second place that
         * could disagree with the first. Clamped to half the short side the way the browser clamps
         * it, so a pill written as `999px` resolves to an actual pill rather than a nonsense
         * distance the SDF would fold inside out.
         */
        const declared = Number.parseFloat(getComputedStyle(node).borderTopLeftRadius);
        const radius = Math.min(
          Number.isFinite(declared) ? declared : 0,
          Math.min(nodeBox.width, nodeBox.height) / 2,
        );

        found.push({
          box: [
            (nodeBox.left - box.left) / box.width,
            (nodeBox.top - box.top) / box.height,
            nodeBox.width / box.width,
            nodeBox.height / box.height,
          ],
          element: node,
          layer,
          material,
          // Carried as a fraction of the window, like every other measurement here, so one
          // collection serves the window at any size.
          radius: radius / box.width,
          tint: accent,
        });
      }
    }

    surfaceCollectMs = performance.now() - started;
    surfaceSources = found;
  };

  /*
   * What the nicer API would cost.
   *
   * A custom property — `--surface: sheen` — would inherit through the CSS cascade, which is the
   * version that would feel native. It cannot be found by a selector though: it needs
   * `getComputedStyle` on every element in every window. Measured once here so the difference
   * between the cheap API and the good one is a number rather than an opinion.
   */
  const probeStarted = performance.now();

  for (const element of windowElements) {
    for (const node of element.querySelectorAll<HTMLElement>("*")) {
      getComputedStyle(node).getPropertyValue("--surface");
    }
  }

  cascadeProbeMs = performance.now() - probeStarted;

  collectSurfaces();

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
   *
   * Written straight into the DOM rather than through React, because what is being measured is the
   * browser's repaint cost and a state round trip would only add noise. React restores the heading
   * the next time that window renders — which is itself the ownership boundary showing its teeth.
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

    /*
     * A capture means the DOM changed, which means boxes may have moved.
     *
     * Measured once at mount, materials drift the moment a window reflows — the button's own label
     * changes width when it is marked done, and the bevel stays around where it used to be. This is
     * the cheapest correct trigger: exactly the moments something was repainted.
     */
    collectSurfaces?.();
    buildSurfaces();

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

    /*
     * Hover no longer touches the DOM, and does not repaint anything.
     *
     * It used to set an attribute on the source element and re-capture that window: 2.6 ms for a
     * flat colour swap, which is exactly how it looked. Now it names an element and the material
     * pass animates it — one float, no capture in the path. A captured surface can only step
     * between states at capture rate; a material moves at display rate.
     */
    hoveredElement = control;
  });

  /**
   * Clicking a captured window and having React respond.
   *
   * The compositor's authority ends at geometry. It resolves which element the pointer landed on
   * and then dispatches a **real** click, which bubbles to React's delegated listener on the root
   * container exactly as a click on an ordinary page would — so the component's own handler runs
   * and the component decides what its state becomes.
   *
   * That boundary is the load-bearing part. Synthesising the state change instead would have made
   * the compositor a second authority over window content, and every window would then need to be
   * written to expect one.
   */
  canvas.addEventListener("click", (event) => {
    const found = resolvePointer(event.clientX, event.clientY);
    const control = found?.control ?? null;

    // The focus ring is the compositor's to draw: the browser paints one on its own compositor,
    // above the page, so it is simply not in the pixels a capture returns.
    focused?.removeAttribute("data-focus");
    focused = control?.tagName === "INPUT" ? control : null;
    focused?.setAttribute("data-focus", "true");

    if (found === null || control === null) {
      interactionResult =
        found === null
          ? "no window under the pointer"
          : `window ${String(found.layer)} — hit, no control at ${found.local.x.toFixed(0)},${found.local.y.toFixed(0)}`;

      return;
    }

    // Focus is the platform's channel, not the compositor's: once the browser has it, keystrokes,
    // selection and IME reach the field natively without anything here in the path.
    control.focus();
    control.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));

    interactionResult = `window ${String(found.layer)} — ${control.tagName.toLowerCase()} clicked`;

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

/**
 * What the canvas knows about its own content, written by a compute pass that reads the captured
 * pixels: each window's content colour, ink, ground, and the profile of where its rows are. Read by
 * both render passes — the light field for colour and reach, the window pass for semantic zoom.
 */
const signaturesBuffer = root.createBuffer(d.arrayOf(Signature, textureLayers)).$usage("storage");

const bindGroup = root.createBindGroup(layout, {
  camera: cameraBuffer,
  quads: quadsBuffer,
  sampler: root.createSampler({ magFilter: "linear", minFilter: "linear" }),
  signatures: signaturesBuffer,
  windows: windowTextures,
});

const analyze = root.createComputePipeline({ compute: analyzeWindows }).with(
  signatureLayout,
  root.createBindGroup(signatureLayout, {
    signatures: signaturesBuffer,
    windows: windowTextures,
  }),
);

/**
 * Every material instance on the canvas, laid out once and grouped by material.
 *
 * Built here rather than per frame because only `hover` changes between frames — a component's box,
 * colour and radius are fixed until the next capture. Grouping by material at build time is what
 * makes each material a contiguous instance range, so a batch is a range rather than a filter.
 *
 * `surfaceQuads` bounds how many *instances of a window* get materials. The readout reports when
 * that bound truncated, because a silent cap reads as "everything is covered" when it is not.
 */
const surfaceQuads = Math.min(quadCount, 128);
const surfacePlan: Array<{ element: HTMLElement; material: string }> = [];
const surfaceBatches: Array<{ count: number; first: number; material: string }> = [];

/** Instances the plan yields right now, in material order, without touching any buffer. */
const planSurfaces = () =>
  MATERIAL_ORDER.flatMap((material) =>
    surfaceSources
      .filter((source) => source.material === material)
      .flatMap((source) =>
        Array.from({ length: surfaceQuads }, (_, quad) => quad)
          .filter((quad) => quad % textureLayers === source.layer)
          .map((quad) => ({ material, quad, source })),
      ),
  );

/**
 * Headroom, so a window whose content reflows can be re-measured without reallocating.
 *
 * The buffer is sized once; re-collection refreshes geometry into it. Twice the initial count
 * absorbs a component appearing or disappearing, and anything past that is reported rather than
 * silently dropped.
 */
const surfaceCount = Math.max(planSurfaces().length * 2, 32);
const surfaceAtlas = new Float32Array(surfaceCount * 4);
const surfaceParams = new Float32Array(surfaceCount * 4);
const surfaceTint = new Float32Array(surfaceCount * 4);
const surfaceWorld = new Float32Array(surfaceCount * 4);
const surfacesBuffer = root.createBuffer(d.arrayOf(Surface, surfaceCount)).$usage("storage");

const linearSampler = root.createSampler({ magFilter: "linear", minFilter: "linear" });

/**
 * The scene as a texture, so materials can sample what is behind them.
 *
 * A pass cannot read the target it writes to, so the light and the windows render here, the canvas
 * gets a blit of it, and materials then draw over the canvas with this as an ordinary input. Every
 * compositor that has ever blurred a backdrop does this; glass is what makes it non-optional.
 *
 * Rebuilt on resize, along with everything that binds it.
 */
/*
 * The canvas's own format, not `rgba8unorm`.
 *
 * Every render pipeline here declares `getPreferredCanvasFormat()` as its target, which on this
 * machine is `bgra8unorm`. A pipeline cannot render into an attachment of a different format, so an
 * `rgba8unorm` scene texture produced a completely black screen and no visible error — the passes
 * were rejected, the blit faithfully showed what it was given, and every symptom pointed at the
 * shader instead.
 */
const createSceneTexture = (width: number, height: number) =>
  root
    .createTexture({
      format: navigator.gpu.getPreferredCanvasFormat(),
      size: [width, height] as [number, number],
    })
    .$usage("render", "sampled");

let sceneTexture = createSceneTexture(1, 1);
/** Reported, because a backdrop that silently stayed 1×1 looks exactly like a shader that is wrong. */
let sceneSize = "1 x 1";
let surfaceBindGroup = root.createBindGroup(surfaceLayout, {
  backdrop: sceneTexture,
  camera: cameraBuffer,
  sampler: linearSampler,
  surfaces: surfacesBuffer,
});

/**
 * One pipeline per material, which is what makes materials the draw-call boundary.
 *
 * Components sharing a material draw together however many there are, so a thousand buttons is one
 * draw and the count scales with the size of the material *library* rather than with the UI. At
 * 500 000 quads in a single draw measured earlier, a few dozen materials is not a budget worth
 * thinking about.
 */
/**
 * Additive, so a material adds light to captured pixels instead of covering them. Text inside a
 * component survives untouched, which is the rule that keeps this usable at all.
 */
const ADDITIVE = {
  alpha: { dstFactor: "one", operation: "add", srcFactor: "one" },
  color: { dstFactor: "one", operation: "add", srcFactor: "one" },
} as const;

/** Glass is the exception: it replaces its pixels with refracted ones, confined to the rim. */
const OVER = {
  alpha: { dstFactor: "one-minus-src-alpha", operation: "add", srcFactor: "one" },
  color: { dstFactor: "one-minus-src-alpha", operation: "add", srcFactor: "src-alpha" },
} as const;

const materials = {
  edge: { blend: ADDITIVE, fragment: edgeFragment },
  glass: { blend: OVER, fragment: glassFragment },
  sheen: { blend: ADDITIVE, fragment: sheenFragment },
};
const materialPipelines = Object.fromEntries(
  Object.entries(materials).map(([name, material]) => [
    name,
    root.createRenderPipeline({
      fragment: material.fragment,
      primitive: { topology: "triangle-list" },
      targets: { blend: material.blend, format: navigator.gpu.getPreferredCanvasFormat() },
      vertex: surfaceVertex,
    }),
  ]),
);

const light = createLightField(textureLayers);
const lightPipeline = root
  .createRenderPipeline({
    fragment: light.fragment,
    primitive: { topology: "triangle-list" },
    targets: {
      // Additive: light accumulates where windows crowd together, which is the whole point — a
      // dense cluster reads as one bright region rather than as several separate haloes.
      blend: {
        alpha: { dstFactor: "one", operation: "add", srcFactor: "one" },
        color: { dstFactor: "one", operation: "add", srcFactor: "one" },
      },
      format: navigator.gpu.getPreferredCanvasFormat(),
    },
    vertex: light.vertex,
  })
  .with(
    lightLayout,
    root.createBindGroup(lightLayout, {
      camera: cameraBuffer,
      quads: quadsBuffer,
      signatures: signaturesBuffer,
    }),
  );

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
/** `?lit=0` turns the content-derived light off, so its cost and its contribution are both visible. */
const lit = params.get("lit") !== "0";

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
 * The static half of every material instance: box, colour, radius, layer.
 *
 * Re-run whenever a capture lands, not once at mount. A window whose content reflows moves its
 * components — clicking "Mark as done" changes the button's own width — and geometry measured once
 * leaves the material behind, drawing a bevel around where the button used to be.
 *
 * Only `hover` changes between frames, so this stays out of the frame loop; the per-frame work is
 * one float per instance rather than a rebuild.
 */
const buildSurfaces = () => {
  const planned = planSurfaces();

  surfacePlan.length = 0;
  surfaceBatches.length = 0;

  for (const [slot, instance] of planned.entries()) {
    if (slot >= surfaceCount) {
      break;
    }

    const { quad, source } = instance;
    const offset = quad * 4;
    const x = rects[offset] ?? 0;
    const y = rects[offset + 1] ?? 0;
    const width = rects[offset + 2] ?? 0;
    const height = rects[offset + 3] ?? 0;
    const field = slot * 4;

    surfaceAtlas.set(source.box, field);
    surfaceParams[field + 1] = source.radius * width;
    surfaceParams[field + 2] = source.layer;
    surfaceTint.set(source.tint, field);
    surfaceTint[field + 3] = 1;
    surfaceWorld[field] = x + source.box[0] * width;
    surfaceWorld[field + 1] = y + source.box[1] * height;
    surfaceWorld[field + 2] = source.box[2] * width;
    surfaceWorld[field + 3] = source.box[3] * height;

    surfacePlan.push({ element: source.element, material: instance.material });
  }

  surfaceOverflow = planned.length - surfacePlan.length;

  // Contiguous ranges, derived from the plan rather than tracked alongside it, so they cannot drift
  // out of step with what was actually written.
  for (const material of MATERIAL_ORDER) {
    const first = surfacePlan.findIndex((instance) => instance.material === material);
    const count = surfacePlan.filter((instance) => instance.material === material).length;

    if (first >= 0) {
      surfaceBatches.push({ count, first, material });
    }
  }
};

buildSurfaces();

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
  out: {
    layer: d.interpolate("flat", d.f32),
    pos: d.builtin.position,
    screenWidth: d.interpolate("flat", d.f32),
    tint: d.vec4f,
    uv: d.vec2f,
  },
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
    /*
     * How many device pixels wide this window is right now.
     *
     * The right signal for semantic zoom is the window's *on-screen size*, not the camera's zoom:
     * a large window at low zoom can still be legible while a small one at the same zoom is not,
     * and it is legibility the abstraction stands in for.
     */
    screenWidth: quad.rect.z * camera.zoom,
    tint: quad.tint,
    uv: corner,
  };
});

const fragment = tgpu.fragmentFn({
  in: {
    layer: d.interpolate("flat", d.f32),
    screenWidth: d.interpolate("flat", d.f32),
    tint: d.vec4f,
    uv: d.vec2f,
  },
  out: d.vec4f,
})((input) => {
  "use gpu";
  /*
   * The captured pixels, untinted.
   *
   * A per-quad tint used to multiply this, left over from before there were textures at all. Once
   * the signature pass started reporting the colour of a window's *content*, that tint became a
   * lie: it changed what a window looked like without changing anything the compute pass could
   * see, so the light and the window it came from disagreed. Windows carry their own accent now.
   */
  const captured = std.textureSample(
    layout.$.windows,
    layout.$.sampler,
    input.uv,
    d.u32(input.layer),
  );

  /*
   * Semantic zoom, from the window's own measured structure.
   *
   * Shrinking real text below legibility does not degrade gracefully — it becomes grey noise, which
   * is why every infinite canvas turns into a field of grey rectangles when you pull back. The
   * profile the compute pass extracted says where this window's rows of content actually are, so
   * far away it can be drawn as those rows: its ground, banded with its own content colour at the
   * densities really measured. Not a placeholder — a reduction of the thing itself.
   */
  const signature = layout.$.signatures[d.u32(input.layer)];
  const band = std.clamp(d.i32(input.uv.y * BANDS), 0, BANDS - 1);
  const density = signature.bands[band];
  // Inset, so bands read as rows of content rather than as full-bleed stripes.
  const margin = std.smoothstep(0.04, 0.09, input.uv.x) * std.smoothstep(0.96, 0.91, input.uv.x);
  const abstract = std.add(
    signature.ground.xyz,
    std.mul(signature.tint.xyz, density * margin * 0.85),
  );

  // Fully abstract under 70 device pixels wide, fully real over 190, and a blend between.
  const legibility = std.smoothstep(70, 190, input.screenWidth);

  return d.vec4f(std.mix(abstract, captured.xyz, legibility), 1);
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

/**
 * The scene texture straight to the canvas.
 *
 * A full-screen triangle rather than a quad — `common.fullScreenTriangle` is the shape the library
 * ships for exactly this, and one triangle has no diagonal seam for the rasteriser to shade twice.
 */
const blitLayout = tgpu.bindGroupLayout({
  sampler: { sampler: "filtering" },
  source: { texture: d.texture2d(d.f32) },
});

const blit = root.createRenderPipeline({
  fragment: tgpu.fragmentFn({ in: { uv: d.vec2f }, out: d.vec4f })((input) => {
    "use gpu";

    return d.vec4f(std.textureSample(blitLayout.$.source, blitLayout.$.sampler, input.uv).xyz, 1);
  }),
  primitive: { topology: "triangle-list" },
  targets: { format: navigator.gpu.getPreferredCanvasFormat() },
  // The library's own, rather than a hand-rolled one. Getting the winding or the UV flip wrong here
  // fails as a black screen with no error, which is exactly the class of mistake a shipped
  // primitive exists to prevent.
  vertex: common.fullScreenTriangle,
});

let blitBindGroup = root.createBindGroup(blitLayout, {
  sampler: linearSampler,
  source: sceneTexture,
});

const resize = () => {
  const ratio = Math.min(globalThis.devicePixelRatio, 2);
  const width = Math.max(Math.round(canvas.clientWidth * ratio), 1);
  const height = Math.max(Math.round(canvas.clientHeight * ratio), 1);

  if (width === canvas.width && height === canvas.height) {
    return;
  }

  canvas.width = width;
  canvas.height = height;

  // The backdrop has to match the canvas exactly, since materials address it by framebuffer
  // coordinate. Everything that binds it is rebuilt with it.
  sceneTexture.destroy();
  sceneTexture = createSceneTexture(width, height);
  sceneSize = `${String(width)} x ${String(height)}`;
  surfaceBindGroup = root.createBindGroup(surfaceLayout, {
    backdrop: sceneTexture,
    camera: cameraBuffer,
    sampler: linearSampler,
    surfaces: surfacesBuffer,
  });
  blitBindGroup = root.createBindGroup(blitLayout, {
    sampler: linearSampler,
    source: sceneTexture,
  });
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
/**
 * What the compute pass actually measured, read back periodically.
 *
 * Every thirtieth frame, because a buffer read synchronises with the GPU and doing it per frame
 * would make the frame timing above a measurement of the readback. This is the only place the
 * signature is visible as numbers rather than as light.
 */
let signatureReport = "measuring…";
let signatureReading = false;
/**
 * Counted rather than derived from `frames.length`, which caps at 90 — so `length % 30` was true on
 * every frame once warm and the readback ran continuously, pushing a hover from 2 ms to 26 ms. A
 * measurement instrument that changes what it measures.
 */
let frameCount = 0;

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

  /*
   * Three passes, in the order the compositor contract describes them.
   *
   * The signature pass runs every frame rather than on capture. It is 576 texture loads per window
   * — nothing next to the draw — and running it unconditionally means the light can never be stale,
   * which removes a whole class of invalidation bug in exchange for a cost too small to measure.
   */
  const sceneView = sceneTexture;

  if (lit) {
    analyze.dispatchWorkgroups(textureLayers);
    lightPipeline
      .withColorAttachment({
        clearValue: [0.037, 0.04, 0.049, 1],
        loadOp: "clear",
        storeOp: "store",
        view: sceneView,
      })
      .draw(6, quadCount);
  }

  timed
    .withColorAttachment({
      clearValue: [0.055, 0.06, 0.07, 1],
      // The windows draw over the light rather than replacing it, so the glow survives in the space
      // between them.
      loadOp: lit ? "load" : "clear",
      storeOp: "store",
      view: sceneView,
    })
    .draw(6, quadCount);

  // The scene reaches the canvas here, and from this point it is also readable as a backdrop.
  blit
    .with(blitLayout, blitBindGroup)
    .withColorAttachment({ loadOp: "clear", storeOp: "store", view: context })
    .draw(3);

  /*
   * Materials, batched by material, drawn over the windows.
   *
   * Hover is animated here — one float per component, eased toward its target every frame. Nothing
   * is captured, nothing is repainted, and the transition runs at display rate rather than at
   * capture rate. That difference is the entire argument for materials.
   */
  for (const [index, instance] of surfacePlan.entries()) {
    const target = instance.element === hoveredElement ? 1 : 0;
    const current = hoverAmounts.get(instance.element) ?? 0;
    // Eased rather than stepped: this is the whole difference from the capture-based version, which
    // could only ever snap between two states because each one cost a repaint.
    const hover = current + (target - current) * 0.14;

    hoverAmounts.set(instance.element, hover);
    surfaceParams[index * 4] = hover;
  }

  if (surfacePlan.length > 0) {
    common.writeSoA(surfacesBuffer, {
      atlas: surfaceAtlas,
      params: surfaceParams,
      tint: surfaceTint,
      world: surfaceWorld,
    });

    // One draw per material, over a contiguous instance range. The count here is the size of the
    // material library on screen, never the number of components.
    for (const batch of surfaceBatches) {
      materialPipelines[batch.material]
        ?.with(surfaceLayout, surfaceBindGroup)
        .withColorAttachment({ loadOp: "load", storeOp: "store", view: context })
        .draw(6, batch.count, 0, batch.first);
    }
  }

  frameCount += 1;

  if (lit && !signatureReading && frameCount % 45 === 0) {
    signatureReading = true;
    void signaturesBuffer.read().then((values) => {
      signatureReport = values
        .slice(0, 4)
        .map((value) => value.tint.w.toFixed(2))
        .join("  ");
      signatureReading = false;
    });
  }

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
    `backdrop   ${sceneSize}   canvas ${String(canvas.width)} x ${String(canvas.height)}`,
    ...(lit ? [`ink        ${signatureReport}   (measured from the captured pixels)`] : []),
    ...(surfacePlan.length > 0
      ? [
          `surfaces   ${String(surfacePlan.length)} instances / ${String(surfaceBatches.length)} draws  (${surfaceBatches.map((batch) => `${batch.material} ${String(batch.count)}`).join(", ")})`,
          `collect    ${surfaceCollectMs.toFixed(2)} ms per capture   ${cascadeProbeMs.toFixed(2)} ms if it were a cascading custom property`,
          ...(quadCount > surfaceQuads
            ? [`           capped at ${String(surfaceQuads)} of ${String(quadCount)} quads`]
            : []),
          ...(surfaceOverflow > 0
            ? [`           ${String(surfaceOverflow)} instances dropped — buffer full`]
            : []),
        ]
      : []),
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
