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

const params = new URLSearchParams(globalThis.location.search);
const quadCount = Math.max(Number(params.get("n") ?? 2000), 1);
// `maxTextureArrayLayers` limits the number of window textures.
const textureLayers = Math.max(Number(params.get("tex") ?? 64), 1);
const textureSize = Math.max(Number(params.get("texsize") ?? 256), 8);

// The texture aspect ratio matches the window and prevents distortion.
const WINDOW_WIDTH = 300;
const WINDOW_HEIGHT = 220;
const textureHeight = Math.max(Math.round((textureSize * WINDOW_HEIGHT) / WINDOW_WIDTH), 8);

// This order keeps accents and sheen above the glass bevel.
const MATERIAL_ORDER = ["glass", "edge", "sheen"];

const canvas = document.querySelector("canvas") as HTMLCanvasElement;
const readout = document.querySelector("#readout") as HTMLPreElement;

const root = await tgpu.init({
  device: { optionalFeatures: ["timestamp-query"] },
});

const context = root.configureContext({ alphaMode: "opaque", canvas });
const hasTimestamps = root.enabledFeatures.has("timestamp-query");

// Zero elapsed time means that no timestamp sample arrived.
const passTimings: Record<string, { recent: number[]; samples: number }> = {};

const timePass = <
  Pipeline extends {
    withPerformanceCallback: (callback: (start: bigint, end: bigint) => void) => Pipeline;
  },
>(
  name: string,
  pipeline: Pipeline,
) =>
  hasTimestamps
    ? pipeline.withPerformanceCallback((start, end) => {
        const elapsed = Number(end - start);
        const slot = (passTimings[name] ??= { recent: [], samples: 0 });

        if (elapsed > 0) {
          slot.recent.push(elapsed / 1e6);
          slot.samples += 1;

          if (slot.recent.length > 90) {
            slot.recent.shift();
          }
        }
      })
    : pipeline;

// A 90-sample median reduces timestamp noise.
const passMedian = (name: string) => {
  const sorted = [...(passTimings[name]?.recent ?? [])].sort((left, right) => left - right);

  return sorted[Math.floor(sorted.length / 2)] ?? 0;
};

const layout = tgpu.bindGroupLayout({
  camera: { uniform: Camera },
  quads: { storage: d.arrayOf(Quad), access: "readonly" },
  sampler: { sampler: "filtering" },
  signatures: { access: "readonly", storage: d.arrayOf(Signature) },
  windows: { texture: d.texture2dArray() },
});

const cameraBuffer = root.createBuffer(Camera).$usage("uniform");
const quadsBuffer = root.createBuffer(d.arrayOf(Quad, quadCount)).$usage("storage");

// Each texture layer stores one distinct window.
const windowTextures = root
  .createTexture({
    format: "rgba8unorm",
    size: [textureSize, textureHeight, textureLayers],
  })
  .$usage("sampled", "render");

// This canvas isolates upload cost from DOM capture cost.
const painted = document.createElement("canvas");

painted.width = textureSize;
painted.height = textureHeight;

const paint = painted.getContext("2d") as CanvasRenderingContext2D;
const captures: ImageBitmap[] = [];

// The browser converts CSS colors to RGB.
const readColour = (value: string) => {
  paint.fillStyle = value.trim() === "" ? "#ffffff" : value;
  paint.fillRect(0, 0, 1, 1);

  const pixel = paint.getImageData(0, 0, 1, 1).data;

  return [(pixel[0] ?? 0) / 255, (pixel[1] ?? 0) / 255, (pixel[2] ?? 0) / 255] as const;
};

// The HTML path measures DOM capture and upload.
const captureHtml = params.get("html") === "1";
// The native path copies each direct DOM child to one texture layer.
const captureNative = params.get("native") === "1";
const captureSource = document.querySelector("#capture-source .note") as HTMLElement;
let captureMs = 0;
let captureLabel = "canvas-painted (no DOM)";
let nativeDirectToTexture = false;
let incrementalMs = 0;
let changedElementCount = 0;
let changedElementsReported = false;
let dirtyWindows = 0;
let interactionResult = "click a window to test";
// Separate entries keep the timing for each interaction.
const responses: Record<string, string> = {};

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
// This map preserves hover state after geometry collection.
const hoverAmounts = new Map<HTMLElement, number>();
let surfaceCollectMs = 0;
let cascadeProbeMs = 0;
let surfaceOverflow = 0;

if (captureNative) {
  const paintCanvas = document.createElement("canvas");

  paintCanvas.width = textureSize;
  paintCanvas.height = textureHeight;
  paintCanvas.id = "paint-host";
  paintCanvas.toggleAttribute("layoutsubtree", true);
  document.body.append(paintCanvas);

  // One synchronous React render creates direct canvas children before the first paint.
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
          createElement(Note, {
            height: textureHeight,
            index: layer,
            key: layer,
            width: textureSize,
          }),
        ),
      ),
    );
  });

  const windowElements = Array.from(paintCanvas.querySelectorAll<HTMLElement>(":scope > .note"));

  // Window fractions let one component box serve all instances.
  collectSurfaces = () => {
    const started = performance.now();
    const found: SurfaceSource[] = [];

    for (const [layer, element] of windowElements.entries()) {
      const box = element.getBoundingClientRect();
      const accent = readColour(getComputedStyle(element).getPropertyValue("--accent"));

      // The list includes the window because querySelectorAll searches descendants only.
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

        // This limit matches the browser limit for large border radii.
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
          // The collector stores the radius as a fraction of the window width.
          radius: radius / box.width,
          tint: accent,
        });
      }
    }

    surfaceCollectMs = performance.now() - started;
    surfaceSources = found;
  };

  // This probe measures the cost of the inherited --surface property.
  const probeStarted = performance.now();

  for (const element of windowElements) {
    for (const node of element.querySelectorAll<HTMLElement>("*")) {
      getComputedStyle(node).getPropertyValue("--surface");
    }
  }

  cascadeProbeMs = performance.now() - probeStarted;

  collectSurfaces();

  // A context prevents "containing canvas does not have a rendering context".
  paintCanvas.getContext("2d");

  const requestPaint = (paintCanvas as HTMLCanvasElement & { requestPaint: () => void })
    .requestPaint;
  // `copyElementImageToTexture` requires a direct child of the layout canvas.
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

  // This promise resolves with the elements that the browser reports as changed.
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

  // This probe edits the first N windows to measure incremental capture.
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

  // `layoutsubtree` children require box-based hit-testing.
  // This selector lists the supported control types.
  const CONTROLS = "button, input, textarea, select, [contenteditable]";

  const resolvePointer = (clientX: number, clientY: number) => {
    const bounds = canvas.getBoundingClientRect();
    const world = {
      x: (clientX - bounds.left - canvas.clientWidth / 2) / camera.zoom + camera.center.x,
      y: (clientY - bounds.top - canvas.clientHeight / 2) / camera.zoom + camera.center.y,
    };

    // Later instances cover earlier instances, so the last match wins.
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

    const offset = hitIndex * 4;
    // Each axis uses the texture dimension for that axis.
    const local = {
      x: ((world.x - (rects[offset] ?? 0)) / (rects[offset + 2] ?? 1)) * textureSize,
      y: ((world.y - (rects[offset + 1] ?? 0)) / (rects[offset + 3] ?? 1)) * textureHeight,
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

  // This set coalesces changes while one paint is active.
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

    // The flush collects boxes after each paint because content can cause reflow.
    collectSurfaces?.();
    buildSurfaces();

    responses[dirtyCause] =
      `${dirtyCause} ${(performance.now() - started).toFixed(2)} ms (${String(events)}→${String(layers.length)})`;
    flushing = false;

    // The next paint flushes changes that arrive during the current paint.
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

  // Capture omits the browser focus ring, so the compositor draws it.
  let focused: HTMLElement | null = null;

  canvas.addEventListener("pointermove", (event) => {
    // A drag pans the camera and does not target a control.
    if (event.buttons !== 0) {
      return;
    }

    const found = resolvePointer(event.clientX, event.clientY);
    const control = found?.control ?? null;

    canvas.style.cursor = control === null ? "default" : "pointer";

    // GPU data tracks hover without a source DOM repaint.
    hoveredElement = control;
  });

  // The compositor resolves geometry. React owns the dispatched click and state.
  canvas.addEventListener("click", (event) => {
    const found = resolvePointer(event.clientX, event.clientY);
    const control = found?.control ?? null;

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

    // Native focus carries keyboard, selection, and IME input.
    control.focus();
    control.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));

    interactionResult = `window ${String(found.layer)} — ${control.tagName.toLowerCase()} clicked`;

    markDirty([found.layer], "click");
  });

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
    // The capture loop changes each heading so every layer contains distinct pixels.
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

// GPU completion makes upload time include the transfer.
const uploadStarted = performance.now();

if (!nativeDirectToTexture) {
  windowTextures.write(captures);
  await root.device.queue.onSubmittedWorkDone();
}

const uploadMs = nativeDirectToTexture ? 0 : performance.now() - uploadStarted;

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

// The plan groups material instances into contiguous draw ranges.
const surfaceQuads = Math.min(quadCount, 128);
const surfacePlan: Array<{ element: HTMLElement; material: string }> = [];
const surfaceBatches: Array<{ count: number; first: number; material: string }> = [];

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

// The buffer reserves room for component reflow without allocation.
const surfaceCount = Math.max(planSurfaces().length * 2, 32);
const surfaceAtlas = new Float32Array(surfaceCount * 4);
const surfaceParams = new Float32Array(surfaceCount * 4);
const surfaceTint = new Float32Array(surfaceCount * 4);
const surfaceWorld = new Float32Array(surfaceCount * 4);
const surfacesBuffer = root.createBuffer(d.arrayOf(Surface, surfaceCount)).$usage("storage");

const linearSampler = root.createSampler({ magFilter: "linear", minFilter: "linear" });

// The scene attachment format must match every render pipeline target.
const createSceneTexture = (width: number, height: number) =>
  root
    .createTexture({
      format: navigator.gpu.getPreferredCanvasFormat(),
      size: [width, height] as [number, number],
    })
    .$usage("render", "sampled");

let sceneTexture = createSceneTexture(1, 1);
let sceneSize = "1 x 1";
let surfaceBindGroup = root.createBindGroup(surfaceLayout, {
  backdrop: sceneTexture,
  camera: cameraBuffer,
  sampler: linearSampler,
  surfaces: surfacesBuffer,
});

// Additive materials preserve captured pixels.
const ADDITIVE = {
  alpha: { dstFactor: "one", operation: "add", srcFactor: "one" },
  color: { dstFactor: "one", operation: "add", srcFactor: "one" },
} as const;

// Glass replaces only its rim pixels with refracted samples.
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
    timePass(
      name,
      root.createRenderPipeline({
        fragment: material.fragment,
        primitive: { topology: "triangle-list" },
        targets: { blend: material.blend, format: navigator.gpu.getPreferredCanvasFormat() },
        vertex: surfaceVertex,
      }),
    ),
  ]),
);

const light = createLightField(textureLayers);
const lightPipeline = root
  .createRenderPipeline({
    fragment: light.fragment,
    primitive: { topology: "triangle-list" },
    targets: {
      // Additive light makes dense window clusters brighter.
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

const columns = Math.ceil(Math.sqrt(quadCount));
const rects = new Float32Array(quadCount * 4);
const tints = new Float32Array(quadCount * 4);
// The overdraw probe stacks every quad and measures the fill-rate limit.
const overdraw = params.get("overdraw") === "1";
const lit = params.get("lit") !== "0";
// Empty material passes isolate their fixed cost.
const emptyPass = params.get("emptypass") === "1";

for (let index = 0; index < quadCount; index++) {
  const offset = index * 4;

  if (overdraw) {
    // Each stacked quad covers a 40,000-unit square for the overdraw probe.
    rects[offset] = -20000;
    rects[offset + 1] = -20000;
    rects[offset + 2] = 40000;
    rects[offset + 3] = 40000;
  } else {
    rects[offset] = (index % columns) * 420 + ((index * 97) % 140);
    rects[offset + 1] = Math.floor(index / columns) * 320 + ((index * 53) % 110);
    rects[offset + 2] = WINDOW_WIDTH;
    rects[offset + 3] = WINDOW_HEIGHT;
  }

  tints[offset] = 0.55 + ((index * 17) % 100) / 400;
  tints[offset + 1] = 0.45 + ((index * 31) % 100) / 300;
  tints[offset + 2] = 0.7;
  tints[offset + 3] = 1;
}

common.writeSoA(quadsBuffer, { rect: rects, tint: tints });

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

  // The written plan supplies draw ranges and prevents drift.
  for (const material of MATERIAL_ORDER) {
    const first = surfacePlan.findIndex((instance) => instance.material === material);
    const count = surfacePlan.filter((instance) => instance.material === material).length;

    if (first >= 0) {
      surfaceBatches.push({ count, first, material });
    }
  }
};

buildSurfaces();

// Explicit vertex output types let TypeGPU infer fragment inputs.
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
    // The flat qualifier prevents interpolation of the texture-layer index.
    layer: d.f32(input.instanceIndex % textureLayers),
    pos: d.vec4f(clip.x, -clip.y, 0, 1),
    // On-screen width controls semantic zoom.
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
  // Display colors match the colors that the signature pass measures.
  const captured = std.textureSample(
    layout.$.windows,
    layout.$.sampler,
    input.uv,
    d.u32(input.layer),
  );

  // The shader uses measured rows for text that is too small to read.
  const signature = layout.$.signatures[d.u32(input.layer)];
  const band = std.clamp(d.i32(input.uv.y * BANDS), 0, BANDS - 1);
  const density = signature.bands[band];
  const margin = std.smoothstep(0.04, 0.09, input.uv.x) * std.smoothstep(0.96, 0.91, input.uv.x);
  const abstract = std.add(
    signature.ground.xyz,
    std.mul(signature.tint.xyz, density * margin * 0.85),
  );

  // The shader blends between abstract and captured pixels from 70 to 190 device pixels.
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

const camera = {
  center: { x: 0, y: 0 },
  zoom: Math.max(Number(params.get("zoom") ?? 0.35), 0.01),
};
const timedWindows = timePass("windows", pipeline);
const timedLight = timePass("light", lightPipeline);
const timedAnalyze = timePass("analyse", analyze);

// One full-screen triangle prevents a diagonal seam.
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

  // The backdrop matches the canvas because materials use framebuffer coordinates.
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
// Periodic signature reads limit GPU synchronization.
let signatureReport = "measuring…";
let signatureReading = false;
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

  // Lit frames analyze content before they draw light and windows.
  const sceneView = sceneTexture;

  if (lit) {
    timedAnalyze.dispatchWorkgroups(textureLayers);
    timedLight
      .withColorAttachment({
        clearValue: [0.037, 0.04, 0.049, 1],
        loadOp: "clear",
        storeOp: "store",
        view: sceneView,
      })
      .draw(6, quadCount);
  }

  timedWindows
    .withColorAttachment({
      clearValue: [0.055, 0.06, 0.07, 1],
      loadOp: lit ? "load" : "clear",
      storeOp: "store",
      view: sceneView,
    })
    .draw(6, quadCount);

  // The frame blits the scene before materials draw over the canvas.
  blit
    .with(blitLayout, blitBindGroup)
    .withColorAttachment({ loadOp: "clear", storeOp: "store", view: context })
    .draw(3);

  // GPU data updates hover at display rate.
  for (const [index, instance] of surfacePlan.entries()) {
    const target = instance.element === hoveredElement ? 1 : 0;
    const current = hoverAmounts.get(instance.element) ?? 0;
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

    // Each material owns one contiguous instance range.
    for (const batch of surfaceBatches) {
      materialPipelines[batch.material]
        ?.with(surfaceLayout, surfaceBindGroup)
        .withColorAttachment({ loadOp: "load", storeOp: "store", view: context })
        .draw(6, emptyPass ? 0 : batch.count, 0, batch.first);
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
      ? `gpu        ${Object.keys(passTimings)
          .map((name) => `${name} ${passMedian(name).toFixed(3)}`)
          .join("  ")}   = ${Object.keys(passTimings)
          .reduce((total, name) => total + passMedian(name), 0)
          .toFixed(3)} ms median`
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
