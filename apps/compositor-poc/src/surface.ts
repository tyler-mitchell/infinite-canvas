import { d, std, tgpu } from "typegpu";

import { Camera } from "./scene.ts";

/**
 * Shader materials on individual components.
 *
 * A window is captured as one texture layer, and every component inside it is a **sub-rectangle of
 * that layer**. That is the whole trick: no per-component texture, no second capture — a UV rect is
 * the handle, and the compositor already computes those rects, because it needs them to route a
 * pointer into a captured window.
 *
 * So a component declares a material in the DOM, the compositor collects its rect during capture,
 * and one instanced draw per material paints every component that asked for it. Draw calls scale
 * with the number of distinct materials on screen, not with the number of components — a thousand
 * buttons sharing a material is one draw.
 *
 * Materials add light rather than replacing pixels. If a material overwrote a component's
 * rectangle, the text inside it would vanish; drawing additively over the captured pixels means
 * text, layout and accessibility survive untouched and the GPU only contributes what the DOM cannot.
 */
export const Surface = d.struct({
  /** `xy` origin and `zw` size within the window's texture layer, in UV. */
  atlas: d.vec4f,
  /** `x` hover 0–1, `y` corner radius in world units, `z` texture layer. */
  params: d.vec4f,
  tint: d.vec4f,
  /** `xy` position and `zw` size in world space. */
  world: d.vec4f,
});

export const surfaceLayout = tgpu.bindGroupLayout({
  camera: { uniform: Camera },
  sampler: { sampler: "filtering" },
  surfaces: { access: "readonly", storage: d.arrayOf(Surface) },
  windows: { texture: d.texture2dArray() },
});

/**
 * Signed distance to a rounded box — negative inside, positive outside.
 *
 * A `tgpu.fn` rather than inlined twice: this is the composable unit the material library is built
 * from, and every material needs the same shape because components are rounded rectangles.
 */
const roundedBoxDistance = tgpu.fn(
  [d.vec2f, d.vec2f, d.f32],
  d.f32,
)((point, half, radius) => {
  "use gpu";
  const q = std.add(std.sub(std.abs(point), half), d.vec2f(radius, radius));

  return std.length(std.max(q, d.vec2f(0, 0))) + std.min(std.max(q.x, q.y), 0) - radius;
});

export const surfaceVertex = tgpu.vertexFn({
  in: { instanceIndex: d.builtin.instanceIndex, vertexIndex: d.builtin.vertexIndex },
  out: {
    hover: d.interpolate("flat", d.f32),
    pos: d.builtin.position,
    radius: d.interpolate("flat", d.f32),
    size: d.interpolate("flat", d.vec2f),
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
  const surface = surfaceLayout.$.surfaces[input.instanceIndex];
  const camera = surfaceLayout.$.camera;

  // Bleed past the component's own box so a rim or a glow has somewhere to fall off into.
  const size = d.vec2f(surface.world.z, surface.world.w);
  const margin = std.mul(size, 0.5);
  const origin = std.sub(d.vec2f(surface.world.x, surface.world.y), margin);
  const extent = std.add(size, std.mul(margin, 2));

  const world = std.add(origin, std.mul(corner, extent));
  const screen = std.add(
    std.mul(std.sub(world, camera.center), camera.zoom),
    std.mul(camera.viewport, 0.5),
  );
  const clip = std.sub(std.mul(std.div(screen, camera.viewport), 2), d.vec2f(1, 1));

  return {
    hover: surface.params.x,
    pos: d.vec4f(clip.x, -clip.y, 0, 1),
    radius: surface.params.y,
    size,
    tint: surface.tint,
    // Remapped so 0–1 spans the component itself rather than the bled quad.
    uv: std.sub(std.mul(corner, 2), d.vec2f(0.5, 0.5)),
  };
});

/**
 * Sheen: a light that sweeps across on entry and settles into a rim.
 *
 * The point of this material is what it costs. Hover used to be a CSS background change *inside*
 * the capture, which meant 2.6 ms of repaint to produce a flat colour swap — the reason it looked
 * lifeless. Here hover is one float per instance: no repaint, no capture, and the transition can be
 * a moving highlight at display rate instead of a step change at capture rate.
 */
export const sheenFragment = tgpu.fragmentFn({
  in: {
    hover: d.interpolate("flat", d.f32),
    radius: d.interpolate("flat", d.f32),
    size: d.interpolate("flat", d.vec2f),
    tint: d.vec4f,
    uv: d.vec2f,
  },
  out: d.vec4f,
})((input) => {
  "use gpu";
  // Worked in world units rather than UV so the corner radius stays circular on any aspect.
  const point = std.mul(std.sub(input.uv, d.vec2f(0.5, 0.5)), input.size);
  const distance = roundedBoxDistance(point, std.mul(input.size, 0.5), input.radius);
  const feather = std.max(input.size.y * 0.06, 0.6);

  const inside = 1 - std.smoothstep(0, feather, distance);
  const rim = std.smoothstep(feather * 2.2, 0, std.abs(distance)) * inside;
  const fill = std.smoothstep(0, -input.size.y * 0.5, distance) * 0.34;

  /*
   * The sweep travels with the transition and vanishes at rest.
   *
   * `hover * (1 - hover)` peaks halfway through, so the highlight crosses the component as it
   * lights up and is gone once it has settled — the way a real specular does, rather than a band
   * parked permanently across the middle.
   */
  const axis = (input.uv.x + input.uv.y) * 0.5;
  const travel = std.exp(-std.pow((axis - input.hover) * 5, 2));
  const sweep = travel * input.hover * (1 - input.hover) * 4 * inside;

  const amount = (rim * 1.15 + fill) * input.hover + sweep * 1.3;

  return d.vec4f(std.mul(input.tint.xyz, amount), 1);
});

/** Edge: a constant accent rim. No hover, so it is the cheap case and the second batch. */
export const edgeFragment = tgpu.fragmentFn({
  in: {
    hover: d.interpolate("flat", d.f32),
    radius: d.interpolate("flat", d.f32),
    size: d.interpolate("flat", d.vec2f),
    tint: d.vec4f,
    uv: d.vec2f,
  },
  out: d.vec4f,
})((input) => {
  "use gpu";
  const point = std.mul(std.sub(input.uv, d.vec2f(0.5, 0.5)), input.size);
  const distance = roundedBoxDistance(point, std.mul(input.size, 0.5), input.radius);
  const feather = std.max(input.size.y * 0.09, 0.5);

  const inside = 1 - std.smoothstep(0, feather, distance);
  const rim = std.smoothstep(feather * 2, 0, std.abs(distance)) * inside;
  const fill = std.smoothstep(0, -input.size.y * 0.6, distance) * 0.28;

  return d.vec4f(std.mul(input.tint.xyz, rim * 0.45 + fill), 1);
});
