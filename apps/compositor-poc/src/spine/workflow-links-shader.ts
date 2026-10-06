/**
 * Shader half of the workflow-links pass. No React and no framework import,
 * which is the rule for `compositor/passes/` in the target layout: a pass
 * module names TypeGPU and nothing else.
 */

import { d, std, tgpu } from "typegpu";

/**
 * The per-space camera uniform. Written once per frame per space by the
 * surface. Units match the DOM plane exactly: `viewport` and `zoom` are CSS
 * pixels, as in `worldRectToScreenRect` (geometry.ts). `devicePixelRatio` is
 * the viewport's uncapped ratio, used only where geometry must be a whole
 * number of device pixels (line thickness, window edge snapping).
 */
export const CompositorCamera = d.struct({
  /** World units at the viewport centre. Zero for screen space. */
  center: d.vec2f,
  /** CSS pixels. */
  viewport: d.vec2f,
  /** CSS pixels per world unit. One for screen space. */
  zoom: d.f32,
  devicePixelRatio: d.f32,
});

/** World to CSS-pixel screen, identical to worldPointToScreenPoint. */
export const worldToScreen = tgpu.fn(
  [d.vec2f, CompositorCamera],
  d.vec2f,
)((world, camera) => {
  "use gpu";

  return std.add(
    std.mul(std.sub(world, camera.center), camera.zoom),
    std.mul(camera.viewport, 0.5),
  );
});

/** CSS-pixel screen to clip. Scale-free, so CSS pixels are the only unit needed. */
export const screenToClip = tgpu.fn(
  [d.vec2f, CompositorCamera],
  d.vec4f,
)((screen, camera) => {
  "use gpu";
  const clip = std.sub(std.mul(std.div(screen, camera.viewport), 2), d.vec2f(1, 1));

  return d.vec4f(clip.x, -clip.y, 0, 1);
});

/**
 * Snaps a CSS-pixel coordinate to the device-pixel grid, the same rule
 * `projectWorldRectToScreen` applies to DOM window edges. The window pass
 * applies it to quad corners so textured windows land on the DOM rect.
 */
export const snapToDevicePixel = tgpu.fn(
  [d.vec2f, d.f32],
  d.vec2f,
)((screen, devicePixelRatio) => {
  "use gpu";

  return std.div(std.round(std.mul(screen, devicePixelRatio)), devicePixelRatio);
});

export const LinkSegment = d.struct({
  /** World start and end. */
  a: d.vec2f,
  b: d.vec2f,
  /** CSS pixels, so thickness stays constant across zoom. */
  thickness: d.f32,
  color: d.vec4f,
});

export const linkLayout = tgpu.bindGroupLayout({
  camera: { uniform: CompositorCamera },
  segments: { access: "readonly", storage: d.arrayOf(LinkSegment) },
});

/** Six vertices per instance form one quad from a to b, `thickness` CSS pixels wide. */
export const linkVertex = tgpu.vertexFn({
  in: { instanceIndex: d.builtin.instanceIndex, vertexIndex: d.builtin.vertexIndex },
  out: { color: d.vec4f, pos: d.builtin.position },
})((input) => {
  "use gpu";
  const corners = [
    d.vec2f(0, -0.5),
    d.vec2f(1, -0.5),
    d.vec2f(0, 0.5),
    d.vec2f(0, 0.5),
    d.vec2f(1, -0.5),
    d.vec2f(1, 0.5),
  ];
  const corner = corners[input.vertexIndex];
  const segment = linkLayout.$.segments[input.instanceIndex];
  const camera = linkLayout.$.camera;
  // Geometry is built in CSS-pixel screen space so thickness needs no zoom term.
  const a = worldToScreen(segment.a, camera);
  const b = worldToScreen(segment.b, camera);
  const along = std.sub(b, a);
  const direction = std.normalize(along);
  const normal = d.vec2f(-direction.y, direction.x);
  const screen = std.add(
    std.add(a, std.mul(along, corner.x)),
    std.mul(normal, segment.thickness * corner.y),
  );

  return { color: segment.color, pos: screenToClip(screen, camera) };
});

export const linkFragment = tgpu.fragmentFn({ in: { color: d.vec4f }, out: d.vec4f })((input) => {
  "use gpu";

  return input.color;
});
