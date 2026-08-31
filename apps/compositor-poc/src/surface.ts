import { d, std, tgpu } from "typegpu";

import { Camera } from "./scene.ts";

export const Surface = d.struct({
  /** xy stores the UV origin. zw stores the UV size. */
  atlas: d.vec4f,
  /** x stores hover. y stores radius. z stores the texture layer. */
  params: d.vec4f,
  tint: d.vec4f,
  /** xy stores the world position. zw stores the world size. */
  world: d.vec4f,
});

export const surfaceLayout = tgpu.bindGroupLayout({
  // A refractive material samples this completed scene texture.
  backdrop: { texture: d.texture2d(d.f32) },
  camera: { uniform: Camera },
  sampler: { sampler: "filtering" },
  surfaces: { access: "readonly", storage: d.arrayOf(Surface) },
});

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
    /** Device pixels per world unit convert the glass bend to screen space. */
    zoom: d.interpolate("flat", d.f32),
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

  // The quad extends beyond the component to contain the rim and glow.
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
    // These UVs make 0 to 1 cover only the component.
    uv: std.sub(std.mul(corner, 2), d.vec2f(0.5, 0.5)),
    zoom: camera.zoom,
  };
});

// During full hover, the sheen becomes a rim.
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
  // World units keep the corner radius circular for all aspect ratios.
  const point = std.mul(std.sub(input.uv, d.vec2f(0.5, 0.5)), input.size);
  const distance = roundedBoxDistance(point, std.mul(input.size, 0.5), input.radius);
  const feather = std.max(input.size.y * 0.06, 0.6);

  const inside = 1 - std.smoothstep(0, feather, distance);
  const rim = std.smoothstep(feather * 2.2, 0, std.abs(distance)) * inside;
  const fill = std.smoothstep(0, -input.size.y * 0.5, distance) * 0.34;

  // The sweep peaks halfway through the hover transition.
  const axis = (input.uv.x + input.uv.y) * 0.5;
  const travel = std.exp(-std.pow((axis - input.hover) * 5, 2));
  const sweep = travel * input.hover * (1 - input.hover) * 4 * inside;

  const amount = (rim * 1.15 + fill) * input.hover + sweep * 1.3;

  return d.vec4f(std.mul(input.tint.xyz, amount), 1);
});

// Glass samples the backdrop and replaces pixels only inside its rim.
export const glassFragment = tgpu.fragmentFn({
  in: {
    hover: d.interpolate("flat", d.f32),
    pos: d.builtin.position,
    radius: d.interpolate("flat", d.f32),
    size: d.interpolate("flat", d.vec2f),
    tint: d.vec4f,
    uv: d.vec2f,
    zoom: d.interpolate("flat", d.f32),
  },
  out: d.vec4f,
})((input) => {
  "use gpu";
  const half = std.mul(input.size, 0.5);
  const point = std.mul(std.sub(input.uv, d.vec2f(0.5, 0.5)), input.size);
  const distance = roundedBoxDistance(point, half, input.radius);

  const thickness = std.max(std.min(input.size.x, input.size.y) * 0.09, 1);
  const feather = std.max(thickness * 0.35, 0.5);
  const inside = 1 - std.smoothstep(0, feather, distance);
  const bevel = std.smoothstep(-thickness, -feather, distance) * inside;

  // The distance-field gradient supplies the surface normal.
  const step = std.max(thickness * 0.25, 0.35);
  const gradient = d.vec2f(
    roundedBoxDistance(std.add(point, d.vec2f(step, 0)), half, input.radius) -
      roundedBoxDistance(std.sub(point, d.vec2f(step, 0)), half, input.radius),
    roundedBoxDistance(std.add(point, d.vec2f(0, step)), half, input.radius) -
      roundedBoxDistance(std.sub(point, d.vec2f(0, step)), half, input.radius),
  );
  const normal = std.normalize(std.add(gradient, d.vec2f(0.0001, 0.0001)));

  // Zoom scaling keeps the bend proportional to the component on the screen.
  const viewport = surfaceLayout.$.camera.viewport;
  const bend = std.mul(normal, bevel * thickness * input.zoom * 1.6);
  const centre = std.div(input.pos.xy, viewport);
  const sampled = std.div(std.add(input.pos.xy, bend), viewport);

  // Samples along the bend make refraction follow the surface normal.
  const refracted = std.mul(
    std.add(
      std.add(
        std.textureSample(surfaceLayout.$.backdrop, surfaceLayout.$.sampler, sampled).xyz,
        std.textureSample(
          surfaceLayout.$.backdrop,
          surfaceLayout.$.sampler,
          std.mix(centre, sampled, 0.55),
        ).xyz,
      ),
      std.textureSample(
        surfaceLayout.$.backdrop,
        surfaceLayout.$.sampler,
        std.div(std.add(input.pos.xy, std.mul(bend, 1.5)), viewport),
      ).xyz,
    ),
    0.3333,
  );

  // A fixed upper-left light direction sets the highlight.
  const specular = std.pow(std.max(std.dot(normal, d.vec2f(-0.7, -0.72)), 0), 5) * bevel;

  return d.vec4f(
    std.add(std.mul(refracted, 1.18), std.mul(input.tint.xyz, specular * 0.5 + bevel * 0.05)),
    bevel,
  );
});

// Edge adds a constant accent rim without hover state.
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
