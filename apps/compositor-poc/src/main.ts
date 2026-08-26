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

/** Read `?n=` so the count can be pushed until something gives, without a rebuild. */
const params = new URLSearchParams(globalThis.location.search);
const quadCount = Math.max(Number(params.get("n") ?? 2000), 1);

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
});

const cameraBuffer = root.createBuffer(Camera).$usage("uniform");
const quadsBuffer = root.createBuffer(d.arrayOf(Quad, quadCount)).$usage("storage");
const bindGroup = root.createBindGroup(layout, {
  camera: cameraBuffer,
  quads: quadsBuffer,
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

for (let index = 0; index < quadCount; index++) {
  const offset = index * 4;

  rects[offset] = (index % columns) * 420 + ((index * 97) % 140);
  rects[offset + 1] = Math.floor(index / columns) * 320 + ((index * 53) % 110);
  rects[offset + 2] = 300;
  rects[offset + 3] = 220;
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
  out: { pos: d.builtin.position, tint: d.vec4f, uv: d.vec2f },
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
    pos: d.vec4f(clip.x, -clip.y, 0, 1),
    tint: quad.tint,
    uv: corner,
  };
});

const fragment = tgpu.fragmentFn({
  in: { tint: d.vec4f, uv: d.vec2f },
  out: d.vec4f,
})((input) => {
  "use gpu";
  // Stand-in for sampling a captured HTML texture: enough per-pixel work that fill rate is real
  // rather than a flat fill the driver can trivially collapse.
  const edge = std.min(
    std.min(input.uv.x, 1 - input.uv.x) * 12,
    std.min(input.uv.y, 1 - input.uv.y) * 12,
  );

  return d.vec4f(std.mul(input.tint.xyz, 0.35 + std.clamp(edge, 0, 1) * 0.65), 1);
});

const pipeline = root
  .createRenderPipeline({
    fragment,
    primitive: { topology: "triangle-list" },
    targets: { format: navigator.gpu.getPreferredCanvasFormat() },
    vertex,
  })
  .with(layout, bindGroup);

const camera = { center: { x: 0, y: 0 }, zoom: 0.35 };
let gpuNanoseconds = 0;

const timed = hasTimestamps
  ? pipeline.withPerformanceCallback((start, end) => {
      gpuNanoseconds = Number(end - start);
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

  readout.textContent = [
    `<b>quads</b>      ${String(quadCount)}`,
    `<b>draw calls</b> 1`,
    `<b>frame</b>      ${median.toFixed(2)} ms  (${(1000 / median).toFixed(0)} fps)`,
    hasTimestamps
      ? `<b>gpu</b>        ${(gpuNanoseconds / 1e6).toFixed(3)} ms`
      : `<b>gpu</b>        timestamp-query unavailable`,
    `<b>zoom</b>       ${camera.zoom.toFixed(2)}   drag to pan, wheel to zoom`,
  ]
    .join("\n")
    .replaceAll("<b>", "")
    .replaceAll("</b>", "");

  requestAnimationFrame(frame);
};

requestAnimationFrame(frame);
